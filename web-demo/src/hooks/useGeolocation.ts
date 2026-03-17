"use client";

import { useEffect, useState } from "react";

export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface UseGeolocationResult {
  location: GeoLocation | null;
  error: string | null;
  loading: boolean;
}

const GEO_TIMEOUT_MS = 8_000;

export function useGeolocation(): UseGeolocationResult {
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      setLoading(false);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setError("Location request timed out. Please allow location access and reload.");
      setLoading(false);
    }, GEO_TIMEOUT_MS);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timeoutId);
        const coords: GeoLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        console.log("[HADE] Location acquired:", coords);
        setLocation(coords);
        setLoading(false);
      },
      (err) => {
        clearTimeout(timeoutId);
        if (err.code === err.PERMISSION_DENIED) {
          setError("Location access was denied. HADE needs your location to make a confident recommendation.");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setError("Location unavailable. Check your device settings.");
        } else {
          setError("Could not determine your location. Please try again.");
        }
        setLoading(false);
      },
      {
        enableHighAccuracy: false,
        timeout: GEO_TIMEOUT_MS,
        maximumAge: 60_000,
      }
    );
  }, []);

  return { location, error, loading };
}
