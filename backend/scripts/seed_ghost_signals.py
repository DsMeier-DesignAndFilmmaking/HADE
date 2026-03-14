#!/usr/bin/env python3
"""Ghost Signal Injection — Denver Trust vs. Decay Test.

REVISED: Bypasses Auth FK constraints and ensures reciprocal trust logic.
"""

import argparse
import math
import sys
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Add the backend root to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import create_engine, delete, select, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.signal import Signal, SignalType
from app.models.user import User
from app.models.venue import Venue

# ---------------------------------------------------------------------------
# Seed constants
# ---------------------------------------------------------------------------
VENUE_GEO_LNG = 35.6595
VENUE_GEO_LAT = 139.7005

PHONE_ME = "+15550000001"
PHONE_A = "+15550000002"  # Alex (Mutual Friend)
PHONE_B = "+15550000003"  # Jordan (Follower/Single-way)
PHONE_C = "+15550000004"  # Sam (Stranger)

ME_USER_ID = uuid.UUID("95b26464-cc17-4724-9a76-d9d6c424d3b5")

SIGNAL_STRENGTH = 0.8
PRESENCE_HALF_LIFE_S = 15 * 60 

SAM_GLENDALE_PLACE_ID = "ChIJy0fuetN9bIcRfTivsjBIIPw"
STARBUCKS_PLACE_ID = "ChIJ1xaGLX9-bIcRhMHGQWfsjQs"

def _wkt(lng: float, lat: float) -> str:
    return f"POINT({lng} {lat})"

def _get_engine():
    # Use the sync URL and standard psycopg2 driver
    url = settings.SYNC_DATABASE_URL
    return create_engine(url)

# ---------------------------------------------------------------------------
# Upsert helpers
# ---------------------------------------------------------------------------

def _upsert_user(session: Session, phone: str, name: str) -> User:
    user = session.execute(select(User).where(User.phone == phone)).scalar_one_or_none()
    if user is None:
        user = User(
            id=uuid.uuid4(),
            phone=phone,
            name=name,
            home_city="Denver, CO",
            onboarding_complete=True,
        )
        session.add(user)
    else:
        user.name = name
    return user


def _upsert_me_user(session: Session, phone: str, name: str, user_id: uuid.UUID) -> User:
    user = session.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if user is None:
        user = session.execute(select(User).where(User.phone == phone)).scalar_one_or_none()
    if user is None:
        user = User(
            id=user_id,
            phone=phone,
            name=name,
            home_city="Denver, CO",
            onboarding_complete=True,
        )
        session.add(user)
    else:
        if user.id != user_id:
            raise ValueError(
                f"Existing user for {phone} has id={user.id}, expected {user_id}. "
                "Update ME_USER_ID or delete the existing user before seeding."
            )
        user.name = name
    return user

def _establish_friendship(session: Session, user_id: uuid.UUID, friend_id: uuid.UUID, reciprocal: bool = False):
    """
    Direct SQL to match public.friendships schema.
    """
    pairs = [(user_id, friend_id)]
    if reciprocal:
        pairs.append((friend_id, user_id))
    
    for u_id, f_id in pairs:
        session.execute(text("""
            INSERT INTO public.friendships (user_id, friend_id, status)
            VALUES (:u_id, :f_id, 'accepted')
            ON CONFLICT (user_id, friend_id) DO NOTHING
        """), {"u_id": u_id, "f_id": f_id})

def _upsert_signal(session: Session, source_user: User, venue: Venue, emitted_at: datetime, expires_at: datetime, content: str = None):
    sig = session.execute(select(Signal).where(
        Signal.source_user_id == source_user.id,
        Signal.venue_id == venue.id
    )).scalar_one_or_none()
    
    if sig is None:
        sig = Signal(
            id=uuid.uuid4(),
            type=SignalType.PRESENCE,
            source_user_id=source_user.id,
            venue_id=venue.id,
            strength=SIGNAL_STRENGTH,
            emitted_at=emitted_at,
            expires_at=expires_at,
            geo=_wkt(VENUE_GEO_LNG, VENUE_GEO_LAT),
            content=content
        )
        session.add(sig)
    else:
        sig.emitted_at = emitted_at
        sig.expires_at = expires_at
    return sig

# ---------------------------------------------------------------------------
# Seed Execution
# ---------------------------------------------------------------------------

def seed() -> None:
    engine = _get_engine()
    now = datetime.now(timezone.utc)

    with Session(engine) as session:
        # 0. DISABLE CONSTRAINTS for Ghost Session
        # This allows friendships to reference IDs not in auth.users
        session.execute(text("SET session_replication_role = 'replica';"))

        # 1. Users
        me = _upsert_me_user(session, PHONE_ME, "Test User (Me)", ME_USER_ID)
        alex = _upsert_user(session, PHONE_A, "Alex Mercer")
        jordan = _upsert_user(session, PHONE_B, "Jordan Kim")
        sam = _upsert_user(session, PHONE_C, "Sam Rivera")
        
        # CRITICAL: Flush so IDs exist before friendship insertion
        session.flush()

        # 2. Venue
        venue = session.execute(
            select(Venue).where(Venue.external_id == SAM_GLENDALE_PLACE_ID)
        ).scalar_one_or_none()
        if not venue:
            venue = session.execute(
                select(Venue).where(Venue.external_id == STARBUCKS_PLACE_ID)
            ).scalar_one_or_none()
        if not venue:
            venue = Venue(
                id=uuid.uuid4(),
                name="Sam's No. 3 Glendale",
                external_id=SAM_GLENDALE_PLACE_ID,
                geo=_wkt(VENUE_GEO_LNG, VENUE_GEO_LAT),
            )
            session.add(venue)
        session.flush()

        # 3. Friendships
        _establish_friendship(session, me.id, alex.id, reciprocal=True)   # 10x Trust
        _establish_friendship(session, me.id, jordan.id, reciprocal=True) # 10x Trust

        # 4. Signals
        _upsert_signal(session, alex, venue, now - timedelta(hours=2), now + timedelta(hours=4), "Alex was here earlier.")
        _upsert_signal(session, jordan, venue, now - timedelta(minutes=30), now + timedelta(minutes=15), "Jordan is nearby.")
        _upsert_signal(session, sam, venue, now - timedelta(minutes=5), now + timedelta(minutes=40), "Someone new just arrived.")

        # Re-enable constraints
        session.execute(text("SET session_replication_role = 'origin';"))
        session.commit()
        
    print("✅ Ghost signals and mutual friendships seeded successfully.")

def teardown() -> None:
    engine = _get_engine()
    with Session(engine) as session:
        phones = [PHONE_ME, PHONE_A, PHONE_B, PHONE_C]
        users = session.execute(select(User).where(User.phone.in_(phones))).scalars().all()
        u_ids = [u.id for u in users]
        
        if u_ids:
            session.execute(text("DELETE FROM public.friendships WHERE user_id = ANY(:ids) OR friend_id = ANY(:ids)"), {"ids": u_ids})
            session.execute(delete(Signal).where(Signal.source_user_id.in_(u_ids)))
            session.execute(delete(User).where(User.id.in_(u_ids)))
        
        session.execute(
            delete(Venue).where(
                Venue.external_id.in_([SAM_GLENDALE_PLACE_ID, STARBUCKS_PLACE_ID])
            )
        )
        session.commit()
    print("✅ Seed data purged.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--teardown", action="store_true")
    args = parser.parse_args()
    teardown() if args.teardown else seed()
