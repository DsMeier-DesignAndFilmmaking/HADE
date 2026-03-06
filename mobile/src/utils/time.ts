/**
 * HADE time utilities — human-friendly relative timestamps.
 * Voice: confident, present-tense. "12m ago", not "12 minutes ago".
 */

/**
 * Converts an ISO 8601 timestamp to a compact relative string.
 * Examples: "just now", "12m ago", "2h ago", "yesterday", "3d ago"
 */
export function timeAgo(isoTimestamp: string): string {
  const now = Date.now();
  const then = new Date(isoTimestamp).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return "yesterday";
  return `${diffDay}d ago`;
}

/**
 * Returns true if the timestamp is older than the threshold.
 * Default: 180 minutes (3 hours) per BRAIN_UX.md stale treatment spec.
 */
export function isStale(
  isoTimestamp: string,
  thresholdMinutes: number = 180,
): boolean {
  const diffMs = Date.now() - new Date(isoTimestamp).getTime();
  return diffMs > thresholdMinutes * 60_000;
}
