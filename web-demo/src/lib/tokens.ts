/** HADE design tokens — extracted from BRAIN_UX.md and component stylesheets. */

export const COLORS = {
  bg: "#0D0D0D",
  card: "#1A1A1A",
  cardAlt: "#171717",
  cardRec: "#111111",
  text: "#FAFAF8",
  amber: "#F59E0B",
  green: "#22C55E",
  blue: "#3B82F6",
  red: "#EF4444",
  muted: "#78716C",
  mutedLight: "#A8A29E",
  mutedDark: "#57534E",
  border: "#262626",
  borderLight: "#222222",
  cream: "#F9F7F2",
  creamDark: "#1A1A1A",
} as const;

export const THINKING_LABELS = [
  "Consulting the city...",
  "Synthesizing local signals...",
  "Checking with the neighbors...",
  "Finding your spot...",
] as const;

export const PIVOT_THINKING_LABELS = {
  energy: [
    "Finding a quieter corner...",
    "Scanning for calmer spaces...",
    "Tuning the frequency...",
  ],
  distance: [
    "Looking closer to your spot...",
    "Scanning within 500m...",
    "Finding what's right here...",
  ],
  vibe: [
    "Recalibrating for a new vibe...",
    "Reading the room differently...",
    "Finding a new frequency...",
  ],
} as const;

export const PIVOT_OPTIONS = [
  {
    type: "energy" as const,
    emoji: "\u{1F33F}",
    label: "Too much energy",
    desc: "Find something quieter",
  },
  {
    type: "distance" as const,
    emoji: "\u{1F4CD}",
    label: "Too far away",
    desc: "Look within 500m",
  },
  {
    type: "vibe" as const,
    emoji: "\u21BA",
    label: "Change the vibe",
    desc: "Pick a different intent",
  },
] as const;

export const VIBES = [
  { label: "Solid", icon: "\u{1F525}" },
  { label: "Chill", icon: "\u2728" },
  { label: "Packed", icon: "\u{1F465}" },
  { label: "Too Loud", icon: "\u{1F50A}" },
  { label: "Great Light", icon: "\u{1F56F}\uFE0F" },
  { label: "Dead", icon: "\u{1F4ED}" },
] as const;
