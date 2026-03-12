"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";

import type { Intent, Opportunity } from "@/lib/types";
import { mockDecide } from "@/lib/mock-data";

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
      <span className="text-hade-muted text-sm">Loading map…</span>
    </div>
  ),
});

// ─── Step Machine ─────────────────────────────────────────────────────────────
// HERO → INTENT → THINKING → RECOMMENDATION → INFO → MAP → NAVIGATION
type Step =
  | "HERO"
  | "INTENT"
  | "THINKING"
  | "RECOMMENDATION"
  | "INFO"
  | "MAP"
  | "NAVIGATION";

const STEPS: Step[] = [
  "HERO",          // 0
  "INTENT",        // 1
  "THINKING",      // 2
  "RECOMMENDATION",// 3
  "INFO",          // 4
  "MAP",           // 5
  "NAVIGATION",    // 6
];

// ─── iOS-style slide + scale transition ──────────────────────────────────────
const slideVariants = {
  initial: (dir: number) => ({
    x: dir > 0 ? "100%" : "-100%",
    opacity: 1,
  }),
  animate: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: { duration: 0.38, ease: [0.32, 0.72, 0, 1] as const },
  },
  exit: (dir: number) => ({
    scale: dir > 0 ? 0.94 : 1,
    opacity: dir > 0 ? 0.5 : 1,
    x: dir > 0 ? "-4%" : "100%",
    transition: { duration: 0.32, ease: [0.32, 0.72, 0, 1] as const },
  }),
};

// ─── NavigationScreen ────────────────────────────────────────────────────────
function NavigationScreen({
  opportunity,
  onPivot,
}: {
  opportunity: Opportunity;
  onPivot: (type: "energy" | "distance" | "vibe") => void;
}) {
  return (
    <div className="w-full h-full flex flex-col pt-[70px] pb-[32px] px-5 overflow-y-auto">
      {/* Confirmation header */}
      <motion.div
        className="mb-5"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" as const }}
      >
        <div className="flex items-center gap-2 mb-1.5">
          <span className="w-[18px] h-[18px] rounded-full bg-hade-green inline-flex items-center justify-center flex-shrink-0">
            <svg width="9" height="7" viewBox="0 0 9 7" fill="none" aria-hidden="true">
              <path
                d="M1 3.5L3.2 5.8L8 1"
                stroke="#0D0D0D"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <span className="text-hade-green text-[11px] font-bold uppercase tracking-wider">
            Destination set
          </span>
        </div>
        <p className="font-[Georgia,serif] italic text-hade-text text-[22px] leading-tight">
          You&apos;re set.
        </p>
      </motion.div>

      <NavigationCard opportunity={opportunity} />

      <div className="mt-5">
        <PivotSection onPivot={onPivot} />
      </div>
    </div>
  );
}

// ─── IntentScreen ─────────────────────────────────────────────────────────────
function IntentScreen({
  onSelect,
  selectedIntent,
}: {
  onSelect: (intent: Intent) => void;
  selectedIntent: Intent | null;
}) {
  return (
    <div className="w-full h-full flex flex-col pt-[70px] pb-[32px] px-5">
      <motion.p
        className="font-[Georgia,serif] italic text-hade-muted-light text-lg mb-8"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" as const }}
      >
        What&apos;s the move?
      </motion.p>
      <div className="flex-1 flex items-center">
        <IntentSelector onSelect={onSelect} selectedIntent={selectedIntent} />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Page() {
  const [stepIndex, setStepIndex]     = useState(0);
  const [direction, setDirection]     = useState(1);
  const [selectedIntent, setIntent]   = useState<Intent | null>(null);
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);

  const currentStep = STEPS[stepIndex];

  // ── Core navigator ──
  const go = useCallback((target: number) => {
    setDirection(target > stepIndex ? 1 : -1);
    setStepIndex(Math.max(0, Math.min(target, STEPS.length - 1)));
  }, [stepIndex]);

  const handleBack  = useCallback(() => go(stepIndex - 1), [go, stepIndex]);
  const handleNext  = useCallback(() => go(stepIndex + 1), [go, stepIndex]);

  const handleReset = useCallback(() => {
    setDirection(-1);
    setStepIndex(0);
    setIntent(null);
    setOpportunity(null);
  }, []);

  // ── Intent selected → THINKING (2) ──
  const handleIntentSelect = useCallback((intent: Intent) => {
    setIntent(intent);
    setDirection(1);
    setStepIndex(2);
  }, []);

  // ── Thinking complete → RECOMMENDATION (3) ──
  const handleThinkingComplete = useCallback(() => {
    const resolved = selectedIntent ?? "drink";
    const response = mockDecide(resolved);
    setOpportunity(response.primary);
    setDirection(1);
    setStepIndex(3);
  }, [selectedIntent]);

  // ── "Info" on recommendation → INFO (4) ──
  const handleInfo = useCallback(() => {
    setDirection(1);
    setStepIndex(4);
  }, []);

  // ── "Let's Go" on recommendation or info → MAP (5) ──
  const handleGo = useCallback(() => {
    setDirection(1);
    setStepIndex(5);
  }, []);

  // ── "Navigate →" in map overlay → NAVIGATION (6) ──
  const handleNavigate = useCallback(() => {
    setDirection(1);
    setStepIndex(6);
  }, []);

  // ── Pivot ──
  const handlePivot = useCallback(
    (type: "energy" | "distance" | "vibe") => {
      if (type === "vibe") {
        handleReset();
        return;
      }
      const altIntent: Intent = type === "energy" ? "chill" : "eat";
      setIntent(altIntent);
      setDirection(-1);
      setStepIndex(2); // back to THINKING
    },
    [handleReset]
  );

  // ── Home Indicator: back one step (reset from HERO) ──
  const handleHomeIndicator = useCallback(() => {
    if (stepIndex === 0) return;
    handleBack();
  }, [stepIndex, handleBack]);

  return (
    <HandsetWrapper onBack={handleHomeIndicator}>
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentStep}
          custom={direction}
          variants={slideVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="absolute inset-0 w-full h-full bg-[#0D0D0D]"
        >
          {currentStep === "HERO" && (
            <HeroSection onStart={handleNext} />
          )}

          {currentStep === "INTENT" && (
            <IntentScreen
              onSelect={handleIntentSelect}
              selectedIntent={selectedIntent}
            />
          )}

          {currentStep === "THINKING" && (
            <ThinkingState active onComplete={handleThinkingComplete} />
          )}

          {currentStep === "RECOMMENDATION" && opportunity && (
            <RecommendationCard
              opportunity={opportunity}
              onGo={handleGo}
              onInfo={handleInfo}
            />
          )}

          {currentStep === "INFO" && opportunity && (
            <VenueInfoScreen
              opportunity={opportunity}
              onGo={handleGo}
            />
          )}

          {currentStep === "MAP" && opportunity && (
            <MapSurface
              opportunity={opportunity}
              onNavigate={handleNavigate}
            />
          )}

          {currentStep === "NAVIGATION" && opportunity && (
            <NavigationScreen
              opportunity={opportunity}
              onPivot={handlePivot}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </HandsetWrapper>
  );
}
