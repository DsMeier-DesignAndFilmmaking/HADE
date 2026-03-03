# HADE — Claude Code Operating Instructions

> **Hyperlocal Agentic Decision Engine** — One confident recommendation, not a list.

## What This Project Is

HADE is a context-aware, trust-weighted decision engine for urban moments. Users open the app when they don't know what to do next and get a single confident suggestion backed by real social signals — not reviews, not popularity, not algorithmic guesses.

**Read the full specs in `docs/brain/` before any architectural or product decisions:**
- `BRAIN_VISION.md` — Mission, values, non-negotiables
- `BRAIN_TECHNICAL.md` — Architecture, stack, data model, API design
- `BRAIN_UX.md` — Design system, user journeys, accessibility
- `BRAIN_GTM.md` — Personas, business model, positioning

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12+ / FastAPI |
| Frontend | React Native (Expo) / TypeScript strict |
| Database | PostgreSQL via Supabase (PostGIS for geo) |
| Realtime | Supabase Realtime + Redis Pub/Sub |
| Cache | Redis |
| Queue | SQS + Celery |
| Auth | Supabase Auth / Phone OTP |
| Maps | Google Places API |
| Weather | OpenWeatherMap API |
| Observability | Datadog + Sentry |

---

## Project Structure

```
hade/
├── backend/
│   ├── app/
│   │   ├── api/           # FastAPI routers
│   │   ├── core/          # Config, security, dependencies
│   │   ├── models/        # SQLAlchemy models
│   │   ├── schemas/       # Pydantic schemas
│   │   ├── services/      # Business logic (context engine, scoring, trust)
│   │   └── workers/       # Celery tasks (signal decay, aggregation)
│   ├── migrations/        # Alembic
│   ├── tests/
│   └── pyproject.toml
├── mobile/
│   ├── src/
│   │   ├── screens/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/      # API client
│   │   ├── stores/        # Zustand stores
│   │   └── types/
│   └── package.json
├── docs/brain/            # Brain Docs (source of truth)
└── infra/                 # Terraform / CDK
```

---

## Coding Standards

### Python Backend
- Type hints on ALL function signatures
- FastAPI + Pydantic v2 for all request/response schemas
- Async/await throughout — no blocking I/O in request handlers
- SQLAlchemy 2.0 with async session management
- Alembic for migrations
- pytest with >80% coverage on core pipeline
- Black + ruff for formatting/linting
- Environment variables via `.env` loaded with `python-dotenv`
- No raw SQL queries — use SQLAlchemy ORM to prevent injection

### React Native Frontend
- Expo managed workflow
- TypeScript strict mode — no `any` types
- Zustand for state management
- React Query (TanStack) for server state
- Minimal dependencies — every new package needs justification

