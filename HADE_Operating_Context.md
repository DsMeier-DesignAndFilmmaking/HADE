# HADE Operating Context
### Hyperlocal Agentic Decision Engine — Master Operating Document
*Version 1.0 — Confidential Internal Reference*

---

## PART I: VISION & STRATEGIC INTENT

### Problem Statement

Modern cities are drowning in information but starving for presence. People stand on street corners, heads buried in phones, paralyzed by infinite options, endless reviews, and feeds optimized for engagement rather than experience. The tools we built to help us explore have made us worse at exploring.

Three forces converged to create this crisis:

1. **Information overload** — Yelp, Google Maps, and TripAdvisor surface thousands of options with no contextual intelligence about *right now*
2. **Social disconnection** — We've replaced spontaneous human discovery ("you have to try this place") with anonymous crowd data stripped of trust
3. **Platform misalignment** — Existing platforms optimize for time-on-app, not quality of real-world decision

The result: people in vibrant cities default to the same five places. Serendipity is dying. Cities feel smaller.

### Core Thesis

**The best decision in the city is not the most popular one — it's the most contextually right one.**

HADE is a Hyperlocal Agentic Decision Engine that synthesizes real-time context (time, weather, energy level, who you're with, where you are) with trust-weighted social signals to produce a *single confident recommendation* rather than a ranked list.

This is not search. This is not discovery. This is **decision support** — the trusted friend who just says: *go here, now, you won't regret it.*

### What We Are NOT Building

| We are not... | Why it matters to say this |
|---|---|
| A social media platform | No feeds, no follower counts, no content creation for its own sake |
| A Google Maps competitor | We consume location data; we don't reproduce it |
| Another event listing site | Events are one input signal, not the product |
| A restaurant review aggregator | Aggregated opinion does not equal contextual fit |
| A planning tool | We optimize for the next 2 hours, not next month's itinerary |
| A popularity engine | Popular does not mean right for you, right now |

### Long-Term Ambition (5–10 Year Horizon)

**Year 1–2:** Prove the core loop in one city. Users open HADE when they don't know what to do next. They get one confident suggestion. They go. They're glad they did.

**Year 3–4:** Expand the trust graph. HADE becomes the layer where real social proof lives — not likes, but actual presence signals ("Sarah was here 2 hours ago and loves this spot").

**Year 5–7:** Platform play. Third-party venues, curators, and city operators tap into HADE's context engine via API to surface the right offer at the right moment.

**Year 8–10:** HADE becomes urban infrastructure — the ambient intelligence layer that makes cities legible to the humans moving through them in real time.

### Platform vs. App Positioning

HADE is a **platform masquerading as an app**.

The consumer app is the beachhead — the product that proves the concept and builds the trust graph. But the endgame is an engine that other surfaces (hotel concierge apps, transit apps, music venue check-ins) plug into to deliver contextual moments.

The data moat is the trust graph. Every verified visit, every shared moment, every signal of real-world presence compounds over time into something no new entrant can replicate.

### Business Model Hypothesis

**Phase 1 — Prove Value (Free):** Zero monetization. Build trust. Prove the recommendation loop works.

**Phase 2 — Venue Partnerships:** Venues pay to be *eligible* for recommendation — not to be featured, but to be verified, current, and contextually surfaceable. Think of it as always-on ambient advertising that only fires when the context is right.

**Phase 3 — Data Layer Licensing:** City operators, tourism boards, hospitality brands, and transit authorities license the context engine to surface intelligent moments in their own products.

**Phase 4 — Consumer Premium:** Power users in new cities pay for enhanced trust-signal visibility — seeing exactly which trusted contacts have been where, with what verdict.

### Target Early Adopters

**Primary:** Urban explorers aged 25–38, high curiosity, low routine dependency. People who already ask friends for recommendations but want that at scale and speed. Visitors to new cities who want insider confidence, not tourist traps.

**Secondary:** Local "mayors" — the people in every friend group who always know the move. HADE gives them a tool that matches their instinct.

**Anti-persona:** Planners, researchers, people who want to build itineraries. This is not their product.

---

## PART II: SYSTEM ARCHITECTURE OVERVIEW

### The Hyperlocal Agentic Decision Engine

HADE is not a recommender system. Recommender systems find content you might like based on past behavior. HADE finds the *optimal real-world action* for a specific person in a specific moment. The unit of output is not a list — it is a **confident moment-specific decision**.

### Core Components

**1. Context Engine**
The Context Engine is the sensory layer. It continuously aggregates and interprets:
- Geolocation (precise, block-level)
- Temporal signals (time of day, day of week, proximity to meal/activity windows)
- Weather conditions (current + 2-hour forecast)
- User energy/intent state (inferred or declared)
- Group composition (solo, couple, group, kids present)
- Session history (what was surfaced, what was acted on)

The Context Engine produces a **ContextState** object that is the primary filter for all downstream recommendation logic.

**2. Social Graph & Trust Layer**
Raw popularity is noise. The Trust Layer re-weights all signals by social proximity. A visit by someone in your second-degree network carries 10x the weight of an anonymous review from a stranger.

Trust is built through:
- Verified physical presence (check-in events)
- Reciprocal engagement patterns
- Temporal freshness (recent signals weight higher)
- Consistency of signal sender over time

The output is a **TrustScore** for each venue/moment relative to the requesting user.

**3. Signal Aggregator**
Ingests and normalizes signals across all data sources into a common schema. Signals are categorized as:

| Signal Type | Examples | Decay Rate |
|---|---|---|
| Live Presence | Active check-ins, live venue busyness | Minutes |
| Recent Social | Friend was here 3 hours ago | Hours |
| Environmental | Weather, events nearby, transit disruptions | Hours |
| Behavioral | User's past session actions | Days |
| Ambient Trust | Aggregate network endorsement | Weeks |
| Static Context | Venue category, hours, price range | Months |

**4. Ranking & Scoring System**
The Scoring System takes the filtered, trust-weighted signal set and produces an **Opportunity Score** for each candidate moment. This is not a star rating — it is a contextual fit score for this user, in this state, right now.

Scoring philosophy:
- Trust signals multiply, not add
- Recency is exponentially weighted
- Network proximity is the strongest amplifier
- Novelty is rewarded (unseen outranks seen)
- Confidence floor: if no signal is strong enough, surface nothing rather than surface noise

**5. Decision Layer**
The final layer converts the ranked opportunity set into a **single primary recommendation** with a human-readable rationale. The output includes: what, where, why now, and what trusted signal supports it.

### Inputs & Outputs

**Inputs:**
- User geolocation (real-time)
- User profile + preference history
- Social graph (friend network, visit history)
- Venue database (static + dynamic)
- External API signals (weather, events, transit)
- Real-time presence data (check-ins, crowdsourced busyness)

**Outputs:**
- Primary Recommendation (single Opportunity object)
- Rationale string (human-readable, trust-attributable)
- Fallback set (2–3 alternatives if primary is dismissed)
- ContextState snapshot (for logging and learning)

### What Makes This Different from Recommender Systems

| Recommender Systems | HADE |
|---|---|
| Optimizes for engagement | Optimizes for real-world action quality |
| Learns from clicks and views | Learns from physical presence and post-visit signal |
| Surfaces content ranked by predicted preference | Surfaces one decision ranked by contextual fit |
| Social layer is optional/cosmetic | Social trust is the core ranking signal |
| Output is a list | Output is a moment |
| Deployed on historical data | Deployed on live context |

---

## PART III: UX PHILOSOPHY & DESIGN PRINCIPLES

### The Anti-Feed Manifesto

HADE's interface is a deliberate rejection of the infinite scroll paradigm. Every UX decision flows from a single conviction: **the feeling of confident action is better than the feeling of comprehensive choice.**

### Core Design Principles

**1. Low-Friction > Infinite Feed**
The interface should require fewer than 3 taps from open to departure intent. No browsing mode. No explore tab. If the user is exploring, they're not ready — but once they're ready, HADE meets them in under 10 seconds.

**2. Confidence > Exploration Overload**
One strong recommendation beats ten mediocre ones. If the system cannot produce a high-confidence suggestion, it says so. "Nothing amazing nearby right now" is a better experience than a padded list of mediocre options.

**3. Human Feel > Algorithmic Feel**
Every recommendation surfaces a human attribution where possible: "Maya was here this afternoon." Not: "Trending in your area." The experience should feel like a text from a friend, not a query result.

**4. Live > Static**
Stale data is worse than no data. HADE shows signals only when they are fresh enough to be actionable. A review from 2019 has zero weight. A check-in from 2 hours ago carries maximum weight.

**5. Social Proximity > Popularity**
A venue with 2 visits from your trusted network outranks a venue with 10,000 anonymous reviews. This is a hard architectural and UX commitment.

**6. One Thing at a Time**
No multi-panel layouts. No comparison views. HADE tells you one thing, with one rationale, and one call to action: go or not this one. This is a feature, not a limitation.

**7. Empty States Are Honest**
When the context is weak or signals are sparse, the UI communicates this clearly and gracefully. "Not enough signal right now — check back in an hour" is an acceptable outcome.

### Emotional Design Goals

- Opening HADE should feel like reaching for a trusted friend's opinion
- Receiving a recommendation should feel like permission to act
- Acting on it should feel like the city is on your side
- Sharing a signal should feel like giving a gift, not generating content

### Words to Avoid in Copy

Trending. Discover. Explore. Popular. Based on your preferences. Users like you. Curated (unless literally true and human-curated). Viral. Hot right now. Top-rated. Points. Rewards. Badges.

---

## PART IV: USER SCENARIOS & USE CASE LIBRARY

**Scenario 1: The Paralyzed Pair**

*Context:* Two friends, 7:30pm Friday, standing outside a subway exit in a neighborhood they know loosely. Both hungry, no specific craving. Both have opened Yelp, scrolled for 4 minutes, and closed it.

*User Intent:* Make a food decision in under 2 minutes without regret.

*Constraints:* No dietary specifics declared. Moderate price range assumed. Want somewhere with energy, not a quiet date-night spot. Within 10 minutes walk.

*Desired Outcome:* One restaurant name, one street address, one sentence of context. Go.

*Emotional Goal:* Relief. Permission. The feeling that a smart friend made the call so they don't have to debate.

*Failure Modes:* Surfaces a place that's closed or closing. Recommends somewhere that requires a reservation. Returns a list instead of a decision. Recommends a place with no trust signal (feels random).

---

**Scenario 2: The New City Visitor**

*Context:* Business traveler, solo, first time in Chicago. Has 3 hours free before dinner. Hotel is downtown. Genuinely curious but slightly overwhelmed by tourist recommendations.

*User Intent:* Find something real — not tourist-trap real, but local-feel real. One thing worth doing, not a curated itinerary.

*Constraints:* Walking or short ride only. Nothing that requires advance planning. Somewhat adventurous.

*Desired Outcome:* An activity or place that a Chicago local would actually recommend. Confidence that this is the right move given limited time.

*Emotional Goal:* The feeling of being let in on a secret. City-as-insider, even briefly.

*Failure Modes:* Recommends Millennium Park (everyone knows it). Recommends something that requires booking. Returns a list of 12 things. No trust signal — feels like a Google result.

---

**Scenario 3: The Social Anchor**

*Context:* Planning to meet 4 friends at 9pm. Has 45 minutes to kill beforehand. Knows the general neighborhood. Not hungry, not tired. Just needs somewhere to be that has good energy.

*User Intent:* Find a bar or hang spot for one person that also transitions well into meeting the group.

*Constraints:* Solo for now, group later. Can't commit to something too far. Doesn't want to explain where they went.

*Desired Outcome:* A specific bar or venue that a trusted person has vouched for recently, ideally with a live signal.

*Emotional Goal:* Effortless. The choice should make the pre-game feel intentional rather than accidental.

*Failure Modes:* Recommends a sit-down restaurant (wrong mode). No social signal — feels cold. Recommends something too far from the meeting point. Place is dead at that hour.

---

**Scenario 4: The Spontaneous Pivot**

*Context:* Plans just fell through. It's 6pm Saturday. Now has the evening free unexpectedly. In a good neighborhood but with no plan.

*User Intent:* Turn a disappointment into a win. Find the best possible use of an unexpected free evening.

*Constraints:* Solo or open to texting someone to join. No specific activity preference. Just wants something that feels like the night wasn't wasted.

*Desired Outcome:* One decision that makes the evening feel worth having.

*Emotional Goal:* Transformation of plans fell through into this was actually better. Serendipity by design.

*Failure Modes:* Returns generic options that feel like backup choices. Nothing with social signal feels real or current. No sense that the recommendation understands the emotional context.

---

**Scenario 5: The Trusted Relay**

*Context:* User's close friend has been to a new ramen spot that opened 2 weeks ago. Friend checked in and left a signal. User is nearby, hungry, and would immediately go if they knew.

*User Intent:* Discover what people in their actual social circle are experiencing RIGHT NOW without having to text everyone.

*Constraints:* Must be a real signal from someone they trust, not crowd data.

*Desired Outcome:* HADE surfaces the ramen spot with Jordan was here yesterday and recommends it. User goes.

*Emotional Goal:* The feeling of being part of a network of people who look out for each other — without the overhead of group chats and coordination.

*Failure Modes:* Signal exists but isn't surfaced (ranking failure). Signal is shown without clear attribution (anonymized, loses value). Friend's signal is 3 weeks old and shown as current (trust decay failure).

---

## PART V: COMPETITIVE LANDSCAPE

### The Field

| Platform | Optimizes For | Core Limitation | What HADE Replaces |
|---|---|---|---|
| **Google Maps** | Comprehensiveness, search intent | No live social signal; popularity does not equal quality; overwhelming choice | The search-and-filter loop |
| **Yelp** | Review volume, business discovery | Stale, anonymous reviews; gameable; no context | Aggregated stranger opinion |
| **Instagram** | Content engagement, aspiration | Visual-first; no real decision support; influencer-weighted | Aesthetic discovery with no actionability |
| **Eventbrite** | Event registration, discovery | Planning mode only; no spontaneous in-moment use | Pre-planned event discovery |
| **Meetup** | Community formation, recurring events | Low trust graph; no real-time context; feels institutional | Structured social scheduling |
| **Foursquare/Swarm** | Check-in behavior, badge mechanics | Gamification without decision output; activity log, not advisor | The people have been here signal layer |
| **Airbnb Experiences** | Curated activity booking | Planning-required; professional hosts only; no live spontaneity | Structured guided experience booking |
| **BeReal** | Authentic presence, anti-performance | No decision output; passive social; no geospatial intelligence | Raw presence signal (HADE uses this mechanic as an input) |

### The Gap They All Share

Every platform above optimizes for content consumption or logistical planning. None of them optimize for confident in-the-moment real-world action.

Google Maps tells you what exists. Yelp tells you what strangers thought. Instagram tells you what looks good. Eventbrite tells you what's scheduled.

HADE tells you **what to do right now, with the confidence of someone who actually knows you.**

---

## PART VI: DATA MODEL

**User**
```
id: uuid
name: string
home_city: string
trust_network: [UserEdge]
preference_vector: float[]       // learned from behavior
visit_history: [Visit]
onboarding_complete: boolean
created_at: timestamp
last_active: timestamp
```

**Signal**
```
id: uuid
type: enum [PRESENCE, SOCIAL_RELAY, ENVIRONMENTAL, BEHAVIORAL, AMBIENT]
source_user_id: uuid | null      // null for environmental signals
venue_id: uuid | null
content: string | null           // optional human note
strength: float                  // 0.0 to 1.0
emitted_at: timestamp
expires_at: timestamp            // all signals decay
geo: {lat, lng}
```

**Moment**
```
id: uuid
venue_id: uuid
user_id: uuid
context_state_id: uuid
opportunity_score: float
trust_score: float
rationale: string
surfaced_at: timestamp
acted_on: boolean
acted_at: timestamp | null
dismissed: boolean
```

**TrustScore**
```
id: uuid
source_user_id: uuid
target_venue_id: uuid
score: float                     // 0.0 to 1.0
contributing_signals: [Signal.id]
computed_at: timestamp
network_depth: int               // 1 = direct, 2 = friend-of-friend
decay_rate: float                // per-hour decay coefficient
```

**SocialEdge**
```
id: uuid
user_a: uuid
user_b: uuid
edge_weight: float
mutual: boolean
established_at: timestamp
last_interaction: timestamp
signal_overlap_count: int
```

**ContextState**
```
id: uuid
user_id: uuid
timestamp: timestamp
geo: {lat, lng, accuracy}
time_of_day: string
day_type: enum [WEEKDAY, WEEKEND, HOLIDAY]
weather: {condition, temp, precip_probability}
group_size: int
intent_declared: string | null
energy_inferred: enum [LOW, MODERATE, HIGH]
session_id: uuid
```

**Opportunity**
```
id: uuid
venue_id: uuid
context_state_id: uuid
user_id: uuid
opportunity_score: float
trust_attribution: [TrustScore.id]
primary_signal: Signal.id
rationale: string
category: string
distance_meters: int
eta_minutes: int
is_primary: boolean
created_at: timestamp
```

**Venue**
```
id: uuid
name: string
category: string
geo: {lat, lng}
address: string
price_tier: int                  // 1 to 4
hours: {open, close}[]
is_open_now: boolean
live_busyness: float | null
last_signal_at: timestamp | null
verified: boolean
external_id: string | null       // Google Place ID, etc.
```

---

## PART VII: SUCCESS METRICS & KPIs

### North Star Metric

**Decision-to-Departure Rate (DDR):** The percentage of surfaced primary recommendations that result in the user navigating to or visiting the venue within 90 minutes.

*Target:* >35% DDR at 90-day cohort maturity.

### Core KPIs

| Metric | Definition | Target |
|---|---|---|
| **Decision Latency** | Time from app open to user committing to a recommendation | <90 seconds |
| **Recommendation Acceptance Rate** | % of primary recommendations acted on | >30% |
| **Trust Signal Coverage** | % of recommendations with at least one first/second-degree trust signal | >60% |
| **7-Day Retention** | Users who open app again within 7 days | >40% |
| **New City Engagement Rate** | Acceptance rate for users in unfamiliar cities | Parity with home city |
| **Trust Amplification Score** | Ratio of acted-on moments attributed to social signals vs. algorithmic | >2:1 social |
| **Empty Result Rate** | % of sessions that return no recommendation | <15% |
| **Signal Contribution Rate** | % of users who emit at least one signal per session | >25% |
| **Post-Visit Sentiment** | Did the recommendation deliver? | >80% positive |

### Anti-Metrics (Deliberately Not Optimized)

Time in app. Page views. Scroll depth. Review volume. Follower counts.

---

## PART VIII: TECHNICAL CONSTRAINTS & STACK

### Current Constraints

- Small team: architecture must be operable by 1–2 engineers initially
- Latency requirement: recommendation response time <800ms from context submission
- Mobile-first: primary surface is native mobile; web is secondary/internal
- Signal freshness: live signals must expire aggressively; stale data must not surface

### Stack

| Layer | Choice | Rationale |
|---|---|---|
| **Backend** | Python (FastAPI) | Rapid iteration, ML ecosystem, async support |
| **Frontend** | React Native | Cross-platform mobile, shared codebase |
| **Hosting** | AWS (ECS + Lambda) | Scalable, managed |
| **Primary DB** | PostgreSQL via Supabase | Relational trust graph, PostGIS for geo |
| **Realtime Infra** | Supabase Realtime / Redis Pub-Sub | Low-latency signal propagation |
| **Vector Store** | Pinecone (Phase 2) | Semantic preference matching |
| **Cache Layer** | Redis | ContextState, session state, signal TTLs |
| **Signal Queue** | SQS / Celery | Async signal ingestion and decay |
| **Maps/Geo** | Google Places API | Venue data baseline |
| **Weather** | OpenWeatherMap | Environmental signal |
| **Auth** | Supabase Auth / Phone OTP | Low-friction onboarding |
| **Observability** | Datadog + Sentry | Latency monitoring, pipeline tracing |

### Key Technical Risks

- **Cold start problem:** New users with sparse social graphs will have weak trust signal; mitigation is onboarding prompt to import contacts
- **Signal latency vs. freshness:** Real-time ingestion vs. recommendation speed requires aggressive caching
- **Privacy surface:** Social graph data is sensitive; explicit user consent required from day one

---

## PART IX: TONE & BRAND POSITIONING

### Brand Essence

HADE is the city's nervous system made accessible — but it speaks like a trusted local, not a startup.

### Voice Characteristics

| Attribute | Means | Does Not Mean |
|---|---|---|
| **Confident** | Commits to one answer | Arrogant |
| **Warm** | Feels like a friend's recommendation | Sycophantic |
| **Current** | Speaks in the present tense | Obsessed with trends |
| **Precise** | Gives specific, useful information | Verbose |
| **Human** | Uses real names and real signals | Algorithmic |

### Emotional Promise

*When you open HADE, you feel like you already have a friend in this city.*

### Voice in Practice

Does say: "Alex was here two hours ago. You'll want the miso ramen."
Does not say: "Trending near you based on user activity."

Does say: "Nothing great right now — check back around 7."
Does not say: "Here are 14 options in your area!"

Does say: "Go. You'll thank us."
Does not say: "Explore our curated picks."

---

## NORTH STAR

> *This project is about restoring serendipity in a hyper-digital world. Making cities feel human again. Turning passive maps into active experiences.*

HADE exists because the best moment in any city tonight won't be found on a list. It'll be found because someone you trust was there, the timing is right, and a system smart enough to connect those two facts pointed you toward the door.

Everything in this document — the architecture, the UX principles, the data model, the brand voice — exists in service of that one feeling: **the city is on your side tonight.**

---

*HADE Operating Context v1.0 — Internal Reference*
*March 2026*
