# BRAIN_UX.md
## HADE — UX Philosophy, Design System & User Journeys

> **For Claude Code:** Reference this document for all UI/UX decisions — component design, screen flows, copy tone, animation behavior, accessibility, and visual styling. Every screen, component, and interaction should reflect the principles here. If a design pattern conflicts with this document, flag it before implementing.

---

## The Anti-Feed Manifesto

HADE's interface is a deliberate rejection of the infinite scroll paradigm. Every UX decision flows from one conviction: **the feeling of confident action is better than the feeling of comprehensive choice.**

---

## Core Design Principles

### 1. Low-Friction > Infinite Feed
The interface requires fewer than 3 taps from open to departure intent. No browsing mode. No explore tab. No search bar on the home screen. Once you're ready, HADE meets you in under 10 seconds.

### 2. Confidence > Exploration Overload
One strong recommendation beats ten mediocre ones. If the system cannot produce a high-confidence suggestion, it says so. "Nothing amazing nearby right now" is a better experience than a padded list of mediocre options.

### 3. Human Feel > Algorithmic Feel
Every recommendation surfaces a human attribution where possible: "Maya was here this afternoon." Never: "Trending in your area." The experience should feel like a text from a friend, not a query result.

### 4. Live > Static
Stale data is worse than no data. HADE shows signals only when they are fresh enough to be actionable. A review from 2019 has zero weight. A check-in from 2 hours ago carries maximum weight.

### 5. Social Proximity > Popularity
A venue with 2 visits from your trusted network outranks a venue with 10,000 anonymous reviews. This is a hard architectural AND visual commitment — social signals are always visually prominent.

### 6. One Thing at a Time
No multi-panel layouts. No comparison views. No split screens. HADE tells you one thing, with one rationale, and one call to action: go or not this one. Swiping reveals alternatives only after the primary is dismissed.

### 7. Empty States Are Honest
When context is weak or signals are sparse, the UI communicates this clearly and gracefully. "Not enough signal right now — check back in an hour" is an acceptable, even respected, outcome.

---

## Design Tokens

### Color Palette
```
--hade-black:        #0D0D0D      // Primary background
--hade-white:        #FAFAF8      // Primary text, cards
--hade-warm-gray:    #A8A29E      // Secondary text, timestamps
--hade-signal-green: #22C55E      // Live signals, active presence
--hade-trust-blue:   #3B82F6      // Trust network indicators
--hade-accent-amber: #F59E0B      // Call-to-action, "Go" buttons
--hade-muted-red:    #EF4444      // Dismissal, closed venues
--hade-surface:      #1A1A1A      // Card surfaces, elevated elements
--hade-overlay:      rgba(0,0,0,0.7)  // Modal overlays
```

### Typography
```
--font-primary:      "Inter", system-ui, sans-serif
--font-display:      "Bricolage Grotesque", system-ui, sans-serif  // Headlines, venue names

--text-xs:    12px / 1.4    // Timestamps, metadata
--text-sm:    14px / 1.5    // Secondary info, distance
--text-base:  16px / 1.5    // Body text, rationale
--text-lg:    20px / 1.3    // Venue names
--text-xl:    28px / 1.2    // Primary recommendation headline
--text-2xl:   36px / 1.1    // Splash/onboarding
```

### Spacing Scale
```
--space-1:  4px
--space-2:  8px
--space-3:  12px
--space-4:  16px
--space-5:  20px
--space-6:  24px
--space-8:  32px
--space-10: 40px
--space-12: 48px
--space-16: 64px
```

### Border Radius
```
--radius-sm:   8px     // Buttons, tags
--radius-md:   12px    // Cards
--radius-lg:   16px    // Modal sheets
--radius-full: 9999px  // Avatars, pills
```

### Shadows
```
--shadow-card:    0 2px 8px rgba(0,0,0,0.15)
--shadow-elevated: 0 8px 24px rgba(0,0,0,0.25)
--shadow-glow:    0 0 20px rgba(34,197,94,0.3)   // Live signal glow
```

### Animation
```
--duration-fast:   150ms
--duration-normal: 250ms
--duration-slow:   400ms
--easing-default:  cubic-bezier(0.4, 0, 0.2, 1)
--easing-bounce:   cubic-bezier(0.34, 1.56, 0.64, 1)  // "Go" button press
```

---

## Vibe Guidelines

### The HADE Feeling
- **Dark, warm, confident.** Not cold-tech. Not neon-startup. Think: a dimly lit bar where the bartender knows you.
- **Minimal chrome.** Borders, dividers, and decorative elements are almost nonexistent. Content breathes.
- **Motion is purposeful.** Things move to convey state changes (new signal arrived, recommendation loading), never to decorate.
- **Text does the work.** No stock photography. No illustrations. No icons where words suffice. When a venue name and a friend's endorsement are on screen, that IS the design.

### Visual Anti-Patterns (Never Do)
- Carousels or horizontal scroll lists
- Star ratings or numerical scores visible to users
- Thumbnails in grid layouts
- Loading skeletons that look like feeds
- Notification badges with counts
- Bottom tab bars with 5+ tabs
- Any element that implies "there's more to browse"

### What the Screen Should Feel Like
- **Home/Decide screen:** A calm, dark surface with one card. One venue name. One rationale. One "Go" action. Like receiving a confident text message.
- **Signal/Check-in:** Quick, almost dismissable. Tap, confirm, done. 3 seconds max. Not a content creation moment.
- **Trust network view:** Intimate. Faces, not follower counts. Recent signals, not profile pages.
- **Empty state:** A breath, not an error. Warm copy. No "something went wrong" energy.

---

## User Journey Maps

