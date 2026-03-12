"use client";

import { motion } from "framer-motion";
import { PIVOT_OPTIONS } from "@/lib/tokens";

interface PivotSectionProps {
  onPivot: (type: "energy" | "distance" | "vibe") => void;
}

const container = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const row = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

export default function PivotSection({ onPivot }: PivotSectionProps) {
  return (
    <div className="max-w-md mx-auto">
      {/* Header */}
      <div className="text-center mb-5">
        <p className="font-[Georgia,serif] italic text-xl font-extrabold text-hade-text">
          Not the move?
        </p>
        <p className="text-hade-muted text-sm mt-1">
          Tell HADE what&apos;s off.
        </p>
      </div>

      {/* Options card */}
      <motion.div
        className="bg-hade-cream rounded-[24px] p-6"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {PIVOT_OPTIONS.map((option, index) => (
          <motion.div key={option.type} variants={row}>
            <button
              onClick={() => onPivot(option.type)}
              className="w-full flex items-center gap-4 py-3 cursor-pointer text-left hover:opacity-80 transition-opacity"
            >
              <span className="text-2xl flex-shrink-0">{option.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[#1A1A1A] text-base">
                  {option.label}
                </p>
                <p className="text-sm text-[#57534E]">{option.desc}</p>
              </div>
              <span className="text-[#1A1A1A] text-xl font-light flex-shrink-0">
                &rsaquo;
              </span>
            </button>
            {index < PIVOT_OPTIONS.length - 1 && (
              <div className="border-b border-[#E7E5E0] mx-1" />
            )}
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
