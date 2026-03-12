"use client";

import { motion } from "framer-motion";
import type { Opportunity } from "@/lib/types";

interface NavigationCardProps {
  opportunity: Opportunity;
}

export default function NavigationCard({ opportunity }: NavigationCardProps) {
  const { venue_name, eta_minutes, distance_meters, category, geo, neighborhood } = opportunity;

  const handleNavigate = () => {
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${geo.lat},${geo.lng}&travelmode=walking`,
      "_blank"
    );
  };

  return (
    <motion.div
      className="w-full bg-hade-card-alt rounded-[24px] overflow-hidden border border-hade-border shadow-[0_10px_16px_rgba(0,0,0,0.6)]"
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.45, ease: "easeOut" as const }}
    >
      {/* ── Venue info ── */}
      <div className="px-5 pt-5 pb-4">
        <span className="text-[10px] font-black uppercase tracking-[1.5px] text-hade-amber">
          {category}
        </span>
        <p className="text-[18px] font-extrabold text-hade-text mt-1 leading-snug">
          {venue_name}
        </p>
        {/* Meta: ETA · distance · neighborhood */}
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          <span className="text-hade-muted-light text-[12px] font-semibold">
            {eta_minutes} min walk
          </span>
          {distance_meters != null && (
            <>
              <span className="text-hade-border text-[8px]">·</span>
              <span className="text-hade-muted text-[12px] font-medium">
                {distance_meters}m
              </span>
            </>
          )}
          {neighborhood && (
            <>
              <span className="text-hade-border text-[8px]">·</span>
              <span className="text-hade-muted text-[12px] font-medium">
                {neighborhood}
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="border-t border-hade-border" />

      {/* ── Full-width navigation CTA ── */}
      <button
        onClick={handleNavigate}
        aria-label={`Start navigation to ${venue_name}`}
        className="w-full py-[14px] bg-hade-amber text-black font-black text-[14px] flex items-center justify-center gap-2 cursor-pointer hover:brightness-110 active:brightness-95 transition-all"
      >
        <NavigationIcon />
        Start Navigation
      </button>
    </motion.div>
  );
}

function NavigationIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 13 13"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M11.5 1.5L1 6L4.5 7.5L6 11.5L11.5 1.5Z" fill="currentColor" />
    </svg>
  );
}
