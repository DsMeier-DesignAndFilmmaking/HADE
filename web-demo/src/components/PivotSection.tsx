"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PIVOT_OPTIONS } from "@/lib/tokens";

interface PivotSectionProps {
  onPivot: (type: "energy" | "distance" | "vibe") => void;
}

export default function PivotSection({ onPivot }: PivotSectionProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    /* Ensure the parent container of this component in your layout 
       has 'relative' and 'overflow-hidden' 
    */
    <>
      {/* 1. CONTAINED TRIGGER BUTTON */}
      <div className="absolute bottom-8 left-0 w-full px-6 z-40 pointer-events-none">
        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          onClick={() => setIsOpen(true)}
          className="pointer-events-auto w-full py-4 bg-black text-white rounded-full font-medium shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 hover:bg-zinc-900"
        >
          <span>Not the move?</span>
          <span className="opacity-40 text-[10px] uppercase tracking-[0.15em] font-bold">Adjust Vibe</span>
        </motion.button>
      </div>

      {/* 2. IN-CONTAINER BOTTOM SHEET */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop: Absolute to parent, not fixed to screen */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/30 backdrop-blur-[2px] z-50 rounded-[inherit]"
            />

            {/* The Sheet: Matches parent width via absolute 100% */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="absolute bottom-0 left-0 w-full bg-[#F9F7F2] rounded-t-[32px] z-[60] shadow-2xl border-t border-black/5"
            >
              {/* Tactical Drag Handle */}
              <div className="w-10 h-1 bg-black/10 rounded-full mx-auto mt-3 mb-1" />

              <div className="px-6 pt-4 pb-10">
                <header className="text-center mb-6">
                  <h2 className="font-[Georgia,serif] italic text-2xl font-medium text-hade-text">
                    Not the move?
                  </h2>
                </header>

                <div className="space-y-2">
                  {PIVOT_OPTIONS.map((option, index) => (
                    <motion.button
                      key={option.type}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => {
                        onPivot(option.type);
                        setIsOpen(false);
                      }}
                      className="group w-full flex items-center gap-4 p-4 bg-white/60 rounded-[22px] text-left border border-black/[0.03] active:bg-white/90 transition-all shadow-sm"
                    >
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-lg shadow-inner border border-black/5">
                        {option.emoji}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-[#1A1A1A] text-[14px] leading-none mb-1">
                          {option.label}
                        </p>
                        <p className="text-[11px] text-[#57534E] leading-tight">
                          {option.desc}
                        </p>
                      </div>
                      <span className="text-hade-muted group-hover:text-hade-amber transition-colors">
                        &rsaquo;
                      </span>
                    </motion.button>
                  ))}
                </div>

                <p className="text-center text-[9px] text-hade-muted mt-8 uppercase tracking-[0.25em] font-bold opacity-60">
                  Agentic Recalibration
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}