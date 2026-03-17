"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";

import type { Intent, Opportunity, DecideResponse } from "@/lib/types";
import { generateAgenticContent } from "@/lib/agentic";
import { useGeolocation } from "@/hooks/useGeolocation";

import HandsetWrapper from "@/components/HandsetWrapper";
import HeroSection from "@/components/HeroSection";
import IntentSelector from "@/components/IntentSelector";
import ThinkingState from "@/components/ThinkingState";
import RecommendationCard from "@/components/RecommendationCard";
import VenueInfoScreen from "@/components/VenueInfoScreen";
import NavigationCard from "@/components/NavigationCard";
import PivotSection from "@/components/PivotSection";

// Mapbox requires `window` — SSR disabled
const MapSurface = dynamic(() => import("@/components/MapSurface"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-hade-card flex items-center justify-center">
      <span className="text-hade-muted text-sm font-serif italic">Loading engine...</span>
    </div>
  ),
});

type Step =
  | "HERO"
  | "INTENT"
  | "THINKING"
  | "RECOMMENDATION"
  | "INFO"
  | "MAP"
  | "NAVIGATION";

const STEPS: Step[] = [
  "HERO",
  "INTENT",
  "THINKING",
  "RECOMMENDATION",
  "INFO",
  "MAP",
  "NAVIGATION",
];

const slideVariants = {
  initial: (dir: number) => ({
    x: dir > 0 ? "100%" : "-100%",
    opacity: 1,
  }),
  animate: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: { duration: 0.42, ease: [0.32, 0.72, 0, 1] as const },
  },
  exit: (dir: number) => ({
    scale: dir > 0 ? 0.94 : 1.05,
    opacity: 0,
    x: dir > 0 ? "-10%" : "100%",
    transition: { duration: 0.35, ease: [0.32, 0.72, 0, 1] as const },
  }),
};

