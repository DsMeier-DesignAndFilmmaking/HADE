import AsyncStorage from "@react-native-async-storage/async-storage";

export type MapProviderOverride = "auto" | "apple" | "google";

const MAP_PROVIDER_OVERRIDE_KEY = "hade.debug.mapProviderOverride.v1";

export async function getMapProviderOverride(): Promise<MapProviderOverride> {
  const raw = await AsyncStorage.getItem(MAP_PROVIDER_OVERRIDE_KEY);
  if (raw === "auto" || raw === "apple" || raw === "google") {
    return raw;
  }
  return "auto";
}

export async function setMapProviderOverride(
  override: MapProviderOverride
): Promise<void> {
  await AsyncStorage.setItem(MAP_PROVIDER_OVERRIDE_KEY, override);
}
