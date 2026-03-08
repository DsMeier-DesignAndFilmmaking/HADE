"""LLM-backed decision service using Gemini 1.5 Flash.

The model selects one primary candidate or returns an honest empty state.
Optimized for the "Rationale-as-Headline" UI pattern to drive DDR > 35%.
"""

from __future__ import annotations

from dataclasses import dataclass
import json
import logging
import re
import uuid

import httpx
from pydantic import BaseModel

from app.core.config import settings
from app.models.context_state import ContextState
from app.schemas.candidate import Candidate, CandidateSet
from app.schemas.decide import DecideResponse, OpportunityOut, PrimarySignal, TrustAttribution

logger = logging.getLogger(__name__)

MIN_CONFIDENCE_FOR_DECISION = 0.7
GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
LLM_EMPTY_REASON_DEFAULT = "Nothing great right now — check back around 7."

# Strictly enforced per BRAIN_VISION.md
_BANNED_TERMS = {
    "trending", "discover", "explore", "popular", "top-rated", 
    "hot right now", "users like you", "based on your preferences",
    "curated", "recommended", "personalized", "check out"
}


class LlmDecisionPayload(BaseModel):
    empty_state: bool
    reason: str | None = None
    selected_place_id: str | None = None
    rationale: str | None = None


@dataclass(frozen=True)
class LlmDecisionResult:
    decision: DecideResponse | None
    empty_reason: str | None = None
    used_llm: bool = True
    model_name: str = ""


def _top_confidence(candidate_set: CandidateSet) -> float:
    if not candidate_set.candidates:
        return 0.0
    return max(candidate.score for candidate in candidate_set.candidates)


def _clean_text(value: str | None) -> str:
    if not value:
        return ""
    cleaned = value.replace('"', '').replace('"', '')
    return re.sub(r"\s+", " ", cleaned).strip()


def _contains_banned_terms(text: str) -> bool:
    lowered = text.lower()
    return any(term in lowered for term in _BANNED_TERMS)


def _get_best_name(candidate: Candidate) -> str:
    """Extracts the best available human name from the trust context."""
    bundle = candidate.trust_context.signal_bundle
    if bundle and bundle.user_first_name:
        return bundle.user_first_name
    return candidate.trust_context.operator_name or candidate.trust_context.friend_name or "A friend"


def _fallback_rationale(candidate: Candidate) -> str:
    """Safe, human-sounding fallback if LLM output fails validation."""
    name = _get_best_name(candidate)
    signal = _clean_text(candidate.trust_context.signal_text)
    bundle = candidate.trust_context.signal_bundle
    
    time_str = f"{bundle.minutes_ago}m ago" if bundle and bundle.minutes_ago < 60 else "just now"
    
    if signal:
        return f"{name} is here {time_str}: \"{signal}\""
    return f"{name} is here {time_str}. It's active and only {candidate.eta_minutes}m away."


def _enforce_voice(rationale: str, candidate: Candidate) -> str:
    """Sanitizes the rationale to ensure it fits the 'Rationale-as-Headline' UI constraints."""
    text = _clean_text(rationale)

    if not text or _contains_banned_terms(text):
        return _fallback_rationale(candidate)

    # Enforce present tense
    text = text.replace(" was ", " is ").replace(" went ", " is at ")

    # Ensure human attribution is present
    name = _get_best_name(candidate)
    if name.lower() not in text.lower() and name != "A friend":
        text = f"{name} is here. {text}"

    if len(text) > 130:
        text = text[:127] + "..."

    return text


def _vibe_label(effective_strength: float) -> str:
    if effective_strength >= 1.2:
        return "High Energy"
    if effective_strength >= 0.8:
        return "Solid Spot"
    return "Calm"


def _build_decide_response(
    candidate: Candidate,
    context_state_id: uuid.UUID | None,
    rationale: str,
) -> DecideResponse:
    trust_attributions: list[TrustAttribution] = []
    primary_signal: PrimarySignal | None = None

    name = _get_best_name(candidate)
    bundle = candidate.trust_context.signal_bundle

    if candidate.trust_context.is_friend_checkin or bundle:
        strongest_for_vibe = (
            max(candidate.matched_signals, key=lambda item: item.effective_strength)
            if candidate.matched_signals
            else None
        )
        trust_attributions.append(
            TrustAttribution(
                user_name=name,
                signal_summary=candidate.trust_context.interaction_type or "LIVE_SIGNAL",
                vibe_label=_vibe_label(strongest_for_vibe.effective_strength) if strongest_for_vibe else "Solid Spot",
            )
        )

    if candidate.matched_signals:
        strongest = max(candidate.matched_signals, key=lambda item: item.effective_strength)
        signal_comment = _clean_text(candidate.trust_context.signal_text) or _clean_text(strongest.content)
        
        primary_signal = PrimarySignal(
            user_name=name,
            timestamp=strongest.emitted_at,
            vibe_label=_vibe_label(strongest.effective_strength),
            comment=signal_comment or "Confirmed the vibe.",
        )

    primary = OpportunityOut(
        id=uuid.uuid4(),
        venue_name=candidate.venue_name,
        category=candidate.category,
        distance_meters=candidate.distance_meters,
        eta_minutes=candidate.eta_minutes,
        rationale=rationale,
        trust_attributions=trust_attributions,
        geo=candidate.geo,
        is_primary=True,
        event=None,
        primary_signal=primary_signal,
    )

    return DecideResponse(
        primary=primary,
        fallbacks=[],
        context_state_id=context_state_id or uuid.uuid4(),
    )


