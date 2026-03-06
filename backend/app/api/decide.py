"""Core /decide endpoint — THE reason HADE exists.

Orchestrates the 5-layer pipeline:
  Context Engine → Signal Aggregator → Trust Layer → Scoring → Decision

Returns one confident recommendation with 2-3 fallbacks, or an honest empty state.
Target latency: < 800ms p95.
"""

import logging
import time
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.core.security import AuthContext, get_current_auth_context
from app.schemas.common import ApiResponse, ResponseMeta
from app.schemas.decide import DecideRequest, DecideResponse
from app.services.context_engine import build_context_state
from app.services.decision_layer import make_decision
from app.services.google_places import search_nearby
from app.services.scoring import score_candidates
from app.services.signal_aggregator import aggregate_signals
from app.services.trust_layer import compute_trust_weights

logger = logging.getLogger(__name__)

router = APIRouter(tags=["decide"])

# Search radius for venues and signals (meters)
VENUE_SEARCH_RADIUS_M = 1000
SIGNAL_SEARCH_RADIUS_M = 1500


@router.post("/decide", response_model=ApiResponse[DecideResponse | None])
async def decide(
    request: DecideRequest,
    auth_context: AuthContext = Depends(get_current_auth_context),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[DecideResponse | None]:
    """Core endpoint — returns one recommendation.

    Pipeline:
    1. Build ContextState from geo, time, intent
    2. Query Google Places for nearby venues matching intent
    3. Aggregate existing signals near the user (may be empty on cold start)
    4. Compute trust weights on signals (friend signals get 10x)
    5. Score venues using Places data + signals + trust
    6. Pick primary + fallbacks, generate rationale
    """
    start_ms = time.monotonic()
    request_id = uuid.uuid4()

    try:
        # ── Layer 1: Context Engine ──
        context = await build_context_state(request, auth_context.user_id, db)

        # ── Google Places: real venue data ──
        places = await search_nearby(
            lat=request.geo.lat,
            lng=request.geo.lng,
            intent=request.intent,
            radius_m=VENUE_SEARCH_RADIUS_M,
        )

        if not places:
            # Nothing nearby — honest empty state
            latency_ms = round((time.monotonic() - start_ms) * 1000)
            await db.commit()
            return ApiResponse(
                status="ok",
                data=None,
                meta=ResponseMeta(
                    request_id=request_id,
                    latency_ms=latency_ms,
                    context_state_id=context.id,
                ),
            )

        # ── Layer 2: Signal Aggregator ──
        signals = await aggregate_signals(
            context,
            auth_context.user_id,
            db,
            lat=request.geo.lat,
            lng=request.geo.lng,
            radius_m=SIGNAL_SEARCH_RADIUS_M,
        )

        # ── Layer 3: Trust Layer ──
        if auth_context.is_anonymous:
            # Zero-input guest flow: rely on geo + weather + public signals only.
            trust_weights = {sig.id: 1.0 for sig in signals}
        else:
            trust_weights = await compute_trust_weights(signals, auth_context.user_id, db)

        # ── Layer 4: Scoring System ──
        candidates = score_candidates(
            places=places,
            signals=signals,
            trust_weights=trust_weights,
            context=context,
            user_lat=request.geo.lat,
            user_lng=request.geo.lng,
            radius_m=VENUE_SEARCH_RADIUS_M,
        )

        # ── Layer 5: Decision Layer ──
        decision = await make_decision(
            candidates=candidates,
            context_state_id=context.id,
            time_of_day=context.time_of_day,
            user_id=auth_context.user_id,
            db=db,
        )

        await db.commit()

        latency_ms = round((time.monotonic() - start_ms) * 1000)

        logger.info(
            "decide: user=%s anonymous=%s intent=%s places=%d signals=%d candidates=%d latency=%dms",
            auth_context.user_id,
            auth_context.is_anonymous,
            request.intent,
            len(places),
            len(signals),
            len(candidates),
            latency_ms,
        )

        return ApiResponse(
            status="ok",
            data=decision,
            meta=ResponseMeta(
                request_id=request_id,
                latency_ms=latency_ms,
                context_state_id=context.id,
            ),
        )

    except ValueError as e:
        # Config errors (missing API key, etc.)
        raise HTTPException(status_code=500, detail=str(e))
    except Exception:
        await db.rollback()
        logger.exception("decide: unhandled error for user=%s", auth_context.user_id)
        raise HTTPException(status_code=500, detail="Decision engine error")
