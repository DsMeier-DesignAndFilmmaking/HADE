# BRAIN_VISION.md
## HADE — Mission, Values & North Star

> **For Claude Code:** Reference this document for all mission-alignment decisions, feature prioritization, product scoping, and cultural guardrails. If a proposed feature or technical decision conflicts with anything in this file, flag it and explain the tension.

---

## Mission Statement

Restore serendipity to urban life by replacing information overload with confident, context-aware, trust-backed real-world decisions.

HADE exists so that the best moment in any city tonight is never missed because someone was stuck scrolling.

---

## Core Values

### 1. Confidence Over Choice
We deliver one strong recommendation, not ten mediocre ones. If we can't be confident, we say nothing. Silence is better than noise.

### 2. Trust Over Popularity
A signal from someone in your real social network always outranks anonymous crowd data. We will never let volume override proximity.

### 3. Presence Over Performance
We optimize for people being in the real world, not engaging with our app. Time-in-app is an anti-metric. Decision-to-departure is what matters.

### 4. Freshness Over History
A check-in from 2 hours ago is worth more than 10,000 reviews from 2019. Every signal decays. Stale data must never surface.

### 5. Honesty Over Padding
"Nothing great right now — check back around 7" is a valid and respected output. We never fill space with mediocrity.

### 6. Human Over Algorithmic
Recommendations feel like a text from a friend, not a query result. Real names, real signals, real attribution.

---

## 10-Year North Star

> *The city is on your side tonight.*

### Phase 1 — Prove the Loop (Year 1–2)
- One city. One core experience.
- Users open HADE when they don't know what to do next.
- They get one confident suggestion. They go. They're glad they did.
- North Star KPI: >35% Decision-to-Departure Rate at 90-day cohort maturity.

### Phase 2 — Build the Trust Graph (Year 3–4)
- Expand city coverage. Deepen social layer.
- HADE becomes the layer where real social proof lives — not likes, but actual presence signals.
- "Sarah was here 2 hours ago and loves this spot" becomes the standard social currency.

### Phase 3 — Platform Emergence (Year 5–7)
- Third-party venues, curators, and city operators access HADE's context engine via API.
- Hotel concierge apps, transit apps, music venues plug into the decision engine.
- Revenue shifts from venue partnerships to data layer licensing.

### Phase 4 — Urban Infrastructure (Year 8–10)
- HADE becomes the ambient intelligence layer that makes cities legible to humans in real time.
- The data moat (trust graph + verified presence signals) is unreplicable by new entrants.

---

## Non-Negotiables

These are architectural, product, and cultural commitments that **do not bend** under pressure, timeline stress, or growth incentives.

### Product Non-Negotiables
- **Single recommendation output.** The primary UX is one suggestion, not a list. This is a feature, not a limitation.
- **No feeds, no infinite scroll.** HADE is the anti-feed. We reject the engagement-maximization paradigm entirely.
- **No gamification.** No points, badges, streaks, or leaderboards. Presence is the reward.
- **No anonymous reviews.** Every signal is attributable to a real person in your trust network, or it's an environmental/contextual signal.
- **< 3 taps from open to departure intent.** Friction kills the magic.
- **< 800ms recommendation response time.** The system must feel instant.

### Data & Privacy Non-Negotiables
- **Explicit consent from day one.** Social graph data is sensitive. Users must opt in to every layer of sharing.
- **No data selling.** We do not sell user data to third parties. Ever.
- **Signal decay is mandatory.** Every signal has an expiration. We do not hoard stale behavioral data.
- **Trust graph is the moat, not the product.** Users own their relationships. We earn the right to interpret them.

### Cultural Non-Negotiables
- **We are not a social media company.** No follower counts, no content creation for its own sake, no engagement metrics.
- **We are not a search engine.** We consume location data; we don't reproduce it.
- **We optimize for real-world outcomes, not app engagement.** Less time in-app, more time in the city = winning.
- **Popular ≠ right for you, right now.** This principle is embedded in every layer of the system.

### Banned Language (Never Use in UI, Copy, or Marketing)
Trending · Discover · Explore · Popular · Based on your preferences · Users like you · Curated (unless literally human-curated) · Viral · Hot right now · Top-rated · Points · Rewards · Badges

---

## What HADE Is NOT

| We are not... | Why it matters |
|---|---|
| A social media platform | No feeds, no follower counts, no content creation |
| A Google Maps competitor | We consume location data; we don't reproduce it |
| An event listing site | Events are one input signal, not the product |
| A restaurant review aggregator | Aggregated opinion ≠ contextual fit |
| A planning tool | We optimize for the next 2 hours, not next month |
| A popularity engine | Popular ≠ right for you, right now |

---

## The Emotional Contract

- **Opening HADE** → reaching for a trusted friend's opinion
- **Receiving a recommendation** → permission to act
- **Acting on it** → the city is on your side
- **Sharing a signal** → giving a gift, not generating content

---

*BRAIN_VISION.md — HADE Knowledge Layer v1.0 — March 2026*