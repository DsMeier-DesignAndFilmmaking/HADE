"use client";

import { motion } from "framer-motion";
import { PIVOT_OPTIONS } from "@/lib/tokens";

interface PivotSectionProps {
  onPivot: (type: "energy" | "distance" | "vibe") => void;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const row = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { 
      duration: 0.5, 
      // Add 'as const' right here
      ease: [0.19, 1, 0.22, 1] as const 
    },
  },
};

export default function PivotSection({ onPivot }: PivotSectionProps) {
  return (
    <div className="w-full px-6 py-12">
      {/* Editorial Header */}
      <div className="text-center mb-8">
        <motion.p 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          className="font-[Georgia,serif] italic text-2xl font-medium text-hade-text mb-2"
        >
          Not the move?
        </motion.p>
        <motion.p 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-hade-muted text-sm tracking-wide"
        >
          Tell HADE what&apos;s missing from the vibe.
        </motion.p>
      </div>

      {/* Recalibration Container */}
      <motion.div
        className="bg-[#F9F7F2] rounded-[28px] p-2 shadow-xl"
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true }}
      >
        {PIVOT_OPTIONS.map((option, index) => (
          <motion.div key={option.type} variants={row}>
            <button
              onClick={() => onPivot(option.type)}
              className="group w-full flex items-center gap-4 p-4 rounded-[20px] cursor-pointer text-left hover:bg-black/[0.03] transition-all active:scale-[0.98]"
            >
              {/* Emoji/Icon circle */}
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-xl shadow-sm border border-black/5">
                {option.emoji}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[#1A1A1A] text-[15px] leading-tight mb-0.5">
                  {option.label}
                </p>
                <p className="text-xs text-[#57534E] leading-relaxed">
                  {option.desc}
                </p>
              </div>

              <span className="text-[#A8A29E] text-2xl font-light group-hover:text-hade-amber transition-colors pr-2">
                &rsaquo;
              </span>
            </button>
            
            {/* Divider logic */}
            {index < PIVOT_OPTIONS.length - 1 && (
              <div className="h-[1px] bg-[#E7E5E0] mx-6 my-1 opacity-60" />
            )}
          </motion.div>
        ))}
      </motion.div>
      
      {/* Fine Print / Context */}
      <p className="text-center text-[10px] text-hade-muted mt-8 uppercase tracking-[0.2em] font-medium">
        Recalibrating Agentic Logic
      </p>
    </div>
  );
}