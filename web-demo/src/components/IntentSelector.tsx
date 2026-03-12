"use client";

import { motion } from "framer-motion";
import type { Intent } from "@/lib/types";

const INTENTS: { label: string; value: Intent; emoji: string }[] = [
  { label: "EAT",   value: "eat",   emoji: "🍜" },
  { label: "DRINK", value: "drink", emoji: "🍸" },
  { label: "CHILL", value: "chill", emoji: "🌿" },
  { label: "SCENE", value: "scene", emoji: "🎶" },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const chip = {
  hidden: { opacity: 0, scale: 0.88 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.35, ease: "easeOut" as const },
  },
};

interface IntentSelectorProps {
  onSelect: (intent: Intent) => void;
  selectedIntent: Intent | null;
}

export default function IntentSelector({ onSelect, selectedIntent }: IntentSelectorProps) {
  return (
    <motion.div
      className="w-full grid grid-cols-2 gap-3"
      variants={container}
      initial="hidden"
      animate="show"
    >
      {INTENTS.map((intent) => {
        const isSelected = selectedIntent === intent.value;
        return (
          <motion.button
            key={intent.value}
            variants={chip}
            whileTap={{ scale: 0.96 }}
            onClick={() => onSelect(intent.value)}
            className={`flex flex-col items-start gap-2 rounded-2xl px-4 py-7 cursor-pointer transition-colors ${
              isSelected
                ? "bg-hade-amber border border-hade-amber"
                : "bg-hade-card border border-hade-border"
            }`}
          >
            <span className="text-2xl leading-none">{intent.emoji}</span>
            <span
              className={`uppercase font-extrabold text-sm tracking-wider ${
                isSelected ? "text-[#0D0D0D]" : "text-hade-text"
              }`}
            >
              {intent.label}
            </span>
          </motion.button>
        );
      })}
    </motion.div>
  );
}