/** Formats current local time as "Friday 9:14 PM · Your Location" */
function buildContextLabel(cityLabel: string): string {
  const now = new Date();
  const day = now.toLocaleDateString("en-US", { weekday: "long" });
  const time = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${day} ${time} · ${cityLabel}`;
}

export default function Page() {
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [selectedIntent, setIntent] = useState<Intent | null>(null);
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);
  const [generatedPlaybook, setGeneratedPlaybook] = useState<DecideResponse | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  // ── Real browser geolocation (GPS → IP fallback) ─────
  const { location, cityLabel, isApproximate, error: geoError, loading: geoLoading } = useGeolocation();

  const currentStep = STEPS[stepIndex];

  const go = useCallback((target: number) => {
    setDirection(target > stepIndex ? 1 : -1);
    setStepIndex(Math.max(0, Math.min(target, STEPS.length - 1)));
  }, [stepIndex]);

  const handleBack = useCallback(() => go(stepIndex - 1), [go, stepIndex]);
  const handleNext = useCallback(() => go(stepIndex + 1), [go, stepIndex]);

  const handleReset = useCallback(() => {
    setDirection(-1);
    setStepIndex(0);
    setIntent(null);
    setOpportunity(null);
    setGeneratedPlaybook(null);
    setDecisionError(null);
  }, []);

  const handleIntentSelect = useCallback((intent: Intent) => {
    setIntent(intent);
    setDecisionError(null);
    setDirection(1);
    setStepIndex(2);
  }, []);

  const handleThinkingComplete = useCallback(async () => {
    if (!location) {
      // Location never resolved — bounce back to HERO so the error banner is visible
      console.warn("[HADE] Coordinates unavailable at decision time. Returning to start.");
      setDirection(-1);
      setStepIndex(0);
      return;
    }
    const resolved = selectedIntent ?? "drink";

    // ── API call — no mock fallback. Real data or honest empty state. ──
    let playbook = generatedPlaybook;
    if (!playbook) {
      console.log(
        `[HADE] Calling decide: lat=${location.lat} lng=${location.lng} intent=${resolved}`
      );
      playbook = await generateAgenticContent(location.lat, location.lng, resolved);
      if (playbook) {
        setGeneratedPlaybook(playbook);
      } else {
        // Backend unreachable or returned no result — surface an honest error.
        // HADE principle: "Nothing great right now" is valid output.
        setDecisionError(
          "Could not find venues at your current location — check back shortly."
        );
        setDirection(-1);
        setStepIndex(1); // Return to intent selector so the user can retry
        return;
      }
    }

    setOpportunity(playbook.primary);
    setDirection(1);
    setStepIndex(3);
  }, [selectedIntent, location, generatedPlaybook]);

  const handlePivot = useCallback(async (type: "energy" | "distance" | "vibe") => {
    if (type === "vibe") {
        handleReset();
        return;
    }

    // Clear cached playbook so the next run generates fresh agentic content
    setGeneratedPlaybook(null);

    const pivotIntent: Intent = type === "energy" ? "chill" : "eat";
    setIntent(pivotIntent);
    setDirection(-1);
    setStepIndex(2);

    // Small delay so the ThinkingState screen mounts before we resolve
    await new Promise((r) => setTimeout(r, 100));

    if (location) {
      const playbook = await generateAgenticContent(location.lat, location.lng, pivotIntent);
      if (playbook) {
        setGeneratedPlaybook(playbook);
        setOpportunity(playbook.primary);
        return;
      }
    }
    // No mock fallback — surface an honest error and let the user retry.
    setDecisionError(
      "Could not find venues at your current location — check back shortly."
    );
    setDirection(-1);
    setStepIndex(1);
  }, [handleReset, location]);

  // ── Context label for HeroSection ────────────────────
  // cityLabel comes from IP geo (e.g. "Raleigh, NC"); GPS-only sets it to null
  const heroContextLabel = geoLoading
    ? "Locating you…"
    : geoError
    ? "Location unavailable"
    : buildContextLabel(cityLabel ?? "Your Location");

  return (
    <HandsetWrapper onBack={stepIndex === 0 ? undefined : handleBack}>
      {/* ── Approximate-location badge (IP fallback active) ── */}
      {!geoLoading && !geoError && isApproximate && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-[#111] border-b border-white/5 px-4 py-2 text-center">
          <p className="text-hade-muted text-[10px] tracking-wide">
            Using approximate location · Allow GPS for a sharper signal
          </p>
        </div>
      )}

      {/* ── Hard error banner — only shown when both GPS and IP fail ── */}
      {!geoLoading && geoError && (
        <div className="absolute top-0 left-0 right-0 z-50 bg-[#1a0a00] border-b border-amber-900/40 px-4 py-3 text-center">
          <p className="text-hade-amber text-[11px] font-semibold leading-snug">
            {geoError}
          </p>
        </div>
      )}

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentStep}
          custom={direction}
          variants={slideVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="absolute inset-0 w-full h-full bg-[#0D0D0D] overflow-hidden"
        >
          {/* 1. Static Screen: Hero */}
          {currentStep === "HERO" && (
            <HeroSection onStart={handleNext} contextLabel={heroContextLabel} />
          )}

          {/* 2. Static Screen: Intent */}
          {currentStep === "INTENT" && (
            <div className="w-full h-full flex flex-col pt-[80px] px-6">
              {decisionError ? (
                <p className="font-[Georgia,serif] italic text-hade-amber text-base mb-6 leading-snug">
                  {decisionError}
                </p>
              ) : (
                <p className="font-[Georgia,serif] italic text-hade-muted-light text-xl mb-12">
                  What&apos;s the move?
                </p>
              )}
              <IntentSelector onSelect={handleIntentSelect} selectedIntent={selectedIntent} />
            </div>
          )}

          {/* 3. Static Screen: Thinking */}
          {currentStep === "THINKING" && (
            <ThinkingState active onComplete={handleThinkingComplete} />
          )}

          {/* 4. SCROLLABLE: Recommendation Card + Pivot */}
          {currentStep === "RECOMMENDATION" && opportunity && (
            <div className="h-full overflow-y-auto pt-20 pb-32 px-6 no-scrollbar">
               <RecommendationCard
                  opportunity={opportunity}
                  onGo={() => go(5)}
                  onInfo={() => go(4)}
                />
                <div className="mt-8 border-t border-white/5 pt-8">
                    <PivotSection onPivot={handlePivot} />
                </div>
            </div>
          )}

          {/* 5. Static Screen: Detailed Info */}
          {currentStep === "INFO" && opportunity && (
            <VenueInfoScreen
              opportunity={opportunity}
              onBack={() => go(3)}
              onGo={() => go(5)}
            />
          )}

          {/* 6. SCROLLABLE: Map + Navigation + Pivot */}
          {currentStep === "MAP" && opportunity && (
            <div className="h-full overflow-y-auto pb-32 no-scrollbar">
                <MapSurface
                  opportunity={opportunity}
                  userLocation={location ?? undefined}
                  onNavigate={() => go(6)}
                />
                <div className="px-6 pt-8 space-y-6">
                    <NavigationCard opportunity={opportunity} />
                    <div className="pt-8 border-t border-white/5">
                        <PivotSection onPivot={handlePivot} />
                    </div>
                </div>
            </div>
          )}

          {/* 7. Final Step: Active Navigation */}
          {currentStep === "NAVIGATION" && opportunity && (
            <div className="h-full flex flex-col pt-24 px-6 items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-hade-green/20 flex items-center justify-center mb-6">
                <div className="w-4 h-4 rounded-full bg-hade-green animate-pulse" />
              </div>
              <h2 className="font-[Georgia,serif] italic text-2xl text-white mb-2">Live Pathing Active</h2>
              <p className="text-hade-muted text-sm">Proceed to {opportunity.venue_name}</p>
              <button
                onClick={handleReset}
                className="mt-12 text-xs uppercase tracking-widest text-hade-amber font-bold"
              >
                End Session
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </HandsetWrapper>
  );
}
