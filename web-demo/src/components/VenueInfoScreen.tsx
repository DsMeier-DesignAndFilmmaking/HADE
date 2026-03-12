"use client";

import { motion } from "framer-motion";
import type { Opportunity } from "@/lib/types";
import { timeAgo } from "@/lib/utils";

interface VenueInfoScreenProps {
  opportunity: Opportunity;
  onGo: () => void;
}

// ── Static per-venue details ─────────────────────────────
// Production: fetched from GET /api/v1/venues/{id}
// Demo: keyed by opportunity.id to keep lib/ untouched
const VENUE_STATIC: Record<
  string,
  {
    address: string;
    price: string;
    closing: string;
    crowd: string;
    vibe_tags: string[];
    about: string;
  }
> = {
  "hade-001": {
    address: "1701 Wynkoop St · LoDo",
    price: "$$",
    closing: "2:00 AM",
    crowd: "Low — a few bar seats open",
    vibe_tags: ["Candlelit", "Cocktail-forward", "Intimate"],
    about:
      "A converted train station great hall that somehow still feels like a secret. The bar runs long and the bartenders know what they're doing. Not the place you stumble on — the place you get sent to.",
  },
  "hade-002": {
    address: "1280 25th St · RiNo",
    price: "$$$",
    closing: "2:00 AM",
    crowd: "3 open seats at the bar",
    vibe_tags: ["Speakeasy", "Low key", "Craft spirits"],
    about:
      "Enter through a bookshelf. Leave with an appreciation for mezcal you didn't have before. Death & Co is the kind of place that makes you feel like you found it — even though it's been here a decade.",
  },
  "hade-003": {
    address: "3160 Tejon St · LoHi",
    price: "$$$",
    closing: "2:00 AM",
    crowd: "Fresh rotation — just opened",
    vibe_tags: ["Hidden door", "Vintage spirits", "Intimate"],
    about:
      "The front is a functioning bookshop. Push the right shelf and you're in one of Denver's most considered cocktail rooms. Williams & Graham treats every drink like an argument worth having.",
  },
  "hade-004": {
    address: "3500 Larimer St · LoDo",
    price: "$$",
    closing: "12:00 AM",
    crowd: "Half full — tables available",
    vibe_tags: ["Late night", "Chinese-American", "Music right"],
    about:
      "Hop Alley does one thing — Chinese-American cooking done without apology — and it does it better than anywhere else late at night. The dan dan noodles are the move. Order two.",
  },
  "hade-005": {
    address: "1037 Broadway · LoDo",
    price: "$",
    closing: "2:00 AM",
    crowd: "Filling up — dancefloor active",
    vibe_tags: ["House music", "Dancefloor", "Cover waived"],
    about:
      "Bar Standard earned its reputation by not trying too hard. DJ Kush runs a proper house set. The sound system is better than it looks from outside. Cover is waived before 11 — which means now.",
  },
  "hade-006": {
    address: "3201 Walnut St · RiNo",
    price: "$",
    closing: "12:00 AM",
    crowd: "Mellow — fire pits lit",
    vibe_tags: ["Outdoor", "Beer garden", "Wind-down"],
    about:
      "Improper City is what Friday night should feel like. Open-air, unpretentious, fire pits going, crowd that came to actually talk to each other. Perfect for when the week needed to end yesterday.",
  },
};

const FALLBACK_STATIC = {
  address: "Denver, CO",
  price: "$$",
  closing: "2:00 AM",
  crowd: "Live signal active",
  vibe_tags: ["Local pick", "Verified"],
  about: "A HADE pick — backed by real context signals from your network.",
};

