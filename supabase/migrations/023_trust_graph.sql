-- 023_trust_graph.sql
-- Multi-dimensional, contextual trust graph: skill, reliability, ethical, domain trust dimensions

CREATE TYPE trust_dimension AS ENUM (
  'skill',
  'reliability',
  'ethical',
  'domain'
);

-- Pairwise trust scores: one row per (trustor, trustee, dimension, context) tuple
CREATE TABLE IF NOT EXISTS public.trust_scores (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trustor_id     uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  trustee_id     uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  dimension      trust_dimension NOT NULL,
  context        text,                       -- domain/skill area the trust is scoped to (null = global)
  score          numeric(5,2) NOT NULL DEFAULT 50.0 CHECK (score BETWEEN 0 AND 100),
  evidence_count integer NOT NULL DEFAULT 0,
  decay_factor   numeric(4,3) NOT NULL DEFAULT 1.0, -- reduces score for inactivity
  last_interaction timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Table-level UNIQUE constraints can't contain expressions like COALESCE(),
-- so this is a unique index instead — it also satisfies the ON CONFLICT
-- target used by apply_trust_event() further down this file.
CREATE UNIQUE INDEX IF NOT EXISTS trust_scores_trustor_trustee_dim_ctx_idx
  ON public.trust_scores (trustor_id, trustee_id, dimension, COALESCE(context, ''));

-- Aggregate trust profile per user (materialized from trust_scores)
CREATE TABLE IF NOT EXISTS public.trust_profiles (
  user_id             uuid PRIMARY KEY REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  composite_score     numeric(5,2) NOT NULL DEFAULT 50.0,
  skill_score         numeric(5,2) NOT NULL DEFAULT 50.0,
  reliability_score   numeric(5,2) NOT NULL DEFAULT 50.0,
  ethical_score       numeric(5,2) NOT NULL DEFAULT 50.0,
  domain_score        numeric(5,2) NOT NULL DEFAULT 50.0,
  trust_graph_size    integer NOT NULL DEFAULT 0,   -- number of unique trustors
  top_trusted_by      jsonb NOT NULL DEFAULT '[]',  -- [{user_id, score, dimension}]
  top_contexts        jsonb NOT NULL DEFAULT '[]',  -- [{context, score}]
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Immutable event log: every trust delta is recorded
CREATE TABLE IF NOT EXISTS public.trust_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trustor_id     uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  trustee_id     uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  dimension      trust_dimension NOT NULL,
  context        text,
  event_type     text NOT NULL CHECK (event_type IN (
    'mission_completed_together',
    'peer_validation_given',
    'peer_validation_received',
    'outcome_verified',
    'dispute_raised',
    'dispute_resolved',
    'contribution_endorsed',
    'collaboration_success',
    'collaboration_failure',
    'manual_adjustment'
  )),
  delta          numeric(6,2) NOT NULL,      -- signed: positive = trust increase
  reason         text,
  mission_id     uuid REFERENCES public.missions(id) ON DELETE SET NULL,
  contribution_id uuid REFERENCES public.contribution_ledger(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Cross-platform trust anchors: portable trust signals from external systems
CREATE TABLE IF NOT EXISTS public.trust_anchors (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  platform        text NOT NULL,              -- 'github', 'linkedin', 'polygon_id', etc.
  platform_id     text NOT NULL,
  trust_signal    text NOT NULL,              -- what the signal represents
  signal_weight   numeric(4,3) NOT NULL DEFAULT 0.5,
  verified_at     timestamptz,
  expires_at      timestamptz,
  metadata        jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform, platform_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trust_scores_trustee    ON public.trust_scores (trustee_id);
CREATE INDEX IF NOT EXISTS idx_trust_scores_trustor    ON public.trust_scores (trustor_id);
CREATE INDEX IF NOT EXISTS idx_trust_scores_dimension  ON public.trust_scores (dimension);
CREATE INDEX IF NOT EXISTS idx_trust_events_trustee    ON public.trust_events (trustee_id);
CREATE INDEX IF NOT EXISTS idx_trust_events_trustor    ON public.trust_events (trustor_id);
CREATE INDEX IF NOT EXISTS idx_trust_events_created    ON public.trust_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trust_anchors_user      ON public.trust_anchors (user_id);

-- Function: compute composite trust score for a user (weighted average of dimensions)
CREATE OR REPLACE FUNCTION compute_trust_composite(p_user_id uuid)
RETURNS numeric LANGUAGE plpgsql AS $$
DECLARE
  v_composite numeric;
BEGIN
  SELECT
    (COALESCE(AVG(CASE WHEN dimension = 'skill'       THEN score END), 50) * 0.30 +
     COALESCE(AVG(CASE WHEN dimension = 'reliability' THEN score END), 50) * 0.35 +
     COALESCE(AVG(CASE WHEN dimension = 'ethical'     THEN score END), 50) * 0.25 +
     COALESCE(AVG(CASE WHEN dimension = 'domain'      THEN score END), 50) * 0.10)
  INTO v_composite
  FROM public.trust_scores
  WHERE trustee_id = p_user_id;

  RETURN COALESCE(v_composite, 50.0);
END;
$$;

-- Trigger: apply a trust event to the score table
CREATE OR REPLACE FUNCTION apply_trust_event()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.trust_scores (trustor_id, trustee_id, dimension, context, score, evidence_count, last_interaction)
  VALUES (NEW.trustor_id, NEW.trustee_id, NEW.dimension, NEW.context, 50.0 + NEW.delta, 1, now())
  ON CONFLICT (trustor_id, trustee_id, dimension, COALESCE(context, '')) DO UPDATE
    SET score          = LEAST(100, GREATEST(0, trust_scores.score + NEW.delta)),
        evidence_count = trust_scores.evidence_count + 1,
        last_interaction = now(),
        updated_at     = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_apply_trust_event
  AFTER INSERT ON public.trust_events
  FOR EACH ROW EXECUTE FUNCTION apply_trust_event();

-- RLS
ALTER TABLE public.trust_scores   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trust_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trust_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trust_anchors  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "trust_scores_select_all"   ON public.trust_scores   FOR SELECT USING (true);
CREATE POLICY "trust_profiles_select_all" ON public.trust_profiles  FOR SELECT USING (true);
CREATE POLICY "trust_events_select_all"   ON public.trust_events    FOR SELECT USING (true);
CREATE POLICY "trust_anchors_select_own"  ON public.trust_anchors   FOR SELECT
  USING (auth.uid()::text = (SELECT clerk_user_id FROM public.user_profiles WHERE id = user_id));
