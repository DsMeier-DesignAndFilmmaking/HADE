// mobile/src/hooks/useLocation.ts
import * as Location from "expo-location";
import { useEffect, useState } from "react";

export function useLocation() {
  const [location, setLocation] = useState<any>(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      // Get last known for immediate UI response
      let last = await Location.getLastKnownPositionAsync({});
      if (last) setLocation(last.coords);

      // Then get fresh
      let current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced
      });
      setLocation(current.coords);
    })();
  }, []);

  return { location };
}