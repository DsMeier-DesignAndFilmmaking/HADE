import uuid
from datetime import UTC, datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db
from app.core.security import get_current_user_id
from app.models.context_state import ContextState
from app.models.moment import Moment
from app.models.moment import MomentAction as MomentActionModel
from app.models.opportunity import Opportunity
from app.models.venue import Venue
from app.schemas.common import ApiResponse, ResponseMeta
from app.schemas.moment import MomentAction, MomentCreate, MomentResponse
from app.workers.trust_recompute import boost_network_trust_scores_async

router = APIRouter(tags=["moments"])
REDACTED_MOMENT_RATIONALE = "feedback_event"


def _action_flags(action: MomentActionModel) -> tuple[bool, bool, datetime | None]:
    acted_on = action == MomentActionModel.ACCEPTED
    dismissed = action == MomentActionModel.DISMISSED
    acted_at = datetime.now(UTC) if acted_on else None
    return acted_on, dismissed, acted_at


def _moment_to_response(moment: Moment) -> MomentResponse:
    return MomentResponse(
        id=moment.id,
        context_state_id=moment.context_state_id,
        opportunity_id=moment.opportunity_id,
        action=MomentAction(moment.action.value),
        acted_on=moment.acted_on,
        dismissed=moment.dismissed,
        acted_at=moment.acted_at,
        surfaced_at=moment.surfaced_at,
    )


async def _resolve_opportunity(
    db: AsyncSession,
    opportunity_id: UUID,
    user_id: UUID,
) -> Opportunity | None:
    opportunity = await db.get(Opportunity, opportunity_id)
    if opportunity is None:
        return None
    if opportunity.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Opportunity does not belong to authenticated user",
        )
    return opportunity


@router.post(
    "/moments",
    response_model=ApiResponse[MomentResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_moment(
    payload: MomentCreate,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[MomentResponse]:
    """Record moment feedback without storing user-generated PII payloads."""
    context_state = await db.get(ContextState, payload.context_state_id)
    if context_state is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Context state not found")
    if context_state.user_id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Context state does not belong to authenticated user",
        )

    opportunity = await _resolve_opportunity(db, payload.opportunity_id, user_id)

    if opportunity and payload.context_state_id != opportunity.context_state_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="context_state_id does not match opportunity context",
        )

    model_action = MomentActionModel(payload.action.value)
    acted_on, dismissed, acted_at = _action_flags(model_action)
    venue_id = payload.venue_id or (opportunity.venue_id if opportunity else None)
    if venue_id is not None:
        venue = await db.get(Venue, venue_id)
        if venue is None:
            venue_id = None

    moment = Moment(
        user_id=user_id,
        venue_id=venue_id,
        context_state_id=payload.context_state_id,
        opportunity_id=payload.opportunity_id,
        action=model_action,
        opportunity_score=opportunity.opportunity_score if opportunity else 0.0,
        trust_score=float(len(opportunity.trust_attribution or [])) if opportunity else 0.0,
        rationale=REDACTED_MOMENT_RATIONALE,
        acted_on=acted_on,
        acted_at=acted_at,
        dismissed=dismissed,
    )
    db.add(moment)

    if model_action == MomentActionModel.ACCEPTED and venue_id is not None:
        await boost_network_trust_scores_async(
            db=db,
            venue_id=venue_id,
            source_user_id=user_id,
        )

    await db.commit()
    await db.refresh(moment)
    return ApiResponse(
        status="ok",
        data=_moment_to_response(moment),
        meta=ResponseMeta(
            request_id=uuid.uuid4(),
            context_state_id=moment.context_state_id,
        ),
    )


@router.post("/moments/{moment_id}/act", response_model=ApiResponse[dict])
async def act_on_moment(
    moment_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict]:
    """Log that user acted on a recommendation."""
    result = await db.execute(
        select(Moment).where(
            Moment.id == moment_id,
            Moment.user_id == user_id,
        )
    )
    moment = result.scalar_one_or_none()
    if moment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Moment not found")

    moment.action = MomentActionModel.ACCEPTED
    moment.acted_on, moment.dismissed, moment.acted_at = _action_flags(moment.action)

    if moment.venue_id is not None:
        await boost_network_trust_scores_async(
            db=db,
            venue_id=moment.venue_id,
            source_user_id=user_id,
        )

    await db.commit()
    return ApiResponse(
        status="ok",
        data={"moment_id": str(moment.id), "action": moment.action.value},
        meta=ResponseMeta(request_id=uuid.uuid4(), context_state_id=moment.context_state_id),
    )


@router.post("/moments/{moment_id}/dismiss", response_model=ApiResponse[dict])
async def dismiss_moment(
    moment_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ApiResponse[dict]:
    """Log that user dismissed a recommendation."""
    result = await db.execute(
        select(Moment).where(
            Moment.id == moment_id,
            Moment.user_id == user_id,
        )
    )
    moment = result.scalar_one_or_none()
    if moment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Moment not found")

    moment.action = MomentActionModel.DISMISSED
    moment.acted_on, moment.dismissed, moment.acted_at = _action_flags(moment.action)

    await db.commit()
    return ApiResponse(
        status="ok",
        data={"moment_id": str(moment.id), "action": moment.action.value},
        meta=ResponseMeta(request_id=uuid.uuid4(), context_state_id=moment.context_state_id),
    )
