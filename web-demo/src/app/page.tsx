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

export default function Page() {
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [selectedIntent, setIntent] = useState<Intent | null>(null);
  const [opportunity, setOpportunity] = useState<Opportunity | null>(null);

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
  }, []);

  const handleIntentSelect = useCallback((intent: Intent) => {
    setIntent(intent);
    setDirection(1);
    setStepIndex(2);
  }, []);

  const handleThinkingComplete = useCallback(() => {
    const resolved = selectedIntent ?? "drink";
    const response = mockDecide(resolved);
    setOpportunity(response.primary);
    setDirection(1);
    setStepIndex(3);
  }, [selectedIntent]);

  const handlePivot = useCallback((type: "energy" | "distance" | "vibe") => {
    if (type === "vibe") {
        handleReset();
        return;
    }
    // Return to thinking state for "Recalibration"
    setDirection(-1);
    setStepIndex(2); 
    
    // Simulate engine logic swap
    setTimeout(() => {
        const response = mockDecide(type === "energy" ? "chill" : "eat");
        setOpportunity(response.primary);
    }, 100);
  }, [handleReset]);

  return (
    <HandsetWrapper onBack={stepIndex === 0 ? undefined : handleBack}>
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
          {currentStep === "HERO" && <HeroSection onStart={handleNext} />}

          {/* 2. Static Screen: Intent */}
          {currentStep === "INTENT" && (
            <div className="w-full h-full flex flex-col pt-[80px] px-6">
              <p className="font-[Georgia,serif] italic text-hade-muted-light text-xl mb-12">
                What&apos;s the move?
              </p>
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