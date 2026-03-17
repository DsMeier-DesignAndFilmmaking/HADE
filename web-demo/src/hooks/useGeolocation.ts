"use client";

import { useEffect, useState } from "react";

export interface GeoLocation {
  lat: number;
  lng: number;
}

export interface UseGeolocationResult {
  location: GeoLocation | null;
  /** Human-readable city label from IP geo, e.g. "Raleigh, NC". Null when GPS is used. */
  cityLabel: string | null;
  /** True when coordinates came from IP geolocation rather than GPS. */
  isApproximate: boolean;
  error: string | null;
  loading: boolean;
}

interface IpApiResponse {
  latitude: number;
  longitude: number;
  city: string;
  region_code: string;
  error?: boolean;
  reason?: string;
}

/** Falls back to IP geolocation via ipapi.co (no API key, 1k req/day free tier). */
async function fetchIpLocation(): Promise<{ coords: GeoLocation; cityLabel: string }> {
  const res = await fetch("https://ipapi.co/json/", { cache: "no-store" });
  if (!res.ok) throw new Error(`ipapi.co returned ${res.status}`);
  const data: IpApiResponse = await res.json();
  if (data.error) throw new Error(data.reason ?? "IP geolocation error");
  return {
    coords: { lat: data.latitude, lng: data.longitude },
    cityLabel: `${data.city}, ${data.region_code}`,
  };
}

export function useGeolocation(): UseGeolocationResult {
  const [location, setLocation] = useState<GeoLocation | null>(null);
  const [cityLabel, setCityLabel] = useState<string | null>(null);
  const [isApproximate, setIsApproximate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") {
      setLoading(false);
      return;
    }

    /** Silently attempts IP geolocation after GPS fails. */
    const fallbackToIp = async () => {
      try {
        const { coords, cityLabel: label } = await fetchIpLocation();
        console.log("[HADE] IP location acquired:", coords, `(${label})`);
        setLocation(coords);
        setCityLabel(label);
        setIsApproximate(true);
        setError(null);
      } catch (e) {
        console.warn("[HADE] IP geolocation also failed:", e);
        setError("Could not determine your location. Check your connection and reload.");
      } finally {
        setLoading(false);
      }
    };

    // No GPS support — go straight to IP fallback
    if (!navigator.geolocation) {
      console.log("[HADE] navigator.geolocation unavailable, using IP fallback.");
      fallbackToIp();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: GeoLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        console.log("[HADE] GPS location acquired:", coords);
        setLocation(coords);
        setIsApproximate(false);
        // cityLabel stays null — HeroSection will show "Your Location"
        setLoading(false);
      },
      (err) => {
        // GPS denied or unavailable — silently fall back to IP, no hard error
        console.log(
          `[HADE] GPS failed (${err.code}: ${err.message}), falling back to IP geolocation.`
        );
        fallbackToIp();
      },
      {
        enableHighAccuracy: false,
        timeout: 8_000,
        maximumAge: 60_000,
      }
    );
  }, []);

  return { location, cityLabel, isApproximate, error, loading };
}
