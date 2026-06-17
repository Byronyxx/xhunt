"""
Celery background worker for X-Hunt async tasks:
- Mission matching
- Evidence verification
- Hunter Score updates
- Reward distribution
- Notification dispatch
"""
import os
import math
from datetime import datetime, timezone
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

    profile_resp = db.table('user_profiles').select(
        'id, display_name, hunter_score'
    ).eq('id', user_id).execute()
    if not profile_resp.data:
        return {'score': 0, 'reason': 'user_not_found'}

    mission_resp = db.table('missions').select(
        'id, difficulty, xil_reward, required_skills'
    ).eq('id', mission_id).execute()
    if not mission_resp.data:
        return {'score': 0, 'reason': 'mission_not_found'}

    mission = mission_resp.data[0]
    profile = profile_resp.data[0]

    # Fetch verified skills for this user
    skills_resp = db.table('skill_verifications').select(
        'skill_name, confidence'
    ).eq('user_id', user_id).eq('verified', True).execute()
    user_skills = {s['skill_name'].lower() for s in (skills_resp.data or [])}

    required = [r.lower() for r in (mission.get('required_skills') or [])]
    skill_match = (
        len([r for r in required if r in user_skills]) / len(required)
        if required else 1.0
    )

    # Difficulty penalty: hunters with lower hunter_score penalised on hard missions
    difficulty_map = {'easy': 1, 'medium': 2, 'hard': 3, 'expert': 4}
    difficulty = difficulty_map.get(mission.get('difficulty', 'medium'), 2)
    hunter_score = profile.get('hunter_score') or 500
    normalized_score = min(hunter_score / 1000.0, 1.0)
    difficulty_fit = 1.0 - max(0, (difficulty / 4.0) - normalized_score)

    # Reward attraction: higher reward = slight boost to match score
    xil_reward = mission.get('xil_reward') or 100
    reward_factor = min(math.log1p(xil_reward) / math.log1p(10000), 1.0)

    composite = (skill_match * 0.55) + (difficulty_fit * 0.35) + (reward_factor * 0.10)
    final_score = round(composite * 100)

    # Persist to match_signals table
    db.table('match_signals').upsert({
        'user_id': user_id,
        'mission_id': mission_id,
        'score': final_score,
        'computed_at': datetime.now(timezone.utc).isoformat(),
    }, on_conflict='user_id,mission_id').execute()

    return {
        'user_id': user_id,
        'mission_id': mission_id,
        'score': final_score,
        'skill_match': round(skill_match * 100),
        'difficulty_fit': round(difficulty_fit * 100),
        'status': 'computed',
    }


@celery_app.task(name='tasks.verify_evidence')
def verify_evidence(submission_id: str, evidence_urls: list[str]) -> dict:
    """Verify mission completion evidence using AI vision."""
    from database import get_db
    import httpx

    db = get_db()

    submission_resp = db.table('mission_submissions').select(
        'id, mission_id, user_id, notes'
    ).eq('id', submission_id).execute()
    if not submission_resp.data:
        return {'submission_id': submission_id, 'verified': False, 'reason': 'not_found'}

    submission = submission_resp.data[0]

    groq_key = os.environ.get('GROQ_API_KEY', '')
    verified = False
    confidence = 0.0
    flags: list[str] = []

    if groq_key and evidence_urls:
        try:
            messages = [
                {
                    'role': 'user',
                    'content': [
                        {
                            'type': 'text',
                            'text': (
                                'You are an evidence verifier for X-Hunt missions. '
                                'Review the provided image(s) and determine if they credibly '
                                'demonstrate mission completion. Reply with JSON: '
                                '{"verified": true/false, "confidence": 0.0-1.0, "flags": []}'
                            ),
                        },
                        *[
                            {'type': 'image_url', 'image_url': {'url': url}}
                            for url in evidence_urls[:4]
                        ],
                    ],
                }
            ]
            with httpx.Client(timeout=30) as client:
                resp = client.post(
                    'https://api.groq.com/openai/v1/chat/completions',
                    headers={'Authorization': f'Bearer {groq_key}'},
                    json={
                        'model': 'llama-3.2-11b-vision-preview',
                        'messages': messages,
                        'max_tokens': 256,
                        'response_format': {'type': 'json_object'},
                    },
                )
                if resp.status_code == 200:
                    import json
                    result = json.loads(
                        resp.json()['choices'][0]['message']['content']
                    )
                    verified = bool(result.get('verified', False))
                    confidence = float(result.get('confidence', 0.0))
                    flags = list(result.get('flags', []))
        except Exception as exc:
            flags.append(f'vision_error: {exc}')
            # Fall back to manual review
            verified = False
            confidence = 0.0

    status = 'verified' if verified else 'pending_review'
    db.table('mission_submissions').update({
        'status': status,
        'ai_confidence': confidence,
        'ai_flags': flags,
        'reviewed_at': datetime.now(timezone.utc).isoformat(),
    }).eq('id', submission_id).execute()

    if verified:
        distribute_rewards.delay(
            submission['mission_id'],
            submission['user_id'],
            0,  # amount resolved from mission record inside distribute_rewards
        )

    return {
        'submission_id': submission_id,
        'verified': verified,
        'confidence': confidence,
        'flags': flags,
    }


