"""Core /decide endpoint — THE reason HADE exists.

Orchestrates the 5-layer pipeline:
Context Engine → Signal Aggregator → Trust Layer → Scoring → Decision
"""

import logging
import time
import uuid
from uuid import UUID
from dataclasses import dataclass

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.core.security import AuthContext, get_current_auth_context
from app.models.venue import Venue
from app.schemas.common import ApiResponse, ErrorDetail, ResponseMeta
from app.schemas.decide import DecideRequest, DecideResponse
from app.services.context_engine import build_context_state
from app.services.decision_layer import make_decision
from app.services.google_places import search_nearby
from app.services.llm_decision import LLM_EMPTY_REASON_DEFAULT, make_llm_decision
from app.services.scoring import score_candidates
from app.services.signal_aggregator import aggregate_signals
from app.services.trust_layer import compute_trust_weights

logger = logging.getLogger(__name__)

router = APIRouter(tags=["decide"])

# Search radius for venues and signals (meters)
VENUE_SEARCH_RADIUS_M = 1000
SIGNAL_SEARCH_RADIUS_M = 1500

# --- AUDIT MODE HELPERS ---
@dataclass
class MockAuth:
    """Temporary mock to bypass JWT requirement for OpenAI/Gemini auditing."""
    user_id: UUID
    is_anonymous: bool = False

async def _resolve_place_venue_ids(
    place_ids: list[str],
    db: AsyncSession,
) -> dict[str, UUID]:
    if not place_ids:
        return {}

    result = await db.execute(
        select(Venue.id, Venue.external_id).where(
            Venue.external_id.in_(place_ids)
        )
    )

    mapping: dict[str, UUID] = {}
    for row in result.all():
        if row.external_id:
            mapping[row.external_id] = row.id
    return mapping


@router.post("/decide", response_model=ApiResponse[DecideResponse | None])
async def decide(
    request: DecideRequest,
    # auth_context: AuthContext = Depends(get_current_auth_context), # BYPASSED FOR AUDIT
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[DecideResponse | None]:
    
    # ── AUDIT BYPASS: Hardcoding a User ID ──
    # Replace this with your actual Supabase User ID if you want to see YOUR signals
    # Or keep this dummy UUID just to satisfy the database constraints
    audit_user_id = UUID("00000000-0000-0000-0000-000000000000")
    auth_context = MockAuth(user_id=audit_user_id)
    
    start_ms = time.monotonic()
    request_id = uuid.uuid4()

    try:
        # ── Layer 1: Context Engine ──
        context = await build_context_state(request, auth_context.user_id, db)

        # ── Google Places Data ──
        places = await search_nearby(
            lat=request.geo.lat,
            lng=request.geo.lng,
            intent=request.intent,
            radius_m=VENUE_SEARCH_RADIUS_M,
        )

        if not places:
            return ApiResponse(
                status="ok",
                data=None,
                meta=ResponseMeta(
                    request_id=request_id,
                    latency_ms=round((time.monotonic() - start_ms) * 1000),
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

# ── Layer 3: Trust Layer (AUDIT MODE BYPASS) ──
        trust_weights = {sig.signal.id: 1.0 for sig in signals}
        friend_names = {}
        user_names = {}

        place_to_venue_id = await _resolve_place_venue_ids(
            place_ids=[place.place_id for place in places],
            db=db,
        )

        # ── Layer 4: Scoring System ──
        candidate_set = score_candidates(
            places=places,
            signals=signals,
            trust_weights=trust_weights,
            context=context,
            user_lat=request.geo.lat,
            user_lng=request.geo.lng,
            radius_m=VENUE_SEARCH_RADIUS_M,
            friend_names=friend_names,
            user_names=user_names,
            place_to_venue_id=place_to_venue_id,
        )

        # ── Layer 5: Decision Layer (Now with Provider Toggle) ──
        empty_reason: str | None = None
        llm_used = False
        llm_model = ""
        decision = None

        try:
            # CALLING THE AI SERVICE
            llm_result = await make_llm_decision(
                candidate_set=candidate_set,
                context=context,
                provider=request.provider,
                rejection_history=request.rejection_history or None,
            )
            
            llm_used = llm_result.used_llm
            llm_model = llm_result.model_name
            decision = llm_result.decision
            empty_reason = llm_result.empty_reason
            
            if decision:
                decision.provider = llm_model 
                logger.info(f"AI RATIONALE GENERATED: {decision.primary.rationale}")

        except Exception:
            logger.exception("decide: llm decision failed, falling back to deterministic layer")
            decision = await make_decision(
                candidate_set=candidate_set,
                context_state_id=context.id,
                time_of_day=context.time_of_day,
                user_id=auth_context.user_id,
                db=db,
            )
            if decision is None:
                empty_reason = LLM_EMPTY_REASON_DEFAULT

        except Exception:
            logger.exception("decide: llm decision failed, falling back to deterministic layer")
            decision = await make_decision(
                candidate_set=candidate_set,
                context_state_id=context.id,
                time_of_day=context.time_of_day,
                user_id=auth_context.user_id,
                db=db,
            )
            if decision is None:
                empty_reason = LLM_EMPTY_REASON_DEFAULT

        errors: list[ErrorDetail] = []
        if decision is None and empty_reason:
            errors.append(
                ErrorDetail(
                    code="INSUFFICIENT_CONTEXT",
                    message=empty_reason,
                    detail=f"No candidate cleared the threshold using {request.provider}.",
                )
            )

        await db.commit()
        latency_ms = round((time.monotonic() - start_ms) * 1000)

        logger.info(
            "decide: user=%s intent=%s signals=%d candidates=%d provider=%s model=%s latency=%dms",
            auth_context.user_id,
            request.intent,
            len(signals),
            len(candidate_set.candidates),
            request.provider,
            llm_model,
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
            errors=errors,
        )

    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception:
        await db.rollback()
        logger.exception("decide: unhandled error for user=%s", auth_context.user_id)
        raise HTTPException(status_code=500, detail="Decision engine error")