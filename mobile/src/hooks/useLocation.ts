// mobile/src/hooks/useLocation.ts
import * as Location from "expo-location";
import { useEffect, useState } from "react";

// Default to Shibuya for the demo if all else fails
const TOKYO_FALLBACK = {
  latitude: 35.6595,
  longitude: 139.7005,
};

export function useLocation() {
  const [location, setLocation] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMsg('Permission to access location was denied');
          setLocation(TOKYO_FALLBACK);
          return;
        }

        // 1. Get last known for immediate UI response (Fastest)
        let last = await Location.getLastKnownPositionAsync({});
        if (last) {
          setLocation(last.coords);
        }

        // 2. Then get fresh (Most Accurate)
        let current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLocation(current.coords);
      } catch (e) {
        console.warn("Location error:", e);
        setLocation(TOKYO_FALLBACK);
      }
    })();
  }, []);

  return { location, errorMsg };
}