### Git
- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`
- Branch naming: `feat/context-engine`, `fix/signal-decay-bug`
- PR descriptions reference relevant Brain Doc section if architectural

---

## API Conventions

- RESTful: `/api/v1/{resource}`
- All timestamps ISO 8601 UTC
- All IDs are UUIDv4
- Geo coordinates: `{lat: float, lng: float}`
- JSON only, cursor-based pagination
- Rate limiting: 60 req/min per user

### Core Endpoints
```
POST /api/v1/decide            # THE core endpoint — returns one recommendation
POST /api/v1/signals           # Emit check-in / presence signal
GET  /api/v1/signals/nearby    # Live signals within radius
GET  /api/v1/venues/{id}       # Venue with live signal overlay
POST /api/v1/moments/{id}/act  # Log user acted on recommendation
```

### Response Envelope
```json
{
  "status": "ok",
  "data": { },
  "meta": { "request_id": "uuid", "latency_ms": 142, "context_state_id": "uuid" },
  "errors": []
}
```

---

## Performance Requirements

- `/decide` endpoint: **< 800ms p95**
- Signal ingestion to availability: < 5 seconds
- Signal TTL enforcement: within 1 minute of expiry
- Cold start (no social graph): still < 800ms using environmental/static signals

---

## Architecture — The 5-Layer Pipeline

```
Context Engine → Signal Aggregator → Trust Layer → Scoring System → Decision Layer
```

1. **Context Engine** — Builds `ContextState` from geo, time, weather, energy, group size
2. **Signal Aggregator** — Normalizes signals with decay rates (minutes → months)
3. **Trust Layer** — Re-weights signals by social proximity (2nd-degree = 10x anonymous)
4. **Scoring System** — Produces `OpportunityScore`; trust signals multiply, not add; confidence floor enforced
5. **Decision Layer** — One primary recommendation + rationale + 2-3 fallbacks

**Critical rule:** If no signal is strong enough, return nothing. Never pad results with noise.

---

## Product Non-Negotiables

When building features or making decisions, these constraints are absolute:

- **Single recommendation output** — One suggestion, not a list
- **No feeds, no infinite scroll** — The anti-feed
- **No gamification** — No points, badges, streaks, leaderboards
- **No anonymous reviews** — Every signal is attributable or environmental
- **< 3 taps from open to departure intent**
- **< 800ms response time**
- **Trust > popularity** — 2 friend visits outrank 10,000 anonymous reviews
- **Freshness > history** — All signals decay; stale data never surfaces
- **Honest empty states** — "Nothing great right now" is valid output

### Banned UI/Copy Language
Never use: Trending, Discover, Explore, Popular, Based on your preferences, Users like you, Curated, Viral, Hot right now, Top-rated, Points, Rewards, Badges

### Correct Voice
- DO: "Alex was here two hours ago. You'll want the miso ramen."
- DON'T: "Trending near you based on user activity."
- DO: "Nothing great right now — check back around 7."
- DON'T: "Here are 14 options in your area!"

---

## Design System Quick Reference

- **Theme:** Dark, warm, confident. Not cold-tech, not neon-startup.
- **Background:** `#0D0D0D` / Cards: `#1A1A1A` / Text: `#FAFAF8`
- **Signal green:** `#22C55E` / Trust blue: `#3B82F6` / CTA amber: `#F59E0B`
- **Fonts:** Inter (body), Bricolage Grotesque (display/headlines)
- **Radius:** 8px buttons, 12px cards, 16px modals
- **Motion:** Purposeful only — conveys state changes, never decorative
- **Accessibility:** WCAG 2.1 AA, 44x44pt touch targets, VoiceOver/TalkBack support, dynamic type

### Visual Anti-Patterns (Never Build)
- Carousels or horizontal scroll lists
- Star ratings or numerical scores
- Grid thumbnail layouts
- Bottom tab bars with 5+ tabs
- Notification badge counts
- Anything implying "there's more to browse"

---

## Data Model (Key Entities)

`User` → `SocialEdge` → `User` (trust graph)
`Signal` (typed, decaying, geo-located) → `Venue`
`ContextState` (snapshot of user moment) → `Opportunity` (scored recommendation) → `Moment` (logged outcome)
`TrustScore` (per-venue per-user, with network depth and decay)

**Every signal has an `expires_at`.** No indefinite retention. Signal decay is mandatory.

---

## Security & Privacy

- JWT with 1-hour expiry + refresh rotation
- Row-level security on all Supabase tables
- Social graph encrypted at rest (AES-256)
- TLS 1.3 for all traffic
- Explicit opt-in consent for each sharing layer
- GDPR-ready: data export + deletion endpoints from day one
- No third-party analytics SDKs that leak PII
- No data selling. Ever.

---

## Key Metrics (Context for Feature Decisions)

- **North Star:** Decision-to-Departure Rate (DDR) > 35%
- Decision latency: < 90 seconds from app open to commitment
- Trust signal coverage: > 60% of recommendations backed by social signal
- Empty result rate: < 15%
- Post-visit sentiment: > 80% positive

**Anti-metrics (do NOT optimize for):** Time in app, page views, scroll depth, review volume, follower counts.

---

## Target Personas

1. **Spontaneous Explorer** (primary) — 25-38, urban, paralyzed by choice, wants one answer fast
2. **Local Mayor** (secondary) — The friend who always knows the move, wants to amplify their instinct
3. **Insider Tourist** — Visitor who wants local-feel, not tourist-trap

**Anti-persona:** Planners, researchers, content creators. We do not build for them.

---

## When In Doubt

- Reference `docs/brain/` — those are the source of truth
- If a feature conflicts with the non-negotiables above, flag it and explain the tension
- Simpler is better. Less time in-app = winning.
- The emotional north star: *The city is on your side tonight.*
