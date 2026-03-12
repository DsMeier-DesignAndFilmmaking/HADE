"use client";

import { motion } from "framer-motion";

interface HandsetWrapperProps {
  children: React.ReactNode;
  onBack: () => void;
}

export default function HandsetWrapper({ children, onBack }: HandsetWrapperProps) {
  return (
    // ── Desktop viewport: centres the phone frame ──
    <div className="fixed inset-0 flex items-center justify-center bg-[#050505] overflow-hidden"
      style={{
        backgroundImage:
          "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(245,158,11,0.03) 0%, transparent 70%)",
      }}
    >
      {/* Outer glow ring (decorative) */}
      <motion.div
        className="absolute rounded-[48px] pointer-events-none"
        style={{
          width: "calc(min(calc(100svh - 48px) * 9 / 19.5, 390px) + 2px)",
          height: "calc(min(100svh - 48px, 844px) + 2px)",
          background:
            "linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(255,255,255,0.04) 40%, rgba(0,0,0,0) 100%)",
          filter: "blur(1px)",
        }}
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" as const }}
      />

      {/* ── Phone Frame ── */}
      <div
        className="relative bg-[#0D0D0D] rounded-[44px] border border-white/[0.08] overflow-hidden"
        style={{
          aspectRatio: "9 / 19.5",
          height: "calc(min(100svh - 48px, 844px))",
          boxShadow: [
            "0 0 0 1px rgba(255,255,255,0.04)",
            "0 30px 100px rgba(0,0,0,0.95)",
            "0 0 80px rgba(245,158,11,0.06)",
            "inset 0 0 0 1px rgba(255,255,255,0.02)",
          ].join(", "),
        }}
      >
        {/* ── Dynamic Island ── */}
        <div
          className="absolute top-[14px] left-1/2 -translate-x-1/2 z-50 bg-black rounded-[20px]"
          style={{ width: 126, height: 37 }}
        />

        {/* ── Side bezels (decorative sheen) ── */}
        <div className="absolute inset-y-0 left-0 w-[1px] bg-gradient-to-b from-white/10 via-white/5 to-transparent pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-[1px] bg-gradient-to-b from-white/10 via-white/5 to-transparent pointer-events-none" />

        {/* ── Screen content slot ── */}
        <div className="absolute inset-0 overflow-hidden">
          {children}
        </div>

        {/* ── Home Indicator ── */}
        <button
          onClick={onBack}
          aria-label="Back"
          className="absolute bottom-[8px] left-1/2 -translate-x-1/2 z-50 cursor-pointer group"
          style={{ width: 134, height: 20, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div className="w-full h-[5px] bg-white/25 rounded-full transition-colors group-hover:bg-white/45" />
        </button>
      </div>
    </div>
  );
}
