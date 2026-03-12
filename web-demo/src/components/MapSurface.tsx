"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { Opportunity } from "@/lib/types";
import { USER_LOCATION } from "@/lib/mock-data";

interface MapSurfaceProps {
  opportunity: Opportunity;
  onNavigate: () => void;
}

export default function MapSurface({ opportunity, onNavigate }: MapSurfaceProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  // true when tile requests are 403'd (token URL restriction)
  const [tilesBlocked, setTilesBlocked] = useState(false);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // 1. Initialise map
  useEffect(() => {
    if (!token || !mapContainer.current || mapRef.current) return;

    mapboxgl.accessToken = token;

    const centerLat = (USER_LOCATION.lat + opportunity.geo.lat) / 2;
    const centerLng = (USER_LOCATION.lng + opportunity.geo.lng) / 2;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [centerLng, centerLat],
      zoom: 13.5,
      interactive: false,
      attributionControl: false,
    });

    // Detect tile 403s (token URL restriction on localhost)
    map.on("error", (e) => {
      if (e.error && "status" in e.error && (e.error as { status: number }).status === 403) {
        setTilesBlocked(true);
      }
    });

    map.on("load", () => {
      // User marker
      const userEl = document.createElement("div");
      userEl.className = "hade-user-marker";
      new mapboxgl.Marker({ element: userEl })
        .setLngLat([USER_LOCATION.lng, USER_LOCATION.lat])
        .addTo(map);

      // Venue marker (pulsing amber)
      const venueEl = document.createElement("div");
      venueEl.className = "hade-marker-wrap";
      venueEl.innerHTML = `<div class="hade-marker-ring"></div><div class="hade-marker-core"></div>`;
      new mapboxgl.Marker({ element: venueEl })
        .setLngLat([opportunity.geo.lng, opportunity.geo.lat])
        .addTo(map);

      // Route source
      map.addSource("route-line", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: [
              [USER_LOCATION.lng, USER_LOCATION.lat],
              [opportunity.geo.lng, opportunity.geo.lat],
            ],
          },
        },
      });

      // Glow layer
      map.addLayer({
        id: "route-line-blur",
        type: "line",
        source: "route-line",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#F59E0B", "line-width": 10, "line-blur": 8, "line-opacity": 0.3 },
      });

      // Sharp core
      map.addLayer({
        id: "route-line-layer",
        type: "line",
        source: "route-line",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#F59E0B", "line-width": 3, "line-opacity": 0.9 },
      });

      setMapLoaded(true);
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // 2. Update route + fly-to when opportunity changes
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const map = mapRef.current;
    const coords: [number, number][] = [
      [USER_LOCATION.lng, USER_LOCATION.lat],
      [opportunity.geo.lng, opportunity.geo.lat],
    ];
    const source = map.getSource("route-line") as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData({ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } });
    }
    map.flyTo({
      center: [(USER_LOCATION.lng + opportunity.geo.lng) / 2, (USER_LOCATION.lat + opportunity.geo.lat) / 2],
      zoom: 14, speed: 1.2, curve: 1.42, essential: true,
    });
  }, [opportunity, mapLoaded]);

  // ── No-token fallback ──
  if (!token) {
    return (
      <div className="relative w-full h-full overflow-hidden">
        <GridMapFallback absolute />
        <NavOverlay opportunity={opportunity} onNavigate={onNavigate} />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Inset vignette */}
      <div className="absolute inset-0 z-10 pointer-events-none shadow-[inset_0_0_80px_rgba(0,0,0,0.35)]" />

      {/* Map canvas — hidden behind grid fallback when tiles are blocked */}
      <div ref={mapContainer} className="w-full h-full" />

      {/* City-grid overlay when tiles are 403'd */}
      {tilesBlocked && <GridMapFallback absolute />}

      {/* "Live Context Engine" badge */}
      <motion.div
        className="absolute top-[70px] left-4 z-20 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10"
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4, ease: "easeOut" as const }}
      >
        <span className="text-[10px] uppercase tracking-widest text-hade-amber font-bold">
          Live Context Engine
        </span>
      </motion.div>

      {/* Floating nav card */}
      <NavOverlay opportunity={opportunity} onNavigate={onNavigate} />
    </div>
  );
}