### Journey 1: First-Time Core Loop (The Paralyzed Pair)
```
State: Two friends, 7:30pm Friday, outside subway exit. Hungry. No plan. Just closed Yelp.

[1] Open HADE (first time or returning)
    → Location permission prompt (warm, one-line explanation)
    → "Let HADE know where you are so we can find the right spot."

[2] Home screen appears
    → Dark surface. Single question: "What are you up for?"
    → Quick-tap intent: 🍽 Eat · 🍺 Drink · ☕ Chill · 🎵 Scene · 🤷 Anything
    → Optional: group size toggle (solo / 2 / group)

[3] Decision loads (< 800ms after context submitted)
    → Primary card:
       - Venue name (large, display font)
       - Category + distance + ETA ("Italian · 6 min walk")
       - Trust signal: "Jordan was here last week" (with avatar)
       - Rationale: "Lively Friday energy. No reservation needed."
       - CTA button: "Go" (amber, prominent)
    → Subtle swipe hint for alternatives

[4] User taps "Go"
    → Navigation opens (Apple/Google Maps deep link)
    → Moment is logged as acted-on

[5] Post-visit (optional, prompted 2 hours later)
    → "How was Osteria Lupa?" → 👍 / 👎 / skip
    → If 👍: signal emitted to trust network
```

### Journey 2: New City Visitor
```
State: Solo business traveler, first time in Chicago. 3 free hours. Downtown hotel.

[1] Open HADE
    → Detects new city. Warm message: "First time here. We've got you."
    → Falls back to environmental signals + any network overlap

[2] Intent: "Anything" (exploratory mode)

[3] Decision loads
    → Primary card:
       - Activity, not restaurant (afternoon context)
       - "Garfield Park Conservatory · 15 min ride"
       - Trust signal (if available): "2 people in your extended network visited this month"
       - Rationale: "Off the tourist path. Free entry. Beautiful in afternoon light."

[4] User goes → HADE learns from the visit
```

### Journey 3: The Signal Drop (Check-In)
```
State: User just left an amazing ramen spot. Wants to share organically.

[1] Pull-up gesture or notification: "Just left Tanaka Ramen. Worth sharing?"
    → One tap: ✓ Yes
    → Optional: add a note ("the miso is unreal")
    → Done. 3 seconds total.

[2] Signal propagates
    → Friends in trust network who are nearby or looking for food will see this signal attributed to the user.
    → User gets a quiet notification later if someone acted on their signal.
```

### Journey 4: Empty State (No Signal)
```
State: User opens HADE at 3pm Tuesday in a quiet residential neighborhood.

[1] Home screen loads
    → No high-confidence recommendation available
    → Card reads: "Nothing jumping out right now. Check back around 5 when things pick up."
    → Subtle: "Or tell us what you're in the mood for" (intent override)

[2] No shame. No filler. The app respects the user's time enough to say "not yet."
```

---

## Accessibility Standards

### Minimum Requirements (WCAG 2.1 AA)
- All text meets 4.5:1 contrast ratio against background (our dark theme naturally supports this)
- All interactive elements have minimum 44x44pt touch targets
- All images and icons have descriptive `accessibilityLabel` props
- Screen reader support: every screen fully navigable with VoiceOver/TalkBack
- No information conveyed by color alone (signal indicators use icons + color)
- Reduce motion: respect `prefers-reduced-motion` — disable non-essential animations
- Dynamic type support: UI scales cleanly from 85% to 135% system font size

### Interaction Accessibility
- Swipe gestures always have a tap alternative
- Long-press actions are discoverable without long-pressing (visible option or hint)
- Focus order follows visual reading order (top to bottom, left to right)
- Haptic feedback accompanies primary actions (configurable/off for users who prefer)

### Copy Accessibility
- No jargon in primary UI copy. Write at 8th-grade reading level.
- Avoid idioms that don't translate (HADE may expand internationally).
- Error states use plain language, never error codes.

---

## Screen Inventory (Phase 1 MVP)

| Screen | Purpose | Key Elements |
|---|---|---|
| **Decide (Home)** | Core loop — get a recommendation | Intent selector, primary card, swipe for alternatives |
| **Recommendation Detail** | Expanded view of primary suggestion | Venue info, trust signals, map preview, "Go" CTA |
| **Check-In** | Emit a presence signal | Quick confirm, optional note, done in 3 seconds |
| **Trust Network** | View your people and their recent signals | Avatar list, recent check-ins, signal freshness indicators |
| **Profile / Settings** | Account, preferences, privacy controls | Minimal — not a destination screen |
| **Onboarding** | First-time setup | Location permission, contact import (optional), intent calibration |
| **Empty State** | No recommendation available | Warm messaging, check-back-later suggestion |

### Screens We Are NOT Building (Phase 1)
- Search / browse
- Venue listings or directories
- Social feed or timeline
- Review writing or reading
- Achievement / stats dashboard
- Notifications center (signals arrive contextually, not in a feed)

---

## Copy Voice Reference

### Do Say
- "Alex was here two hours ago. You'll want the miso ramen."
- "Nothing great right now — check back around 7."
- "Go. You'll thank us."
- "Jordan went to the spot you shared."
- "First time here. We've got you."

### Don't Say
- "Trending near you based on user activity."
- "Here are 14 options in your area!"
- "Explore our curated picks."
- "Based on your preferences, you might like..."
- "Join 10,000 users who love this spot."
- "You earned a badge!"

### Tone Attributes
| Confident | Commits to one answer — never hedges |
|---|---|
| Warm | Feels like a friend's recommendation, not a query result |
| Current | Speaks in the present tense — "is," not "was" |
| Precise | Specific and useful, never verbose |
| Human | Uses real names and real signals, never algorithmic language |

---

*BRAIN_UX.md — HADE Knowledge Layer v1.0 — March 2026*