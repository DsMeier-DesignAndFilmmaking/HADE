# BRAIN_TECHNICAL.md
## HADE — Technical Architecture, Stack & Engineering Standards

> **For Claude Code:** Reference this document for all technical decisions — stack choices, API design, database schema, infrastructure patterns, and performance requirements. When generating code, follow the conventions and constraints specified here. If a technical approach conflicts with this document, flag it before proceeding.

---

## System Architecture Overview

HADE is a **Hyperlocal Agentic Decision Engine** — not a recommender system. The unit of output is not a ranked list; it is a **single confident, moment-specific decision** backed by trust-weighted social signals and real-time context.

### Core Components (5-Layer Pipeline)
```
[Context Engine] → [Signal Aggregator] → [Trust Layer] → [Scoring System] → [Decision Layer]
```

**1. Context Engine** — The sensory layer. Continuously aggregates:
- Geolocation (precise, block-level via GPS)
- Temporal signals (time of day, day of week, proximity to meal/activity windows)
- Weather conditions (current + 2-hour forecast)
- User energy/intent state (inferred or declared)
- Group composition (solo, couple, group, kids present)
- Session history (what was surfaced, what was acted on)

Output: `ContextState` object — primary filter for all downstream logic.

**2. Signal Aggregator** — Ingests and normalizes signals into a common schema:

| Signal Type | Examples | Decay Rate |
|---|---|---|
| Live Presence | Active check-ins, live venue busyness | Minutes |
| Recent Social | Friend was here 3 hours ago | Hours |
| Environmental | Weather, events nearby, transit disruptions | Hours |
| Behavioral | User's past session actions | Days |
| Ambient Trust | Aggregate network endorsement | Weeks |
| Static Context | Venue category, hours, price range | Months |

**3. Trust Layer** — Re-weights all signals by social proximity:
- Second-degree network visit = 10x weight of anonymous review
- Trust built through: verified physical presence, reciprocal engagement, temporal freshness, sender consistency
- Output: `TrustScore` per venue relative to requesting user

**4. Scoring System** — Produces an `OpportunityScore` per candidate:
- Trust signals **multiply**, not add
- Recency is exponentially weighted
- Network proximity is the strongest amplifier
- Novelty rewarded (unseen outranks seen)
- **Confidence floor:** if no signal is strong enough, surface nothing rather than noise

**5. Decision Layer** — Converts ranked opportunities into:
- Primary recommendation (single `Opportunity` object)
- Human-readable rationale with trust attribution
- Fallback set (2–3 alternatives if primary is dismissed)
- `ContextState` snapshot for logging and learning

---

## Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| **Backend** | Python 3.12+ / FastAPI | Rapid iteration, ML ecosystem, native async |
| **Frontend** | React Native (Expo) | Cross-platform mobile, shared codebase |
| **Hosting** | AWS (ECS + Lambda) | Scalable, managed, cost-effective at low scale |
| **Primary DB** | PostgreSQL via Supabase | Relational trust graph, PostGIS for geo queries |
| **Realtime** | Supabase Realtime + Redis Pub/Sub | Low-latency signal propagation |
| **Vector Store** | Pinecone (Phase 2) | Semantic preference matching |
| **Cache** | Redis | ContextState, session state, signal TTLs |
| **Signal Queue** | SQS + Celery | Async signal ingestion and decay processing |
| **Maps/Geo** | Google Places API | Venue data baseline |
| **Weather** | OpenWeatherMap API | Environmental signal input |
| **Auth** | Supabase Auth / Phone OTP | Low-friction onboarding |
| **Observability** | Datadog + Sentry | Latency monitoring, pipeline tracing, error tracking |

---

## Data Model (Core Entities)

### User
```
id: uuid (PK)
name: string
home_city: string
trust_network: [UserEdge]
preference_vector: float[]       -- learned from behavior
visit_history: [Visit]
onboarding_complete: boolean
created_at: timestamp
last_active: timestamp
```

### Signal
```
id: uuid (PK)
type: enum [PRESENCE, SOCIAL_RELAY, ENVIRONMENTAL, BEHAVIORAL, AMBIENT]
source_user_id: uuid | null      -- null for environmental signals
venue_id: uuid | null
content: string | null           -- optional human note
strength: float                  -- 0.0 to 1.0
emitted_at: timestamp
expires_at: timestamp            -- ALL signals decay
geo: {lat, lng}
```

### Venue
```
id: uuid (PK)
name: string
category: string
geo: {lat, lng}
address: string
price_tier: int                  -- 1 to 4
hours: {open, close}[]
is_open_now: boolean
live_busyness: float | null
last_signal_at: timestamp | null
verified: boolean
external_id: string | null       -- Google Place ID, etc.
```

### ContextState
```
id: uuid (PK)
user_id: uuid (FK → User)
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

### Opportunity
```
id: uuid (PK)
venue_id: uuid (FK → Venue)
context_state_id: uuid (FK → ContextState)
user_id: uuid (FK → User)
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

### TrustScore
```
id: uuid (PK)
source_user_id: uuid (FK → User)
target_venue_id: uuid (FK → Venue)
score: float                     -- 0.0 to 1.0
contributing_signals: [Signal.id]
computed_at: timestamp
network_depth: int               -- 1 = direct, 2 = friend-of-friend
decay_rate: float                -- per-hour decay coefficient
```

### SocialEdge
```
id: uuid (PK)
user_a: uuid (FK → User)
user_b: uuid (FK → User)
edge_weight: float
mutual: boolean
established_at: timestamp
last_interaction: timestamp
signal_overlap_count: int
```

