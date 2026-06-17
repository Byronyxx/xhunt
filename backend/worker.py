"""
Celery background worker for X-Hunt async tasks:
- Mission matching
- Evidence verification
- Hunter Score updates
- Reward distribution
- Notification dispatch
"""
from celery import Celery
from config import settings

celery_app = Celery(
    'xhunt',
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    task_serializer='json',
    result_serializer='json',
    accept_content=['json'],
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
)


@celery_app.task(name='tasks.compute_match_score')
def compute_match_score(user_id: str, mission_id: str) -> dict:
    """Compute AI match score between a hunter and a mission."""
    from database import get_db
    db = get_db()
    # Fetch hunter profile + skills
    profile = db.table('user_profiles').select(
        'id, display_name, role'
    ).eq('id', user_id).execute().data

    if not profile:
        return {'score': 0, 'reason': 'user_not_found'}

    # Placeholder: real implementation queries mission requirements + hunter skills
    return {'user_id': user_id, 'mission_id': mission_id, 'score': 75, 'status': 'computed'}


@celery_app.task(name='tasks.verify_evidence')
def verify_evidence(submission_id: str, evidence_urls: list[str]) -> dict:
    """Verify mission completion evidence (AI-assisted)."""
    # Placeholder: integrates with vision model for photo/video evidence
    return {
        'submission_id': submission_id,
        'verified': True,
        'confidence': 0.92,
        'flags': [],
    }


@celery_app.task(name='tasks.update_hunter_score')
def update_hunter_score(user_id: str) -> dict:
    """Recalculate a hunter's reputation score (MEI)."""
    from database import get_db
    db = get_db()
    # Aggregate: missions completed, peer verifications, contribution quality, time
    # Placeholder score calculation
    score = 720
    db.table('user_profiles').update({
        'hunter_score': score,
    }).eq('id', user_id).execute()
    return {'user_id': user_id, 'hunter_score': score}


@celery_app.task(name='tasks.distribute_rewards')
def distribute_rewards(mission_id: str, winner_user_id: str, amount_xil: float) -> dict:
    """Process reward distribution for a completed mission."""
    from database import get_db
    db = get_db()
    # Record reward transaction
    db.table('xil_transactions').insert({
        'mission_id': mission_id,
        'recipient_id': winner_user_id,
        'amount': amount_xil,
        'type': 'mission_reward',
        'status': 'pending',
    }).execute()
    return {'mission_id': mission_id, 'recipient': winner_user_id, 'amount': amount_xil}


@celery_app.task(name='tasks.send_notification')
def send_notification(user_id: str, notification_type: str, payload: dict) -> dict:
    """Queue a push / in-app notification."""
    from database import get_db
    db = get_db()
    db.table('notifications').insert({
        'user_id': user_id,
        'type': notification_type,
        'payload': payload,
        'read': False,
    }).execute()
    return {'sent': True}
