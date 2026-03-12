"use client";

import { motion } from "framer-motion";
import type { Opportunity } from "@/lib/types";
import { timeAgo } from "@/lib/utils";

interface TrustExplainerProps {
  opportunity: Opportunity;
}

const container = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

export default function TrustExplainer({ opportunity }: TrustExplainerProps) {
  const { primary_signal, neighborhood } = opportunity;

  if (!primary_signal) {
    return (
      <motion.div
        className="max-w-md mx-auto bg-hade-card rounded-2xl p-6 border border-hade-border"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" as const }}
      >
        <p className="text-hade-muted-light text-sm italic text-center">
          New discovery in {neighborhood ?? "the area"}
        </p>
      </motion.div>
    );
  }

  const firstInitial = primary_signal.user_name.charAt(0).toUpperCase();
  const ago = timeAgo(primary_signal.timestamp);

  return (
    <motion.div
      className="max-w-md mx-auto bg-hade-card rounded-2xl p-6 border border-hade-border"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {/* Avatar + name + timestamp */}
      <motion.div className="flex items-center gap-3 mb-4" variants={fadeUp}>
        <div className="w-12 h-12 rounded-full bg-hade-amber flex items-center justify-center flex-shrink-0">
          <span className="text-xl font-black text-black leading-none">
            {firstInitial}
          </span>
        </div>
        <div>
          <p className="text-hade-text font-bold text-base">
            {primary_signal.user_name}
          </p>
          <p className="text-hade-muted text-sm">was here {ago}</p>
        </div>
      </motion.div>

      {/* Freshness indicator */}
      <motion.div className="flex items-center gap-2 mb-4" variants={fadeUp}>
        <motion.span
          className="w-2 h-2 rounded-full bg-hade-green inline-block"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" as const }}
        />
        <span className="text-hade-green text-sm font-medium">
          Verified {ago}
        </span>
      </motion.div>

      {/* Explanatory text */}
      <motion.p
        className="font-[Georgia,serif] italic text-hade-muted-dark text-sm leading-relaxed"
        variants={fadeUp}
      >
        HADE trusts {primary_signal.user_name} because she&apos;s in your social
        graph. Her signal outweighs 10,000 anonymous reviews.
      </motion.p>
    </motion.div>
  );
}
