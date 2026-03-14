"use client";

import { motion } from "framer-motion";

interface HandsetWrapperProps {
  children: React.ReactNode;
  onBack?: () => void;
}

export default function HandsetWrapper({ children, onBack }: HandsetWrapperProps) {
  return (
    // Outer Container: Stays fixed and dark on desktop, transparent background on mobile
    <div className="fixed inset-0 flex items-center justify-center bg-[#050505] overflow-hidden sm:p-6"
      style={{
        backgroundImage:
          "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(245,158,11,0.03) 0%, transparent 70%)",
      }}
    >
      {/* ── Desktop-Only Glow Ring ── */}
      <motion.div
        className="hidden md:block absolute rounded-[48px] pointer-events-none"
        style={{
          width: "calc(min(calc(100svh - 48px) * 9 / 19.5, 390px) + 2px)",
          height: "calc(min(100svh - 48px, 844px) + 2px)",
          background:
            "linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(255,255,255,0.04) 40%, rgba(0,0,0,0) 100%)",
          filter: "blur(1px)",
        }}
        animate={{ opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* ── Main Container ── */}
      {/* Mobile: Full screen, no rounded corners, no border */}
      {/* Desktop: Centered, fixed aspect ratio, rounded corners, border */}
      <div
        className={`
          relative w-full h-full 
          md:w-auto md:h-[calc(min(100svh-48px,844px))] 
          md:aspect-[9/19.5] 
          md:rounded-[44px] md:border md:border-white/[0.08]
          bg-[#0D0D0D] overflow-hidden transition-all duration-500
        `}
        style={{
          boxShadow: "0 30px 100px rgba(0,0,0,0.95), 0 0 80px rgba(245,158,11,0.06)",
        }}
      >
        {/* ── Dynamic Island: Hidden on mobile (use the actual phone notch) ── */}
        <div
          className="hidden md:block absolute top-[14px] left-1/2 -translate-x-1/2 z-50 bg-black rounded-[20px]"
          style={{ width: 126, height: 37 }}
        />

        {/* ── Side Bezels: Hidden on mobile ── */}
        <div className="hidden md:block absolute inset-y-0 left-0 w-[1px] bg-gradient-to-b from-white/10 via-white/5 to-transparent pointer-events-none" />
        <div className="hidden md:block absolute inset-y-0 right-0 w-[1px] bg-gradient-to-b from-white/10 via-white/5 to-transparent pointer-events-none" />

        {/* ── Screen Content Slot ── */}
        <div className="absolute inset-0 overflow-hidden">
          {children}
        </div>

        {/* ── Home Indicator: Optional on mobile as modern phones have a hardware one ── */}
        <button
          onClick={onBack}
          aria-label="Back"
          className="absolute bottom-[8px] left-1/2 -translate-x-1/2 z-50 cursor-pointer group md:flex hidden"
          style={{ width: 134, height: 20, alignItems: "center", justifyContent: "center" }}
        >
          <div className="w-full h-[5px] bg-white/25 rounded-full transition-colors group-hover:bg-white/45" />
        </button>
      </div>
    </div>
  );
}