def _build_prompt(context: ContextState, candidate_set: CandidateSet) -> str:
    prompt_payload = {
        "context": {
            "time": context.time_of_day,
            "weather": context.weather_condition,
            "intent": context.intent_declared,
        },
        "candidates": [
            {
                "place_id": c.place_id,
                "venue_name": c.venue_name,
                "human_name": _get_best_name(c),
                "interaction": c.trust_context.interaction_type,
                "env": c.trust_context.environmental_context,
                "signal_text": c.trust_context.signal_text,
                "bundle": (
                    {
                        "type": c.trust_context.signal_bundle.signal_type,
                        "mins_ago": c.trust_context.signal_bundle.minutes_ago,
                    }
                    if c.trust_context.signal_bundle
                    else None
                ),
                "eta": c.eta_minutes,
            } for c in candidate_set.candidates[:5]
        ],
    }

    return (
        "SYSTEM: You are the 'Spontaneity Engine' for HADE. You are a confident urban insider.\n"
        "MISSION: Select ONE primary candidate and write a human-to-human rationale.\n"
        "UI CONTEXT: This rationale is the LARGE HEADLINE of a mobile card. It must be high-impact.\n"
        "VOICE RULES:\n"
        "- Use PRESENT TENSE only.\n"
        "- HUMAN-CENTRIC: Always lead with the human_name. Use the 'mins_ago' to prove freshness.\n"
        "- CONTEXTUAL: Mention weather ('dry spot') or time if it matches the 'context' block.\n"
        "- NO MARKETING: Banned words: trending, discover, popular, explore, curated.\n"
        "- EXAMPLE: 'Maya is here. It's the perfect dry spot for a drink while it's raining.'\n"
        f"INPUT: {json.dumps(prompt_payload)}\n"
        "OUTPUT JSON: {\"empty_state\": bool, \"reason\": string|null, \"selected_place_id\": string|null, \"rationale\": string|null}"
    )


async def _call_gemini(prompt: str) -> LlmDecisionPayload:
    if not settings.gemini_api_key:
        raise ValueError("GEMINI_API_KEY not configured")

    model_name = settings.gemini_model or "gemini-1.5-flash"
    url = f"{GEMINI_API_BASE}/{model_name}:generateContent"
    timeout_s = max(1.0, settings.gemini_timeout_ms / 1000.0)

    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.25,
            "maxOutputTokens": 200,
            "response_mime_type": "application/json",
        },
    }

    async with httpx.AsyncClient(timeout=timeout_s) as client:
        response = await client.post(url, params={"key": settings.gemini_api_key}, json=payload)
        response.raise_for_status()
        body = response.json()

    text = body["candidates"][0]["content"]["parts"][0]["text"]
    return LlmDecisionPayload.model_validate_json(text)


async def make_llm_decision(
    candidate_set: CandidateSet,
    context: ContextState,
) -> LlmDecisionResult:
    """Generate one confident decision using Gemini 1.5 Flash."""
    model_name = settings.gemini_model or "gemini-1.5-flash"

    if not candidate_set.candidates or _top_confidence(candidate_set) < MIN_CONFIDENCE_FOR_DECISION:
        return LlmDecisionResult(None, LLM_EMPTY_REASON_DEFAULT, False, model_name)

    try:
        llm_payload = await _call_gemini(_build_prompt(context, candidate_set))
    except Exception as e:
        logger.error(f"Gemini Error: {e}")
        top = candidate_set.candidates[0]
        return LlmDecisionResult(_build_decide_response(top, candidate_set.context_state_id, _fallback_rationale(top)))

    if llm_payload.empty_state:
        return LlmDecisionResult(None, _clean_text(llm_payload.reason), True, model_name)

    selected = candidate_set.candidates[0]
    if llm_payload.selected_place_id:
        for c in candidate_set.candidates:
            if c.place_id == llm_payload.selected_place_id:
                selected = c
                break

    rationale = _enforce_voice(llm_payload.rationale, selected)
    
    return LlmDecisionResult(
        decision=_build_decide_response(selected, candidate_set.context_state_id, rationale),
        model_name=model_name
    )