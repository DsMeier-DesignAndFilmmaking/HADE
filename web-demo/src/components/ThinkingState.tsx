"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { THINKING_LABELS } from "@/lib/tokens";

interface ThinkingStateProps {
  active: boolean;
  onComplete: () => void;
}

export default function ThinkingState({ active, onComplete }: ThinkingStateProps) {
  const [labelIndex, setLabelIndex] = useState(0);
  const [cycleCount, setCycleCount] = useState(0);

  const handleComplete = useCallback(() => {
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    if (!active) {
      setLabelIndex(0);
      setCycleCount(0);
      return;
    }

    // 1500ms per label → 4 labels = 6s per cycle; complete after 1 cycle
    const interval = setInterval(() => {
      setLabelIndex((prev) => {
        const next = (prev + 1) % THINKING_LABELS.length;
        if (next === 0) setCycleCount((c) => c + 1);
        return next;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [active]);

  useEffect(() => {
    if (cycleCount >= 1 && active) handleComplete();
  }, [cycleCount, active, handleComplete]);

  if (!active) return null;

  return (
    <div className="w-full h-full flex items-center justify-center px-5 pt-[62px] pb-[28px]">
      <div className="w-full bg-hade-cream rounded-[28px] p-10 flex items-center justify-center min-h-[160px]">
        <AnimatePresence mode="wait">
          <motion.p
            key={labelIndex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: "easeOut" as const }}
            className="text-[#1A1A1A] text-xl font-[Georgia,serif] italic text-center leading-relaxed"
          >
            {THINKING_LABELS[labelIndex]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
