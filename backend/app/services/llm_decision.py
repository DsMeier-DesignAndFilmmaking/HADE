"""LLM-backed decision service using Gemini 1.5 Flash and OpenAI GPT-4o.

Selects one primary candidate or returns an honest empty state.
Optimized for the "Rationale-as-Headline" HADE UX pattern.
"""

from __future__ import annotations

import json
import logging
import re
import uuid
from dataclasses import dataclass

import httpx
from openai import AsyncOpenAI
from pydantic import BaseModel, ValidationError

from app.core.config import settings
from app.models.context_state import ContextState
from app.schemas.candidate import Candidate, CandidateSet
from app.schemas.decide import (
    DecideResponse,
    OpportunityOut,
    PrimarySignal,
    TrustAttribution,
)

logger = logging.getLogger(__name__)

# -----------------------------------------------------------------------------
# Config
# -----------------------------------------------------------------------------

MIN_CONFIDENCE_FOR_DECISION = 0.5
LLM_EMPTY_REASON_DEFAULT = "Nothing great right now — check back around 7."

# Gemini configuration
GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

LLM_TIMEOUT = 10.0

_BANNED_TERMS = {
    "trending", "discover", "explore", "popular", "top-rated",
    "hot right now", "users like you", "based on your preferences",
    "curated", "recommended", "personalized", "check out",
}

# -----------------------------------------------------------------------------
# Schemas
# -----------------------------------------------------------------------------

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


# -----------------------------------------------------------------------------
# Utility Functions
# -----------------------------------------------------------------------------

def _top_confidence(candidate_set: CandidateSet) -> float:
    if not candidate_set.candidates:
        return 0.0
    return max(c.score for c in candidate_set.candidates)


def _clean_text(value: str | None) -> str:
    if not value:
        return ""
    cleaned = value.replace('"', "")
    return re.sub(r"\s+", " ", cleaned).strip()


def _get_best_name(candidate: Candidate) -> str:
    bundle = candidate.trust_context.signal_bundle
    if bundle and bundle.user_first_name:
        return bundle.user_first_name
    return candidate.trust_context.operator_name or "A friend"


def _fallback_rationale(candidate: Candidate) -> str:
    name = _get_best_name(candidate)
    signal = _clean_text(candidate.trust_context.signal_text)
    bundle = candidate.trust_context.signal_bundle
    time_str = "just now"

    if bundle and bundle.minutes_ago:
        if bundle.minutes_ago < 60:
            time_str = f"{bundle.minutes_ago}m ago"

    if signal:
        return f'{name} is here {time_str}: "{signal}"'
    return f"{name} is here {time_str}. It's active and only {candidate.eta_minutes}m away."


def _enforce_voice(rationale: str | None, candidate: Candidate) -> str:
    text = _clean_text(rationale)
    if not text:
        return _fallback_rationale(candidate)
    if any(term in text.lower() for term in _BANNED_TERMS):
        return _fallback_rationale(candidate)

    name = _get_best_name(candidate)
    if name.lower() not in text.lower() and name != "A friend":
        text = f"{name} is here. {text}"
    return text[:130]


def _vibe_label(strength: float) -> str:
    if strength >= 0.9: return "High Energy"
    if strength >= 0.6: return "Solid Spot"
    return "Calm"


# -----------------------------------------------------------------------------
# Prompt Builder
# -----------------------------------------------------------------------------

def _build_prompt(
    context: ContextState,
    candidate_set: CandidateSet,
    rejection_history: list[dict] | None = None,
) -> str:
    """
    Constructs the Agentic Prompt with the strict JSON schema confirmed via testing.
    Appends a Negative Constraints block when the session has rejection history.
    """
    candidates_data = [
        {
            "place_id": c.place_id,
            "venue_name": c.venue_name,
            "human_name": _get_best_name(c),
            "signal_text": c.trust_context.signal_text,
            "mins_ago": c.trust_context.signal_bundle.minutes_ago if c.trust_context.signal_bundle else 0,
            "eta": c.eta_minutes,
        }
        for c in candidate_set.candidates[:5]
    ]

    # Build the optional negative constraints block — appended only when rejections exist.
    # We use venue_name (not UUID) so the LLM can match against the candidates list.
    negative_block = ""
    if rejection_history:
        lines = "\n".join(
            f'- "{r.get("venue_name", r.get("venue_id", "unknown"))}" '
            f'(user pivot: {r.get("pivot_reason", "unknown")})'
            for r in rejection_history
        )
        negative_block = (
            f"\nNEGATIVE CONSTRAINTS — the user already rejected these venues this session. "
            f"Do NOT select them:\n{lines}\n"
            f"Choose a venue that is NOT in this list.\n"
        )

    # Double braces {{ }} are required for Python .format() literal strings
    return f"""
You are the HADE spontaneity engine. Your goal is to choose the best venue for a user based on live human activity.

CONTEXT:
- Intent: {context.intent_declared}
- Time: {context.time_of_day}
- Weather: {context.weather_condition}

CANDIDATES:
{json.dumps(candidates_data)}

STRICT OUTPUT SCHEMA:
{{
  "empty_state": bool,
  "reason": "Used only if empty_state is true",
  "selected_place_id": "string matching one of the place_ids above",
  "rationale": "One sensory sentence starting with the human_name. Example: 'Maya is here: the fireplace is active and vibe is low-fi.'"
}}

RULES:
1. Lead with the human name in the rationale.
2. Present tense only.
3. Return ONLY valid JSON. No markdown backticks.
{negative_block}"""

