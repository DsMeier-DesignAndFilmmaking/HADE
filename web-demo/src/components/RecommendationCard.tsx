"use client";

import { motion } from "framer-motion";
import type { Opportunity } from "@/lib/types";
import { timeAgo } from "@/lib/utils";

interface RecommendationCardProps {
  opportunity: Opportunity;
  onGo: () => void;
  onInfo: () => void;
}

export default function RecommendationCard({ opportunity, onGo, onInfo }: RecommendationCardProps) {
  const { category, eta_minutes, venue_name, rationale, primary_signal, neighborhood } = opportunity;

  const headline = primary_signal?.comment ?? rationale;
  const firstInitial = primary_signal?.user_name?.charAt(0).toUpperCase() ?? "";

  return (
    <div className="w-full h-full flex flex-col pt-[62px] pb-[28px] px-5 overflow-y-auto">

      {/* ── Recommendation card ── */}
      <motion.div
        className="bg-hade-card-rec rounded-[28px] p-5 border border-[#222] flex-shrink-0"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] as const }}
      >
        {/* Top meta row */}
        <div className="flex items-center justify-between mb-3">
          <span className="uppercase text-[10px] font-black tracking-[1.5px] text-hade-amber">
            {category}
          </span>
          <span className="text-hade-muted text-[10px] font-semibold">
            {eta_minutes}M AWAY
          </span>
        </div>

        {/* Rationale headline */}
        <p className="font-[Georgia,serif] italic text-[20px] text-hade-text leading-7 mb-2">
          {headline}
        </p>

        {/* Venue name */}
        <p className="text-hade-muted-light text-[14px] font-medium mb-5">
          {venue_name}
        </p>

        {/* Trust badge */}
        <div className="bg-hade-card rounded-xl p-3 flex items-center gap-2 mb-5">
          {primary_signal ? (
            <>
              <div className="w-6 h-6 rounded-full bg-hade-amber flex items-center justify-center flex-shrink-0">
                <span className="text-[11px] font-black text-black leading-none">
                  {firstInitial}
                </span>
              </div>
              <p className="text-hade-muted-light text-xs leading-snug">
                <span className="font-bold text-hade-text">{primary_signal.user_name}</span>
                {" "}confirmed the vibe {timeAgo(primary_signal.timestamp)}
              </p>
            </>
          ) : (
            <p className="text-hade-muted-light text-xs italic">
              New discovery in {neighborhood ?? "the area"}
            </p>
          )}
        </div>

        {/* Action row */}
        <div className="flex gap-3">
          <button
            onClick={onInfo}
            className="flex-1 py-3 rounded-xl border border-[#333] text-hade-muted-light font-semibold text-[14px] text-center cursor-pointer hover:border-[#555] hover:text-hade-text active:scale-[0.98] transition-all"
            aria-label={`View details for ${venue_name}`}
          >
            Info
          </button>
          <button
            onClick={onGo}
            className="flex-[2] py-3 rounded-xl bg-hade-amber text-black font-extrabold text-[14px] text-center cursor-pointer hover:brightness-110 active:scale-[0.98] transition-all"
            aria-label={`Go to ${venue_name}`}
          >
            Let&apos;s Go
          </button>
        </div>
      </motion.div>

      {/* ── Inline Trust Explainer ── */}
      {primary_signal && (
        <motion.div
          className="mt-4 bg-hade-card rounded-[20px] p-4 border border-hade-border flex-shrink-0"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.45, ease: "easeOut" as const }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-hade-amber flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-black text-black leading-none">
                {firstInitial}
              </span>
            </div>
            <div>
              <p className="text-hade-text font-bold text-sm">
                {primary_signal.user_name}
              </p>
              <p className="text-hade-muted text-[11px]">
                was here {timeAgo(primary_signal.timestamp)}
              </p>
            </div>
          </div>

          {/* Freshness indicator */}
          <div className="flex items-center gap-2 mb-3">
            <motion.span
              className="w-2 h-2 rounded-full bg-hade-green inline-block"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" as const }}
            />
            <span className="text-hade-green text-[11px] font-medium">
              Verified {timeAgo(primary_signal.timestamp)}
            </span>
          </div>

          <p className="font-[Georgia,serif] italic text-hade-muted-dark text-[12px] leading-relaxed">
            HADE trusts {primary_signal.user_name} because she&apos;s in your social graph.
            Her signal outweighs 10,000 anonymous reviews.
          </p>
        </motion.div>
      )}
    </div>
  );
}