// ── Component ────────────────────────────────────────────
export default function VenueInfoScreen({ opportunity, onGo }: VenueInfoScreenProps) {
  const {
    id,
    venue_name,
    category,
    eta_minutes,
    distance_meters,
    rationale,
    primary_signal,
    neighborhood,
  } = opportunity;

  const details = VENUE_STATIC[id] ?? FALLBACK_STATIC;
  const firstInitial = primary_signal?.user_name?.charAt(0).toUpperCase() ?? "";

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto pt-[70px] pb-3 px-5">

        {/* Identity block */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" as const }}
        >
          <span className="text-[10px] font-black uppercase tracking-[1.5px] text-hade-amber">
            {category}
          </span>
          <h1 className="font-[Georgia,serif] text-[24px] font-bold text-hade-text leading-tight mt-1">
            {venue_name}
          </h1>
          <div className="flex items-center gap-1.5 mt-2 flex-wrap">
            {neighborhood && (
              <>
                <span className="text-hade-muted-light text-[12px] font-medium">
                  {neighborhood}
                </span>
                <span className="text-hade-border text-[8px]">·</span>
              </>
            )}
            <span className="text-hade-muted-light text-[12px] font-medium">
              {eta_minutes} min walk
            </span>
            {distance_meters != null && (
              <>
                <span className="text-hade-border text-[8px]">·</span>
                <span className="text-hade-muted text-[12px] font-medium">
                  {distance_meters}m away
                </span>
              </>
            )}
          </div>
        </motion.div>

        {/* Vibe tags */}
        <motion.div
          className="flex flex-wrap gap-1.5 mt-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.07, duration: 0.4, ease: "easeOut" as const }}
        >
          {details.vibe_tags.map((tag) => (
            <span
              key={tag}
              className="px-2.5 py-[5px] rounded-full bg-hade-card border border-hade-border text-hade-muted-light text-[11px] font-semibold"
            >
              {tag}
            </span>
          ))}
        </motion.div>

        {/* Live status */}
        <motion.div
          className="mt-4 bg-hade-card rounded-[18px] px-4 py-3 flex items-center gap-3 border border-hade-border"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" as const }}
        >
          <motion.div
            className="w-2 h-2 rounded-full bg-hade-green flex-shrink-0"
            animate={{ scale: [1, 1.35, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" as const }}
          />
          <div className="flex-1 min-w-0">
            <p className="text-hade-text text-[13px] font-bold leading-none">Open now</p>
            <p className="text-hade-muted text-[11px] mt-0.5 truncate">{details.crowd}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-hade-muted text-[10px] uppercase tracking-wide">Closes</p>
            <p className="text-hade-text text-[12px] font-semibold">{details.closing}</p>
          </div>
        </motion.div>

        {/* About the venue */}
        <motion.div
          className="mt-5"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.13, duration: 0.4, ease: "easeOut" as const }}
        >
          <SectionLabel>About</SectionLabel>
          <p className="font-[Georgia,serif] italic text-hade-muted-light text-[14px] leading-relaxed mt-2">
            {details.about}
          </p>
        </motion.div>

        {/* Why HADE chose it */}
        <motion.div
          className="mt-5"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16, duration: 0.4, ease: "easeOut" as const }}
        >
          <SectionLabel>Why right now</SectionLabel>
          <div className="mt-2 bg-hade-card rounded-[18px] p-4 border border-hade-border">
            <p className="font-[Georgia,serif] italic text-hade-text text-[14px] leading-relaxed">
              &ldquo;{rationale}&rdquo;
            </p>
          </div>
        </motion.div>

        {/* Trust signal */}
        <motion.div
          className="mt-5"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.19, duration: 0.4, ease: "easeOut" as const }}
        >
          <SectionLabel>Social signal</SectionLabel>
          {primary_signal ? (
            <div className="mt-2 bg-hade-card rounded-[18px] p-4 border border-hade-border">
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full bg-hade-amber flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[14px] font-black text-black leading-none">
                    {firstInitial}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-hade-text font-bold text-[13px]">
                      {primary_signal.user_name}
                    </p>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-hade-green" />
                      <span className="text-hade-green text-[10px] font-semibold">
                        {timeAgo(primary_signal.timestamp)}
                      </span>
                    </div>
                  </div>
                  <p className="font-[Georgia,serif] italic text-hade-muted-light text-[13px] mt-1.5 leading-snug">
                    &ldquo;{primary_signal.comment}&rdquo;
                  </p>
                  <div className="flex items-center gap-1 mt-2.5">
                    <span className="text-[11px] text-hade-blue font-semibold">
                      In your social graph
                    </span>
                    <span className="text-hade-border text-[8px]">·</span>
                    <span className="text-[11px] text-hade-muted">
                      Outweighs 10K reviews
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-2 bg-hade-card rounded-[18px] p-4 border border-hade-border">
              <p className="text-hade-muted-light text-[13px] leading-snug">
                Environmental context signal — fresh enough to act on.
                {neighborhood ? ` New to your network in ${neighborhood}.` : ""}
              </p>
            </div>
          )}
        </motion.div>

        {/* Details table */}
        <motion.div
          className="mt-5"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.4, ease: "easeOut" as const }}
        >
          <SectionLabel>Details</SectionLabel>
          <div className="mt-2 bg-hade-card rounded-[18px] border border-hade-border overflow-hidden">
            <DetailRow label="Address" value={details.address} />
            <DetailRow label="Price"   value={details.price}   divider />
            <DetailRow label="Closes"  value={details.closing} divider />
            <DetailRow label="Walk"    value={`${eta_minutes} min · ${distance_meters}m`} divider />
          </div>
        </motion.div>

        {/* Bottom spacer before sticky CTA */}
        <div className="h-4" />
      </div>

      {/* ── Sticky CTA ── */}
      <motion.div
        className="flex-shrink-0 px-5 pt-3 pb-[32px] bg-[#0D0D0D] border-t border-hade-border"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.28, duration: 0.35, ease: "easeOut" as const }}
      >
        <motion.button
          onClick={onGo}
          className="w-full py-[15px] bg-hade-amber text-black font-black text-[15px] rounded-[16px] cursor-pointer hover:brightness-110 transition-all"
          whileTap={{ scale: 0.98 }}
        >
          Let&apos;s Go →
        </motion.button>
      </motion.div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-black uppercase tracking-[1.5px] text-hade-muted">
      {children}
    </p>
  );
}

function DetailRow({
  label,
  value,
  divider = false,
}: {
  label: string;
  value: string;
  divider?: boolean;
}) {
  return (
    <>
      {divider && <div className="border-t border-hade-border" />}
      <div className="flex items-center gap-3 px-4 py-[11px]">
        <span className="text-hade-muted text-[12px] font-semibold w-[58px] flex-shrink-0">
          {label}
        </span>
        <span className="text-hade-text text-[13px] font-medium">{value}</span>
      </div>
    </>
  );
}