@celery_app.task(name='tasks.update_hunter_score')
def update_hunter_score(user_id: str) -> dict:
    """Recalculate a hunter's reputation score (MEI)."""
    from database import get_db
    db = get_db()

    # Missions completed (weighted by difficulty)
    difficulty_weight = {'easy': 1, 'medium': 2, 'hard': 3, 'expert': 4}
    subs_resp = db.table('mission_submissions').select(
        'status, missions(difficulty)'
    ).eq('user_id', user_id).eq('status', 'verified').execute()

    mission_points = sum(
        difficulty_weight.get(
            (s.get('missions') or {}).get('difficulty', 'easy'), 1
        )
        for s in (subs_resp.data or [])
    )

    # Contribution quality: count of approved ledger entries
    ledger_resp = db.table('contribution_ledger').select(
        'amount'
    ).eq('user_id', user_id).eq('status', 'approved').execute()
    contribution_total = sum(
        float(r.get('amount', 0)) for r in (ledger_resp.data or [])
    )

    # Trust score
    trust_resp = db.table('trust_scores').select(
        'score'
    ).eq('user_id', user_id).execute()
    trust = float((trust_resp.data or [{}])[0].get('score', 0))

    # MEI formula: weighted composite, max ~1000
    mei = min(
        round(
            (mission_points * 15)
            + (min(contribution_total / 100.0, 300))
            + (trust * 2)
        ),
        1000,
    )

    db.table('user_profiles').update({
        'hunter_score': mei,
        'updated_at': datetime.now(timezone.utc).isoformat(),
    }).eq('id', user_id).execute()

    return {'user_id': user_id, 'hunter_score': mei}


@celery_app.task(name='tasks.distribute_rewards')
def distribute_rewards(mission_id: str, winner_user_id: str, amount_xil: float) -> dict:
    """Process reward distribution for a completed mission."""
    from database import get_db
    db = get_db()

    # Resolve reward from mission if amount_xil not provided
    if amount_xil <= 0:
        mission_resp = db.table('missions').select('xil_reward').eq('id', mission_id).execute()
        if mission_resp.data:
            amount_xil = float(mission_resp.data[0].get('xil_reward', 0))

    if amount_xil <= 0:
        return {'error': 'no_reward_amount', 'mission_id': mission_id}

    now = datetime.now(timezone.utc).isoformat()

    # Insert reward event
    db.table('reward_events').insert({
        'mission_id': mission_id,
        'user_id': winner_user_id,
        'amount_xil': amount_xil,
        'status': 'distributed',
        'distributed_at': now,
    }).execute()

    # Credit contribution ledger
    db.table('contribution_ledger').insert({
        'user_id': winner_user_id,
        'amount': amount_xil,
        'type': 'mission_reward',
        'reference_id': mission_id,
        'status': 'approved',
        'created_at': now,
    }).execute()

    # Mark mission complete
    db.table('missions').update({
        'status': 'completed',
        'completed_at': now,
    }).eq('id', mission_id).execute()

    # Trigger score update and notification
    update_hunter_score.delay(winner_user_id)
    send_notification.delay(winner_user_id, 'mission_complete', {
        'mission_id': mission_id,
        'amount_xil': amount_xil,
    })

    return {
        'mission_id': mission_id,
        'recipient': winner_user_id,
        'amount_xil': amount_xil,
        'status': 'distributed',
    }


@celery_app.task(name='tasks.send_notification')
def send_notification(user_id: str, notification_type: str, payload: dict) -> dict:
    """Write in-app notification and optionally send transactional email."""
    from database import get_db
    import httpx

    db = get_db()
    now = datetime.now(timezone.utc).isoformat()

    db.table('notifications').insert({
        'user_id': user_id,
        'type': notification_type,
        'payload': payload,
        'read': False,
        'created_at': now,
    }).execute()

    # Map notification type to email template
    EMAIL_TEMPLATES = {
        'trial_expiry': 'trial_expiry',
        'payment_failed': 'payment_failed',
        'mission_complete': 'mission_complete',
    }
    email_template = EMAIL_TEMPLATES.get(notification_type)

    if email_template:
        user_resp = db.table('user_profiles').select('email, display_name').eq('id', user_id).execute()
        if user_resp.data and user_resp.data[0].get('email'):
            user = user_resp.data[0]
            app_url = os.environ.get('NEXT_PUBLIC_APP_URL', 'https://xhunt.app')
            try:
                httpx.post(
                    f'{app_url}/api/notifications/email',
                    headers={'x-cron-secret': os.environ.get('CRON_SECRET', '')},
                    json={
                        'to': user['email'],
                        'template': email_template,
                        'data': {
                            'name': user.get('display_name', ''),
                            **payload,
                        },
                    },
                    timeout=10,
                )
            except Exception as exc:
                print(f'[worker] email dispatch failed: {exc}')

    return {'sent': True, 'notification_type': notification_type}
