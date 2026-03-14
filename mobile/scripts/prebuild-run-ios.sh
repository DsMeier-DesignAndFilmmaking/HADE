#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

LOG_DIR=".expo-prebuild-logs"

log() {
  echo "==> $*"
}

has_rg() {
  command -v rg >/dev/null 2>&1
}

grep_all() {
  if has_rg; then
    rg -n "$1" "$2" 2>/dev/null || true
  else
    grep -RIn "$1" "$2" 2>/dev/null || true
  fi
}

ensure_no_dev_client() {
  # Guardrail: fail fast if dev-client or dev-launcher appears in config.
  local hits
  hits="$(grep_all "expo-dev-client|expo-dev-launcher" package.json package-lock.json)"
  if [[ -n "${hits}" ]]; then
    echo "Found dev-client references; remove them before continuing."
    echo "${hits}"
    exit 1
  fi
}

clean_ios_env() {
  # Remove generated iOS project so prebuild can regenerate cleanly.
  log "Removing ios/"
  rm -rf ios

  # Remove local Expo caches that can hold stale config/plugin state.
  log "Removing local Expo caches"
  rm -rf .expo .expo-shared

  # Remove dependency tree and lockfile to drop stale or incompatible packages.
  log "Removing node_modules and package-lock.json"
  rm -rf node_modules
  rm -f package-lock.json

  # Remove global Expo cache to avoid cached template or config issues.
  log "Removing global Expo cache"
  rm -rf "${HOME}/.expo"
}

install_deps() {
  # Install dependencies fresh from package.json.
  log "Installing dependencies"
  npm install
}

prebuild_ios() {
  # Generate the native iOS project only.
  log "Prebuilding iOS"
  npx expo prebuild --clean --platform ios
}

boot_simulator() {
  # Boot an iOS simulator (safe if already running).
  log "Booting iOS Simulator"
  xcrun simctl boot "iPhone 15" || true
  open -a Simulator
}

run_ios() {
  # Build and run the app on the simulator.
  log "Running iOS app"
  npx expo run:ios
}

retry_if_common_prebuild_error() {
  # Retry prebuild once if a common Expo prebuild error occurs.
  local log_file="$1"
  if grep -q "Cannot read properties of undefined (reading 'extract')" "${log_file}" || \
     grep -q "Failed to create the native directory" "${log_file}" || \
     grep -q "Failed to resolve plugin" "${log_file}"; then
    log "Detected common prebuild error; cleaning and retrying"
    clean_ios_env
    ensure_no_dev_client
    install_deps
    prebuild_ios
    return
  fi

  # If it's not a known retryable error, surface the log and fail.
  log "Prebuild failed; see ${log_file}"
  exit 1
}

main() {
  # Create a log directory for prebuild output.
  mkdir -p "${LOG_DIR}"

  # Ensure we are not accidentally pulling in dev-client.
  ensure_no_dev_client

  # Full clean so we can build from a stale state.
  clean_ios_env

  # Fresh dependency install after cleanup.
  install_deps

  # Prebuild with logging so we can retry on known errors.
  local log_file="${LOG_DIR}/prebuild-$(date +%Y%m%d-%H%M%S).log"
  set +e
  prebuild_ios 2>&1 | tee "${log_file}"
  local status="${PIPESTATUS[0]}"
  set -e

  if [[ "${status}" -ne 0 ]]; then
    retry_if_common_prebuild_error "${log_file}"
  fi

  # Boot simulator and run the app.
  boot_simulator
  run_ios

  log "Done."
}

main "$@"