# -----------------------------------------------------------------------------
# Gemini Provider
# -----------------------------------------------------------------------------

async def _call_gemini(prompt: str) -> LlmDecisionPayload:
    if not settings.gemini_api_key:
        raise ValueError("GEMINI_API_KEY missing")

    params = {"key": settings.gemini_api_key}
    
    # Payload updated to match your successful CURL test
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}]
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "response_mime_type": "application/json"
        }
    }

    async with httpx.AsyncClient(timeout=LLM_TIMEOUT) as client:
        response = await client.post(GEMINI_URL, params=params, json=payload)

    if response.status_code != 200:
        logger.error(f"Gemini API Error {response.status_code}: {response.text[:500]}")
        response.raise_for_status()

    data = response.json()
    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        return LlmDecisionPayload.model_validate_json(text)
    except (KeyError, IndexError, ValidationError) as e:
        logger.error("Gemini parse failure", extra={"response": data})
        raise e

# -----------------------------------------------------------------------------
# OpenAI Provider
# -----------------------------------------------------------------------------

async def _call_openai(prompt: str) -> LlmDecisionPayload:
    if not settings.openai_api_key:
        raise ValueError("OPENAI_API_KEY missing")

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    response = await client.chat.completions.create(
        model="gpt-4o",
        temperature=0.1,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": "Return only valid JSON."},
            {"role": "user", "content": prompt},
        ],
    )
    content = response.choices[0].message.content
    return LlmDecisionPayload.model_validate_json(content)

# -----------------------------------------------------------------------------
# Main Decision Entry
# -----------------------------------------------------------------------------

async def make_llm_decision(
    candidate_set: CandidateSet,
    context: ContextState,
    provider: str = "gemini",
    rejection_history: list[dict] | None = None,
) -> LlmDecisionResult:

    # 1. Rule-based check: If no candidates or low confidence, skip LLM
    if not candidate_set.candidates or _top_confidence(candidate_set) < MIN_CONFIDENCE_FOR_DECISION:
        return LlmDecisionResult(
            decision=None,
            empty_reason=LLM_EMPTY_REASON_DEFAULT,
            used_llm=False,
            model_name="rule-engine",
        )

    # 2. Build the Agentic Prompt (with optional rejection constraints)
    prompt = _build_prompt(context, candidate_set, rejection_history=rejection_history)

    try:
        # 3. Call the chosen AI provider
        if provider == "openai":
            payload = await _call_openai(prompt)
        else:
            payload = await _call_gemini(prompt)

    except Exception as e:
        logger.error(f"LLM Decision Failure ({provider}): {type(e).__name__} - {e}")
        # Fallback to the top candidate (Mock-like behavior but with real data)
        top = candidate_set.candidates[0]
        return LlmDecisionResult(
            decision=_build_decide_response(top, candidate_set.context_state_id, _fallback_rationale(top)),
            used_llm=False,
            model_name=f"{provider}-fallback",
        )

    # 4. Process the AI Decision
    if payload.empty_state:
        return LlmDecisionResult(
            decision=None,
            empty_reason=_clean_text(payload.reason) or LLM_EMPTY_REASON_DEFAULT,
            used_llm=True,
            model_name=provider,
        )

    # Find the specific candidate the AI selected
    selected = candidate_set.candidates[0]
    if payload.selected_place_id:
        for c in candidate_set.candidates:
            if c.place_id == payload.selected_place_id:
                selected = c
                break

    # Enforce voice rules on the rationale returned by AI
    rationale = _enforce_voice(payload.rationale, selected)

    return LlmDecisionResult(
        decision=_build_decide_response(selected, candidate_set.context_state_id, rationale),
        used_llm=True,
        model_name=provider,
    )

# -----------------------------------------------------------------------------
# Response Builder
# -----------------------------------------------------------------------------

def _build_decide_response(
    candidate: Candidate,
    context_state_id: uuid.UUID | None,
    rationale: str,
) -> DecideResponse:
    name = _get_best_name(candidate)
    primary_signal = None

    if candidate.matched_signals:
        strongest = max(candidate.matched_signals, key=lambda s: s.effective_strength)
        primary_signal = PrimarySignal(
            user_name=name,
            timestamp=strongest.emitted_at,
            vibe_label=_vibe_label(strongest.effective_strength),
            comment=_clean_text(candidate.trust_context.signal_text) or "Confirmed the vibe.",
        )

    return DecideResponse(
        primary=OpportunityOut(
            id=uuid.uuid4(),
            venue_name=candidate.venue_name,
            category=candidate.category,
            distance_meters=candidate.distance_meters,
            eta_minutes=candidate.eta_minutes,
            rationale=rationale,
            trust_attributions=[
                TrustAttribution(
                    user_name=name,
                    signal_summary=candidate.trust_context.interaction_type or "LIVE_SIGNAL",
                    vibe_label=_vibe_label(candidate.score / 2.0),
                )
            ],
            geo=candidate.geo,
            is_primary=True,
            primary_signal=primary_signal,
        ),
        fallbacks=[],
        context_state_id=context_state_id or uuid.uuid4(),
    )