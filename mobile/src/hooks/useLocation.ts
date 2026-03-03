import { useEffect, useState } from "react";
import type { GeoLocation } from "../types";

interface LocationState {
  location: GeoLocation | null;
  error: string | null;
  loading: boolean;
}

export function useLocation(): LocationState {
  const [state, setState] = useState<LocationState>({
    location: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    // TODO: Request location permissions via expo-location
    // TODO: Watch position and update state
    setState({ location: null, error: "Not implemented", loading: false });
  }, []);

  return state;
}
