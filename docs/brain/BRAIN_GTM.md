# BRAIN_GTM.md
## HADE — Go-to-Market Strategy, Personas & Business Model

> **For Claude Code:** Reference this document when building onboarding flows, marketing copy, landing pages, pricing UI, or any user-facing messaging. All copy, personas, and positioning decisions should align with this document. If a feature targets a persona not listed here, flag it.

---

## Target Personas

### Primary: "The Spontaneous Explorer"
- **Demographics:** Urban, 25–38, high curiosity, low routine dependency
- **Behavior:** Already asks friends for recommendations but wants that at scale and speed. Opens 3+ apps when deciding what to do. Closes all of them. Defaults to the same 5 places.
- **Pain:** Paralyzed by choice. Yelp/Google Maps give 1,000 options with no contextual intelligence about *right now*.
- **HADE Promise:** One confident answer in under 90 seconds. No scrolling. No regret.
- **Activation Trigger:** Standing somewhere, unsure what to do next, 2+ hours of free time.

### Secondary: "The Local Mayor"
- **Demographics:** The person in every friend group who always knows the move.
- **Behavior:** Naturally scouts venues, shares recommendations over text, takes pride in knowing the city.
- **Pain:** No scalable way to share their knowledge. Group chats are chaotic. Yelp reviews feel impersonal.
- **HADE Promise:** Your instinct, amplified. When you check in, your network benefits. You become the signal.
- **Activation Trigger:** Just left somewhere great and wants someone to know about it.

### Visitor Persona: "The Insider Tourist"
- **Demographics:** Business traveler or weekend visitor, first time in a city.
- **Behavior:** Genuinely curious but overwhelmed by tourist recommendations. Wants local-feel, not tourist-trap.
- **Pain:** Google results surface the obvious. No trusted local friend to text.
- **HADE Promise:** The feeling of being let in on a secret. City-as-insider, even briefly.
- **Activation Trigger:** 3 free hours in an unfamiliar city with no plan.

### Anti-Persona (We Do NOT Build For)
- **The Planner:** Wants to build itineraries for next month. Researches extensively before committing.
- **The Researcher:** Wants to compare 15 options side by side with filters and reviews.
- **The Content Creator:** Looking for engagement, followers, or content opportunities.

---

## Business Model — Phased Monetization

### Phase 1 — Prove Value (Months 1–18)
**Price:** Free. Zero monetization.
**Goal:** Build trust. Prove the recommendation loop works. Achieve >35% DDR.
**Revenue:** $0. This is deliberate.

### Phase 2 — Venue Partnerships (Months 12–30)
**Model:** Venues pay to be *eligible* for recommendation — not to be featured, but to be verified, current, and contextually surfaceable.
**Positioning:** Think of it as always-on ambient advertising that only fires when the context is right. HADE never promotes a venue that isn't the best contextual fit. Paying only makes a venue *eligible*, never *guaranteed*.
**Pricing:** TBD — likely $50–200/month per venue for verified status + signal visibility.
**Key Constraint:** Paid venue status must NEVER override the scoring algorithm. If it's not the right fit, it doesn't surface. Period.

### Phase 3 — Data Layer Licensing (Year 2–4)
**Model:** City operators, tourism boards, hospitality brands, and transit authorities license the context engine API.
**Use Cases:** Hotel concierge apps, transit recommendation overlays, tourism board "what to do now" widgets.
**Pricing:** API usage-based pricing (per-request or tiered subscriptions).

### Phase 4 — Consumer Premium (Year 3+)
**Model:** Power users in new cities pay for enhanced trust-signal visibility.
**Features:** See exactly which trusted contacts have been where, with what verdict. Extended network depth. Priority signal freshness.
**Pricing:** ~$5–10/month subscription.

---

## Distribution Strategy

### Launch City Selection Criteria
- High density of target persona (25–38, urban, curious)
- Strong existing "local recommendations" culture
- Walkable neighborhoods with diverse venue density
- Not yet saturated by a dominant local discovery app

### Launch Market: TBD (Evaluate: Austin, Denver, Portland, Chicago, Brooklyn)

### Growth Channels (Phase 1 — Organic Only)

**1. Trust Network Viral Loop (Primary)**
- Every check-in creates a signal that benefits the user's network.
- When someone acts on a friend's signal, the friend gets a subtle notification: "Jordan went to the ramen spot you checked into."
- This is the core growth mechanic. It's not a referral program — it's a value loop.

**2. Local Mayor Seeding**
- Identify 50–100 "mayors" in the launch city — people who are already the friend everyone asks.
- Give them early access. Their check-ins seed the trust graph for their entire network.
- This is not influencer marketing. These are real people with real trust. No follower counts.

**3. New City Moment**
- Target people who just moved or are visiting. This is when the pain of "I don't know anyone here" is sharpest.
- Partnerships with relocation services, corporate travel programs, Airbnb hosts.

**4. Word of Mouth (The Product IS the Channel)**
- "How did you find this place?" → "HADE told me to come here."
- The recommendation itself is the marketing. If the product works, every successful moment is a referral.

### Channels We Will NOT Use (Phase 1)
- Paid social ads (misaligned with trust-based brand)
- Influencer partnerships (contradicts anti-popularity stance)
- SEO content marketing (we're not a content company)
- App store optimization gaming (quality over download volume)

---

## Sales Narrative (For Venue Partnerships — Phase 2)

### The Pitch
"Your best customers aren't finding you on Yelp. They're finding you because a friend told them to go. HADE is the digital version of that — a system that surfaces your venue to the right person at the right moment, backed by a real trust signal from someone they know."

### Key Talking Points
- HADE doesn't sell ad space. We sell contextual eligibility.
- Your venue only surfaces when it's genuinely the best fit for that person, that moment.
- The signal that drives visits is real human endorsement, not paid placement.
- You're not paying for impressions. You're paying to be in the consideration set when context is right.

### Venue Objection Handling

| Objection | Response |
|---|---|
| "How is this different from Yelp ads?" | Yelp sells visibility to anyone searching. We surface you to the right person at the right moment, only when a trust signal supports it. |
| "Can I guarantee I'll be recommended?" | No. And that's the point. If we guaranteed placement, the trust would break and the system stops working. |
| "What if no one in the user's network has been here?" | You can still appear through environmental and contextual signals, but trust-backed venues always outrank. Build presence by being great — our system rewards that. |
| "How do I measure ROI?" | We provide verified visit attribution. You'll see exactly how many HADE-driven visits you received. |

---

## Key Metrics for GTM Success

| Metric | Phase 1 Target | Phase 2 Target |
|---|---|---|
| Active users (launch city) | 5,000 | 25,000 |
| Decision-to-Departure Rate | >35% | >40% |
| Trust signal coverage | >40% | >60% |
| Organic invite conversion | >15% | >20% |
| Venue partner count | N/A | 200+ |
| Revenue (monthly) | $0 | $20K+ |

---

## Competitive Positioning Summary

### One-Line Position
"HADE is the confident friend who always knows the move — powered by the people you actually trust."

### Competitive Differentiators

| vs. Google Maps | We don't search. We decide. One answer, not 1,000 results. |
|---|---|
| vs. Yelp | Real trust from real friends, not anonymous stranger reviews. |
| vs. Instagram | Actionable decisions, not aspirational content. |
| vs. Foursquare | Decision output, not activity log. |
| vs. Eventbrite | Spontaneous, not planned. Right now, not next Saturday. |

---

*BRAIN_GTM.md — HADE Knowledge Layer v1.0 — March 2026*