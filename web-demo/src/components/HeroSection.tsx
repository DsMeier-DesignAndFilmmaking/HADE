"use client";

import { motion } from "framer-motion";

interface HeroSectionProps {
  onStart: () => void;
}

const container = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: "easeOut" as const },
  },
};

export default function HeroSection({ onStart }: HeroSectionProps) {
  return (
    <div className="w-full h-full flex flex-col pt-[62px] pb-[28px] px-5 overflow-hidden">
      {/* Ambient amber glow */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 40%, rgba(245,158,11,0.09), transparent 70%)",
        }}
        animate={{ opacity: [0.04, 0.1, 0.04] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" as const }}
      />

      {/* Main content — vertically centred in the flex-1 area */}
      <motion.div
        className="relative z-10 flex-1 flex flex-col items-center justify-center text-center gap-4"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {/* HADE brand mark */}
        <motion.p
          className="text-hade-amber font-[family-name:var(--font-bricolage)] text-xs font-bold tracking-[4px] uppercase"
          variants={fadeUp}
        >
          HADE
        </motion.p>

        {/* Tagline */}
        <motion.h1
          className="text-[28px] font-[family-name:var(--font-bricolage)] font-extrabold text-hade-text leading-[1.15]"
          variants={fadeUp}
        >
          The city is on your side tonight.
        </motion.h1>

        {/* Context line */}
        <motion.p
          className="text-hade-muted text-[13px] tracking-wide"
          variants={fadeUp}
        >
          Friday 9:14 PM &middot; Denver, CO &middot; 62&deg;F Clear
        </motion.p>
      </motion.div>

      {/* Tap to Start CTA */}
      <motion.button
        onClick={onStart}
        className="relative z-10 w-full py-[18px] rounded-2xl bg-hade-amber text-black font-black text-[15px] tracking-wide cursor-pointer"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.5, ease: "easeOut" as const }}
        whileTap={{ scale: 0.97 }}
      >
        Tap to Start
      </motion.button>
    </div>
  );
}
