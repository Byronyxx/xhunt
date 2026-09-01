-- Migration 012: Event Spine — XHunt Behavioral Intelligence Foundation
-- Extends the existing mission_events table with session, duration, and
-- client-timestamp columns. Adds mission_state (state machine) and
-- mission_scores (MEI cache) tables. Adds compute_mei(), v_step_dropoff,
-- and v_mission_funnel for the Intelligence Engine.

-- ── 1. Extend mission_events ──────────────────────────────────────────────

ALTER TABLE public.mission_events
  ADD COLUMN IF NOT EXISTS session_id  text,
  ADD COLUMN IF NOT EXISTS duration_ms integer,
  ADD COLUMN IF NOT EXISTS client_ts   timestamptz NOT NULL DEFAULT now();

-- Drop the old unnamed check constraint on event_type, then replace it with
-- a named one that includes all new event types.
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.mission_events'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%event_type%';

  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.mission_events DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.mission_events
  ADD CONSTRAINT mission_events_event_type_check CHECK (event_type IN (
    'mission_viewed',
    'mission_started',
    'mission_resumed',
    'step_started',
    'step_completed',
    'step_skipped',
    'step_adapted',
    'reward_viewed',
    'reward_claimed',
    'mission_completed',
    'mission_abandoned',
    'mission_shared',
    'ask_xeno',
    'profile_match_viewed'
  ));

-- Index on session_id for funnel queries within a single browsing session
CREATE INDEX IF NOT EXISTS idx_me_session
  ON public.mission_events(session_id)
  WHERE session_id IS NOT NULL;

-- Index for duration analytics (step friction scoring)
CREATE INDEX IF NOT EXISTS idx_me_duration
  ON public.mission_events(mission_id, step_id, duration_ms)
  WHERE duration_ms IS NOT NULL;

-- ── 2. Mission State Machine ──────────────────────────────────────────────
-- One row per (user, mission) pair. Updated whenever a state transition occurs.
-- States: not_started → active → in_progress ⟷ stalled → completed → analyzed

CREATE TABLE IF NOT EXISTS public.mission_state (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid         NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  mission_id     uuid         NOT NULL REFERENCES public.missions(id)      ON DELETE CASCADE,
  tenant_id      uuid         REFERENCES public.tenants(id)                ON DELETE SET NULL,
  state          text         NOT NULL DEFAULT 'not_started'
                              CHECK (state IN (
                                'not_started',
                                'active',
                                'in_progress',
                                'stalled',
                                'completed',
                                'analyzed'
                              )),
  previous_state text         CHECK (previous_state IN (
                                'not_started',
                                'active',
                                'in_progress',
                                'stalled',
                                'completed',
                                'analyzed'
                              )),
  entered_at     timestamptz  NOT NULL DEFAULT now(),
  metadata       jsonb        NOT NULL DEFAULT '{}',
  updated_at     timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (user_id, mission_id)
);

CREATE INDEX IF NOT EXISTS idx_ms_user_mission ON public.mission_state(user_id, mission_id);
CREATE INDEX IF NOT EXISTS idx_ms_state        ON public.mission_state(state);
CREATE INDEX IF NOT EXISTS idx_ms_tenant       ON public.mission_state(tenant_id);

ALTER TABLE public.mission_state ENABLE ROW LEVEL SECURITY;

-- Users own their state rows
CREATE POLICY "ms_own_all"
  ON public.mission_state FOR ALL
  USING (user_id = auth.uid());

-- Tenant analysts can read all state rows for their org
CREATE POLICY "ms_tenant_read"
  ON public.mission_state FOR SELECT
  USING (
    tenant_id = public.my_tenant_id()
    AND public.my_role() IN ('tenant_admin', 'platform_admin', 'analyst')
  );

CREATE TRIGGER mission_state_updated_at
  BEFORE UPDATE ON public.mission_state
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 3. Mission Scores (MEI cache) ───────────────────────────────────────────────
-- Stores computed MEI and component scores. One row per mission.
-- Populated by the compute_and_store_mei() function or a scheduled job.