// ── Stylised city-grid fallback (shown when no token or tiles are 403'd) ──
function GridMapFallback({ absolute }: { absolute?: boolean }) {
  return (
    <div
      className={`${absolute ? "absolute inset-0 z-10" : "flex-1"} overflow-hidden`}
      style={{ background: "#0A0A0A" }}
    >
      {/* Street grid — two densities to suggest a city block pattern */}
      <svg
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          {/* Fine grid (minor streets) */}
          <pattern id="minor" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(255,255,255,0.028)" strokeWidth="0.5" />
          </pattern>
          {/* Coarse grid (major streets) */}
          <pattern id="major" width="84" height="84" patternUnits="userSpaceOnUse">
            <path d="M 84 0 L 0 0 0 84" fill="none" stroke="rgba(255,255,255,0.055)" strokeWidth="1" />
          </pattern>
          {/* Amber glow radial behind the route */}
          <radialGradient id="glow" cx="50%" cy="50%" r="35%">
            <stop offset="0%" stopColor="rgba(245,158,11,0.07)" />
            <stop offset="100%" stopColor="rgba(245,158,11,0)" />
          </radialGradient>
        </defs>

        {/* Layer order: minor → major → glow */}
        <rect width="100%" height="100%" fill="url(#minor)" />
        <rect width="100%" height="100%" fill="url(#major)" />
        <rect width="100%" height="100%" fill="url(#glow)" />

        {/* Route line (user top-centre → venue bottom-centre, fixed for demo) */}
        <line
          x1="50%" y1="35%"
          x2="50%" y2="62%"
          stroke="#F59E0B"
          strokeWidth="8"
          strokeLinecap="round"
          strokeOpacity="0.15"
        />
        <line
          x1="50%" y1="35%"
          x2="50%" y2="62%"
          stroke="#F59E0B"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeOpacity="0.85"
        />

        {/* User dot (blue) */}
        <circle cx="50%" cy="35%" r="6" fill="#3B82F6" />
        <circle cx="50%" cy="35%" r="10" fill="none" stroke="#3B82F6" strokeWidth="1.5" strokeOpacity="0.4" />

        {/* Venue dot (amber, pulsing via CSS) */}
        <circle cx="50%" cy="62%" r="7" fill="#F59E0B" className="animate-pulse" />
        <circle cx="50%" cy="62%" r="14" fill="none" stroke="#F59E0B" strokeWidth="1" strokeOpacity="0.3" />
      </svg>
    </div>
  );
}

// ── Floating bottom nav strip ─────────────────────────────
function NavOverlay({
  opportunity,
  onNavigate,
}: {
  opportunity: Opportunity;
  onNavigate: () => void;
}) {
  const { venue_name, eta_minutes, category } = opportunity;

  return (
    <motion.div
      className="absolute bottom-[44px] left-4 right-4 z-20
        bg-black/65 backdrop-blur-xl rounded-[20px] p-4
        flex items-center justify-between border border-white/[0.08]"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.45, ease: "easeOut" as const }}
    >
      <div className="min-w-0 mr-3">
        <p className="text-hade-text font-bold text-[15px] truncate">{venue_name}</p>
        <p className="text-hade-muted text-[11px] font-semibold uppercase tracking-wide mt-0.5">
          {eta_minutes} min &middot; {category}
        </p>
      </div>
      <button
        onClick={onNavigate}
        className="bg-hade-amber text-black font-black text-[13px] px-4 py-2.5 rounded-[12px] flex-shrink-0 cursor-pointer whitespace-nowrap"
      >
        Navigate →
      </button>
    </motion.div>
  );
}