### Moment (Logging Entity)
```
id: uuid (PK)
venue_id: uuid (FK → Venue)
user_id: uuid (FK → User)
context_state_id: uuid (FK → ContextState)
opportunity_score: float
trust_score: float
rationale: string
surfaced_at: timestamp
acted_on: boolean
acted_at: timestamp | null
dismissed: boolean
```

---

## API Design Standards

### General Conventions
- RESTful endpoints with consistent naming: `/api/v1/{resource}`
- All timestamps in ISO 8601 UTC
- All IDs are UUIDs (v4)
- All geo coordinates as `{lat: float, lng: float}`
- JSON request/response bodies exclusively
- Pagination via cursor-based pagination (not offset)
- Rate limiting: 60 requests/minute per user for consumer endpoints

### Key Endpoints (Phase 1)
```
POST   /api/v1/decide              -- Core recommendation endpoint
  Input:  ContextState (auto-constructed from device signals + declared intent)
  Output: Opportunity (primary) + fallback set

POST   /api/v1/signals             -- Emit a signal (check-in, note, presence)
GET    /api/v1/signals/nearby      -- Live signals within radius

GET    /api/v1/user/me             -- User profile + preference state
PUT    /api/v1/user/me             -- Update profile / preferences
GET    /api/v1/user/trust-network  -- Social graph for current user

GET    /api/v1/venues/{id}         -- Venue detail with live signal overlay
GET    /api/v1/venues/nearby       -- Venues within radius (raw, pre-scoring)

POST   /api/v1/moments/{id}/act    -- Log that user acted on a recommendation
POST   /api/v1/moments/{id}/dismiss -- Log dismissal
```

### Response Envelope
```json
{
  "status": "ok" | "error",
  "data": { ... },
  "meta": {
    "request_id": "uuid",
    "latency_ms": 142,
    "context_state_id": "uuid"
  },
  "errors": []
}
```

### Error Format
```json
{
  "code": "INSUFFICIENT_CONTEXT",
  "message": "Not enough signal to produce a confident recommendation.",
  "detail": "Try again in a different location or check back later."
}
```

---

## Performance Requirements

| Metric | Requirement |
|---|---|
| `/decide` endpoint latency | < 800ms p95 |
| Signal ingestion to availability | < 5 seconds |
| Signal TTL enforcement | Processed within 1 minute of expiry |
| Cold start (new user, no graph) | Must still return within 800ms (use environmental/static signals) |
| Uptime target | 99.5% (Phase 1) |

---

## Security Requirements

### Authentication & Authorization
- Phone OTP via Supabase Auth for user signup/login
- JWT tokens with 1-hour expiry, refresh token rotation
- Row-level security (RLS) on all Supabase tables
- Users can only read their own data and their trust network's signals

### Data Privacy
- Social graph data encrypted at rest (AES-256)
- All API traffic over TLS 1.3
- Explicit opt-in consent for each data sharing layer
- Signal data auto-purged after TTL expiry — no indefinite retention
- GDPR-ready: full data export and deletion endpoints from day one
- No third-party analytics SDKs that leak PII

### API Security
- CORS restricted to known origins
- Input validation on all endpoints (Pydantic models)
- SQL injection prevention via ORM (SQLAlchemy) — no raw queries
- Rate limiting per user and per IP

---

## Key Technical Risks & Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| **Cold start (sparse social graph)** | Weak trust signals for new users | Onboarding prompt to import contacts; fall back to environmental + static signals |
| **Signal latency vs. freshness** | Real-time ingestion competes with recommendation speed | Aggressive caching in Redis; pre-compute TrustScores on signal emit |
| **Privacy surface area** | Social graph is sensitive data | Explicit consent, RLS, encryption, auto-purge, minimal data collection |
| **Single-city dependency** | Limited venue/signal density | Launch in a dense urban market; manually seed initial venue data |
| **Google Places API costs** | Geo data costs scale with usage | Cache venue data aggressively; batch updates on 24-hour cycle |

---

## Engineering Conventions for Claude Code

### Python Backend
- Python 3.12+ with type hints on all function signatures
- FastAPI with Pydantic v2 models for all request/response schemas
- Async/await throughout — no blocking I/O in request handlers
- SQLAlchemy 2.0 with async session management
- Alembic for database migrations
- pytest for all tests; target >80% coverage on core pipeline
- Black + ruff for formatting and linting
- Environment variables via `.env` files loaded with `python-dotenv`

### React Native Frontend
- Expo managed workflow
- TypeScript strict mode
- Zustand for state management
- React Query (TanStack) for server state
- Minimal dependencies — every new package requires justification

### Git Conventions
- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`
- Branch naming: `feat/context-engine`, `fix/signal-decay-bug`
- PR descriptions must reference the relevant Brain Doc section if architectural

### Project Structure (Target)
```
hade/
├── backend/
│   ├── app/
│   │   ├── api/           -- FastAPI routers
│   │   ├── core/          -- Config, security, dependencies
│   │   ├── models/        -- SQLAlchemy models
│   │   ├── schemas/       -- Pydantic schemas
│   │   ├── services/      -- Business logic (context engine, scoring, trust)
│   │   └── workers/       -- Celery tasks (signal decay, aggregation)
│   ├── migrations/        -- Alembic
│   ├── tests/
│   └── pyproject.toml
├── mobile/
│   ├── src/
│   │   ├── screens/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/      -- API client
│   │   ├── stores/        -- Zustand stores
│   │   └── types/
│   └── package.json
├── docs/
│   └── brain/             -- These Brain Docs live here
├── infra/                 -- Terraform / CDK
└── README.md
```

---

*BRAIN_TECHNICAL.md — HADE Knowledge Layer v1.0 — March 2026*