CREATE TABLE IF NOT EXISTS public.mission_scores (
  id               uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id       uuid         NOT NULL REFERENCES public.missions(id) ON DELETE CASCADE,
  tenant_id        uuid         REFERENCES public.tenants(id) ON DELETE SET NULL,
  completion_score numeric(5,1) NOT NULL DEFAULT 0,  -- % of starters who completed
  engagement_score numeric(5,1) NOT NULL DEFAULT 0,  -- % of steps completed vs started
  retention_score  numeric(5,1) NOT NULL DEFAULT 0,  -- % of starters who returned
  outcome_score    numeric(5,1) NOT NULL DEFAULT 0,  -- % of completers who claimed reward
  mei              numeric(5,1) NOT NULL DEFAULT 0,  -- 0–100 weighted composite
  sample_size      integer      NOT NULL DEFAULT 0,
  computed_at      timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (mission_id)
);

CREATE INDEX IF NOT EXISTS idx_scores_mission ON public.mission_scores(mission_id);
CREATE INDEX IF NOT EXISTS idx_scores_mei     ON public.mission_scores(mei DESC);
CREATE INDEX IF NOT EXISTS idx_scores_tenant  ON public.mission_scores(tenant_id);

ALTER TABLE public.mission_scores ENABLE ROW LEVEL SECURITY;

-- Mission creators and above can read scores for their tenant's missions
CREATE POLICY "scores_tenant_read"
  ON public.mission_scores FOR SELECT
  USING (
    tenant_id = public.my_tenant_id()
    AND public.my_role() IN ('tenant_admin', 'platform_admin', 'analyst', 'mission_creator')
  );

-- Public missions expose their scores (trust is built on transparency)
CREATE POLICY "scores_public_read"
  ON public.mission_scores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.missions m
      WHERE m.id = mission_id AND m.is_public = true
    )
  );

-- ── 4. MEI Computation Function ─────────────────────────────────────────────
-- Returns live MEI components computed directly from mission_events.
-- Weights: completion 40%, engagement 25%, retention 20%, outcome 15%.
--
-- Usage: SELECT * FROM public.compute_mei('<mission-uuid>');

CREATE OR REPLACE FUNCTION public.compute_mei(p_mission_id uuid)
RETURNS TABLE (
  completion_score numeric,
  engagement_score numeric,
  retention_score  numeric,
  outcome_score    numeric,
  mei              numeric,
  sample_size      bigint
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  WITH counts AS (
    SELECT
      COUNT(DISTINCT CASE WHEN event_type = 'mission_started'   THEN user_id END) AS starters,
      COUNT(DISTINCT CASE WHEN event_type = 'mission_completed' THEN user_id END) AS completers,
      COUNT(DISTINCT CASE WHEN event_type = 'mission_resumed'   THEN user_id END) AS returners,
      COUNT(DISTINCT CASE WHEN event_type = 'reward_claimed'    THEN user_id END) AS claimers,
      -- Step completion rate: completed steps / started steps
      COUNT(*) FILTER (WHERE event_type = 'step_completed')::float /
        NULLIF(COUNT(*) FILTER (WHERE event_type = 'step_started'), 0) AS step_rate
    FROM public.mission_events
    WHERE mission_id = p_mission_id
  )
  SELECT
    -- Completion: what fraction of starters finished
    ROUND(CASE WHEN starters = 0 THEN 0
          ELSE completers::numeric / starters * 100 END, 1) AS completion_score,

    -- Engagement: fraction of started steps that were completed
    ROUND(COALESCE(step_rate * 100, 0)::numeric, 1) AS engagement_score,

    -- Retention: fraction of starters who came back at least once
    ROUND(CASE WHEN starters = 0 THEN 0
          ELSE returners::numeric / starters * 100 END, 1) AS retention_score,

    -- Outcome: fraction of completers who claimed their reward
    ROUND(CASE WHEN completers = 0 THEN 0
          ELSE claimers::numeric / completers * 100 END, 1) AS outcome_score,

    -- MEI: weighted composite (capped at 100)
    LEAST(100, ROUND(
      CASE WHEN starters = 0 THEN 0 ELSE
          0.40 * (CASE WHEN starters = 0 THEN 0 ELSE completers::numeric / starters * 100 END)
        + 0.25 * COALESCE(step_rate * 100, 0)::numeric
        + 0.20 * (CASE WHEN starters = 0 THEN 0 ELSE returners::numeric / starters * 100 END)
        + 0.15 * (CASE WHEN completers = 0 THEN 0 ELSE claimers::numeric / completers * 100 END)
      END
    , 1)) AS mei,

    starters AS sample_size
  FROM counts;
$$;

-- Convenience: compute and upsert MEI into mission_scores in one call
CREATE OR REPLACE FUNCTION public.compute_and_store_mei(p_mission_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  r record;
  v_tenant_id uuid;
BEGIN
  SELECT tenant_id INTO v_tenant_id FROM public.missions WHERE id = p_mission_id;

  SELECT * INTO r FROM public.compute_mei(p_mission_id);

  INSERT INTO public.mission_scores
    (mission_id, tenant_id, completion_score, engagement_score,
     retention_score, outcome_score, mei, sample_size, computed_at)
  VALUES
    (p_mission_id, v_tenant_id,
     r.completion_score, r.engagement_score,
     r.retention_score,  r.outcome_score,
     r.mei, r.sample_size::integer, now())
  ON CONFLICT (mission_id) DO UPDATE SET
    completion_score = EXCLUDED.completion_score,
    engagement_score = EXCLUDED.engagement_score,
    retention_score  = EXCLUDED.retention_score,
    outcome_score    = EXCLUDED.outcome_score,
    mei              = EXCLUDED.mei,
    sample_size      = EXCLUDED.sample_size,
    computed_at      = now();
END;
$$;

-- ── 5. Step Drop-off View ────────────────────────────────────────────────
-- Per-step funnel metrics for the Health Engine (Sprint 3).
-- Replaces the get_step_dropoffs() function from migration 004.

CREATE OR REPLACE VIEW public.v_step_dropoff AS
  SELECT
    e.mission_id,
    e.step_id,
    COUNT(*) FILTER (WHERE e.event_type = 'step_started')   AS step_starts,
    COUNT(*) FILTER (WHERE e.event_type = 'step_completed') AS step_completions,
    COUNT(*) FILTER (WHERE e.event_type = 'step_skipped')   AS step_skips,
    COUNT(*) FILTER (WHERE e.event_type = 'step_adapted')   AS step_adaptations,
    ROUND(
      AVG(e.duration_ms) FILTER (WHERE e.event_type = 'step_completed'), 0
    ) AS avg_completion_ms,
    ROUND(
      COUNT(*) FILTER (WHERE e.event_type = 'step_completed')::numeric /
      NULLIF(COUNT(*) FILTER (WHERE e.event_type = 'step_started'), 0) * 100
    , 1) AS completion_pct
  FROM public.mission_events e
  WHERE e.step_id IS NOT NULL
  GROUP BY e.mission_id, e.step_id
  ORDER BY e.mission_id, e.step_id;

-- ── 6. Mission Funnel View ──────────────────────────────────────────────────
-- Top-of-funnel through reward claim for each mission.
-- Powers the Workspace analytics dashboard.

CREATE OR REPLACE VIEW public.v_mission_funnel AS
  SELECT
    mission_id,
    COUNT(DISTINCT CASE WHEN event_type = 'mission_viewed'    THEN user_id END) AS viewers,
    COUNT(DISTINCT CASE WHEN event_type = 'mission_started'   THEN user_id END) AS starters,
    COUNT(DISTINCT CASE WHEN event_type IN (
      'mission_started', 'mission_resumed')                   THEN user_id END) AS ever_active,
    COUNT(DISTINCT CASE WHEN event_type = 'mission_completed' THEN user_id END) AS completers,
    COUNT(DISTINCT CASE WHEN event_type = 'reward_claimed'    THEN user_id END) AS claimers,
    ROUND(
      COUNT(DISTINCT CASE WHEN event_type = 'mission_started' THEN user_id END)::numeric /
      NULLIF(COUNT(DISTINCT CASE WHEN event_type = 'mission_viewed' THEN user_id END), 0) * 100
    , 1) AS view_to_start_pct,
    ROUND(
      COUNT(DISTINCT CASE WHEN event_type = 'mission_completed' THEN user_id END)::numeric /
      NULLIF(COUNT(DISTINCT CASE WHEN event_type = 'mission_started' THEN user_id END), 0) * 100
    , 1) AS start_to_complete_pct
  FROM public.mission_events
  WHERE mission_id IS NOT NULL
  GROUP BY mission_id;
