'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, CheckCircle2, Target, Clock, Zap, Trophy,
  ArrowRight, Sparkles, AlertCircle, Loader2, SkipForward,
  Building2, ShieldCheck, RotateCcw, MessageSquare,
} from 'lucide-react';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';
import { createClient } from '@/lib/supabase/client';
import { emitEvent, syncProgress, emitRewardClaimed } from '@/lib/supabase/events';
import { loadState } from '@/lib/store';
import type { Hunt, Step } from '@/lib/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Phase = 'loading' | 'intro' | 'executing' | 'complete';

const BG    = '#050816';
const TXT   = '#F0F4FF';
const DIM   = '#8B9CC0';
const FAINT = '#4A5578';

const STEP_META: Record<string, { label: string; bg: string; text: string; border: string; hint: string }> = {
  action:        { label: 'Action',        bg: '#22FFAA12', text: '#22FFAA', border: '#22FFAA30', hint: 'Be specific. Describe what you did, the outcome, and any tools or people involved.' },
  reflection:    { label: 'Reflection',    bg: '#6D5DFD12', text: '#A99FFE', border: '#6D5DFD30', hint: 'Think deeply. What surprised you? What would you do differently next time?' },
  discovery:     { label: 'Discovery',     bg: '#FFB84D12', text: '#FFB84D', border: '#FFB84D30', hint: 'Document your findings clearly. Include names, sources, or links where relevant.' },
  research:      { label: 'Research',      bg: '#60A5FA12', text: '#60A5FA', border: '#60A5FA30', hint: 'Share your research findings with context and evidence. Cite your sources.' },
  submission:    { label: 'Submission',    bg: '#22FFAA12', text: '#22FFAA', border: '#22FFAA30', hint: 'Describe what you are submitting and how it can be accessed or verified.' },
  collaboration: { label: 'Collaboration', bg: '#FF5C7A12', text: '#FF9DB2', border: '#FF5C7A30', hint: 'Who did you work with? Describe your individual contribution to the group effort.' },
};

export default function MissionExecutionPage() {
  const { id } = useParams<{ id: string }>();
  const router  = useRouter();

  const [phase, setPhase]         = useState<Phase>('loading');
  const [mission, setMission]     = useState<Hunt | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [doneIds, setDoneIds]     = useState<number[]>([]);
  const [responses, setResponses] = useState<Record<number, string>>({});
  const [stepErr, setStepErr]     = useState('');
  const [saving, setSaving]       = useState(false);
  const [loadErr, setLoadErr]     = useState('');
  const [chatConvId, setChatConvId] = useState<string | null>(null);
  const startedAtRef              = useRef('');

  useEffect(() => {
    async function boot() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace(`/sign-in?redirect_url=${encodeURIComponent(`/missions/${id}`)}`); return; }

      // Non-UUID IDs come from localStorage (AI-generated missions).
      // Skip Supabase and load from local state directly.
      if (!UUID_RE.test(id)) {
        const localHunt = loadState().hunts.find((h) => h.id === id) ?? null;
        if (localHunt) {
          setMission(localHunt);
          const prog = loadState().progress[id];
          if (prog?.completedAt) { setDoneIds(prog.completedSteps ?? []); setPhase('complete'); return; }
          if (prog) { setCurrentIdx(prog.currentStepIndex ?? 0); setDoneIds(prog.completedSteps ?? []); setPhase('executing'); return; }
          setPhase('intro');
          return;
        }
        setLoadErr('Mission not found in your library.');
        setPhase('intro');
        return;
      }

      const { data: m, error } = await supabase
        .from('missions')
        .select('*, tenant:tenants!tenant_id(name, logo_url), approvals:mission_approvals!mission_id(status)')
        .eq('id', id)
        .single();

      if (error || !m) { setLoadErr('Mission not found.'); setPhase('intro'); return; }

      const tenant    = m.tenant as { name?: string; logo_url?: string | null } | null;
      const approvals = (m.approvals as Array<{ status: string }>) ?? [];
      const hunt: Hunt = {
        id: m.id,
        title: m.title,
        story_context: m.story_context ?? '',
        difficulty: m.difficulty,
        estimated_time: m.estimated_time ?? '',
        steps: (m.steps as Step[]) ?? [],
        reward: m.reward,
        tags: m.tags ?? [],
        createdAt: m.created_at,
        tenantName: tenant?.name,
        tenantLogo: tenant?.logo_url ?? null,
        isVerified: approvals.some((a) => a.status === 'approved'),
      };
      setMission(hunt);

      const { data: prog } = await supabase
        .from('mission_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('mission_id', id)
        .maybeSingle();

      if (prog?.completed_at) {
        setDoneIds(prog.completed_steps ?? []);
        setPhase('complete');
        return;
      }
      if (prog && !prog.completed_at) {
        setCurrentIdx(prog.current_step_index ?? 0);
        setDoneIds(prog.completed_steps ?? []);
        startedAtRef.current = prog.started_at;
        emitEvent('mission_resumed', { missionId: id });
        setPhase('executing');
        return;
      }

      emitEvent('mission_viewed', { missionId: id });
      setPhase('intro');
    }
    boot();
  }, [id, router]);

  async function startMission() {
    if (!mission) return;
    const now = new Date().toISOString();
    startedAtRef.current = now;
    syncProgress(id, { currentStepIndex: 0, completedSteps: [], startedAt: now });
    emitEvent('mission_started', { missionId: id });
    emitEvent('step_started', { missionId: id, stepId: mission.steps[0]?.id });
    setPhase('executing');
    // Auto-join mission chat in the background
    fetch('/api/messages/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'mission', mission_id: id }),
    })
      .then((r) => r.json())
      .then(({ conversation_id }) => { if (conversation_id) setChatConvId(conversation_id); })
      .catch(() => {});
  }

  async function joinMissionChat() {
    const res = await fetch('/api/messages/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'mission', mission_id: id }),
    });
    const { conversation_id } = await res.json();
    if (conversation_id) {
      setChatConvId(conversation_id);
      router.push(`/messages/${conversation_id}`);
    }
  }

  async function completeStep() {
    if (!mission) return;
    const step = mission.steps[currentIdx];
    const text = (responses[step.id] ?? '').trim();
    if (!text) { setStepErr('Please write a response before completing this step.'); return; }
    setStepErr('');
    setSaving(true);

    const newDone = [...doneIds, step.id];
    const nextIdx = currentIdx + 1;
    const isLast  = nextIdx >= mission.steps.length;

    emitEvent('step_completed', {
      missionId: id,
      stepId: step.id,
      metadata: { response: text.slice(0, 500), step_type: step.type, step_index: currentIdx },
    });

    if (isLast) {
      const completedAt = new Date().toISOString();
      syncProgress(id, {
        currentStepIndex: nextIdx,
        completedSteps: newDone,
        startedAt: startedAtRef.current,
        completedAt,
      });
      emitEvent('mission_completed', { missionId: id, metadata: { total_steps: mission.steps.length } });
      emitRewardClaimed(id, mission.reward);
      void fetch('/api/mei/compute', { method: 'POST' });
      setDoneIds(newDone);
      setPhase('complete');
    } else {
      syncProgress(id, {
        currentStepIndex: nextIdx,
        completedSteps: newDone,
        startedAt: startedAtRef.current,
      });
      emitEvent('step_started', { missionId: id, stepId: mission.steps[nextIdx]?.id });
      setDoneIds(newDone);
      setCurrentIdx(nextIdx);
    }
    setSaving(false);
  }

  function skipStep() {
    if (!mission) return;
    const step    = mission.steps[currentIdx];
    const nextIdx = currentIdx + 1;
    if (nextIdx >= mission.steps.length) {
      setStepErr('This is the final step — you must complete it.');
      return;
    }
    emitEvent('step_skipped', { missionId: id, stepId: step.id });
    syncProgress(id, { currentStepIndex: nextIdx, completedSteps: doneIds, startedAt: startedAtRef.current });
    emitEvent('step_started', { missionId: id, stepId: mission.steps[nextIdx]?.id });
    setCurrentIdx(nextIdx);
    setStepErr('');
  }

  /* ── LOADING ─────────────────────────────────────────────────── */
  if (phase === 'loading') {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={28} strokeWidth={2} style={{ color: '#22FFAA', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  /* ── ERROR ───────────────────────────────────────────────────── */
  if (loadErr) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
        <AlertCircle size={36} strokeWidth={1.5} style={{ color: '#FF5C7A' }} />
        <p style={{ fontSize: 17, fontWeight: 800, color: TXT }}>{loadErr}</p>
        <Link href="/missions" style={{ fontSize: 14, fontWeight: 600, color: '#22FFAA', textDecoration: 'none' }}>
          ← Back to Missions
        </Link>
        <BottomNav />
      </div>
    );
  }

  if (!mission) return null;

  const diffColor  = mission.difficulty === 'easy' ? '#22FFAA' : mission.difficulty === 'medium' ? '#FFB84D' : '#FF5C7A';
  const totalSteps = mission.steps.length;
  const pct        = totalSteps > 0 ? Math.round((doneIds.length / totalSteps) * 100) : 0;

  /* ── COMPLETE ────────────────────────────────────────────────── */
  if (phase === 'complete') {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px 110px', textAlign: 'center' }}>
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 18 }}>
          <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'rgba(34,255,170,0.1)', border: '2px solid rgba(34,255,170,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 32px', boxShadow: '0 0 60px rgba(34,255,170,0.15)' }}>
            <Trophy size={44} strokeWidth={1.5} style={{ color: '#22FFAA' }} />
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <p style={{ fontSize: 11, fontWeight: 800, color: FAINT, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
            Mission Complete
          </p>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: TXT, lineHeight: 1.22, marginBottom: 14, letterSpacing: '-0.025em' }}>
            {mission.title}
          </h1>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,184,77,0.1)', border: '1px solid rgba(255,184,77,0.25)', borderRadius: 999, padding: '8px 20px', marginBottom: 10 }}>
            <Zap size={14} strokeWidth={2.5} style={{ color: '#FFB84D' }} />
            <span style={{ fontSize: 14, fontWeight: 800, color: '#FFB84D' }}>{mission.reward}</span>
          </div>
          <p style={{ fontSize: 13, color: FAINT, marginBottom: 38 }}>
            {totalSteps} step{totalSteps !== 1 ? 's' : ''} completed{mission.tenantName ? ` · ${mission.tenantName}` : ''}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/missions" style={{ display: 'flex', alignItems: 'center', gap: 8, height: 50, padding: '0 22px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, color: TXT, fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
              <RotateCcw size={14} strokeWidth={2.5} /> More Missions
            </Link>
            <Link href="/home" style={{ display: 'flex', alignItems: 'center', gap: 8, height: 50, padding: '0 24px', background: '#22FFAA', borderRadius: 16, color: BG, fontWeight: 900, fontSize: 14, textDecoration: 'none', boxShadow: '0 4px 24px rgba(34,255,170,0.35)' }}>
              Dashboard <ArrowRight size={14} strokeWidth={2.8} />
            </Link>
          </div>
        </motion.div>
        <BottomNav />
      </div>
    );
  }

  /* ── INTRO ───────────────────────────────────────────────────── */
  if (phase === 'intro') {
    return (
      <div className="consumer-app" style={{ minHeight: '100vh', background: BG, paddingBottom: 110 }}>
        {/* nav bar */}
        <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'sticky', top: 0, background: 'rgba(5,8,22,0.95)', backdropFilter: 'blur(20px)', zIndex: 10 }}>
          <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: DIM, cursor: 'pointer' }}>
            <ChevronLeft size={18} strokeWidth={2} />
          </button>
          {mission.isVerified && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', background: 'rgba(34,255,170,0.08)', border: '1px solid rgba(34,255,170,0.2)', borderRadius: 20 }}>
              <ShieldCheck size={11} strokeWidth={2.5} style={{ color: '#22FFAA' }} />
              <span style={{ fontSize: 10, fontWeight: 800, color: '#22FFAA' }}>VERIFIED</span>
            </div>
          )}
        </div>

        <div style={{ padding: '28px 20px 0', maxWidth: 620, margin: '0 auto' }}>
          {/* org */}
          {mission.tenantName && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(109,93,253,0.12)', border: '1px solid rgba(109,93,253,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Building2 size={13} strokeWidth={2} style={{ color: '#A99FFE' }} />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#A99FFE' }}>{mission.tenantName}</span>
            </div>
          )}

          {/* title */}
          <h1 style={{ fontSize: 26, fontWeight: 900, color: TXT, lineHeight: 1.22, margin: '0 0 16px', letterSpacing: '-0.025em' }}>
            {mission.title}
          </h1>

          {/* meta badges */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
            <span style={{ fontSize: 11, fontWeight: 800, padding: '5px 12px', borderRadius: 20, background: `${diffColor}12`, color: diffColor, textTransform: 'capitalize', border: `1px solid ${diffColor}25` }}>
              {mission.difficulty}
            </span>
            {mission.estimated_time && (
              <span style={{ fontSize: 11, fontWeight: 600, padding: '5px 12px', borderRadius: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: DIM, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Clock size={11} strokeWidth={2} />{mission.estimated_time}
              </span>
            )}
            <span style={{ fontSize: 11, fontWeight: 700, padding: '5px 12px', borderRadius: 20, background: 'rgba(255,184,77,0.1)', border: '1px solid rgba(255,184,77,0.2)', color: '#FFB84D', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Zap size={11} strokeWidth={2.5} />{mission.reward}
            </span>
          </div>

          {/* story */}
          {mission.story_context && (
            <p style={{ fontSize: 14, lineHeight: 1.68, color: DIM, marginBottom: 30 }}>
              {mission.story_context}
            </p>
          )}

          {/* steps preview */}
          <div style={{ marginBottom: 32 }}>
            <p style={{ fontSize: 11, fontWeight: 800, color: FAINT, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>
              {totalSteps} Step{totalSteps !== 1 ? 's' : ''}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {mission.steps.map((step, i) => {
                const sm = STEP_META[step.type] ?? STEP_META.action;
                return (
                  <div key={step.id} className="liquid-glass" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 14px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14 }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: sm.bg, border: `1px solid ${sm.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <span style={{ fontSize: 10, fontWeight: 900, color: sm.text }}>{i + 1}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: sm.text, background: sm.bg, border: `1px solid ${sm.border}`, padding: '2px 7px', borderRadius: 6, textTransform: 'capitalize', display: 'inline-block', marginBottom: 5 }}>
                        {sm.label}
                      </span>
                      <p style={{ fontSize: 13, color: '#C8D4F0', fontWeight: 500, lineHeight: 1.48, margin: 0 }}>
                        {step.instruction}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* start CTA */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={startMission}
            style={{ width: '100%', height: 56, borderRadius: 18, background: '#22FFAA', border: 'none', color: BG, fontSize: 16, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, cursor: 'pointer', boxShadow: '0 6px 32px rgba(34,255,170,0.35)', letterSpacing: '-0.01em', fontFamily: 'inherit' }}>
            <Target size={18} strokeWidth={2.5} />
            Start Mission
            <ChevronRight size={16} strokeWidth={2.5} />
          </motion.button>

          {/* Mission Chat CTA */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={joinMissionChat}
            style={{
              width: '100%', height: 46, borderRadius: 14, marginTop: 10,
              background: 'rgba(255,184,77,0.08)',
              border: '1px solid rgba(255,184,77,0.22)',
              color: '#FFB84D', fontSize: 14, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 8, cursor: 'pointer', fontFamily: 'inherit',
            }}>
            <MessageSquare size={15} strokeWidth={2.2} />
            Mission Chat
          </motion.button>
        </div>
        <BottomNav />
      </div>
    );
  }

  /* ── EXECUTING ───────────────────────────────────────────────── */
  const step = mission.steps[currentIdx];
  const sm   = STEP_META[step?.type ?? 'action'] ?? STEP_META.action;

  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column' }}>

      {/* sticky progress header */}
      <div style={{ padding: '14px 20px 12px', background: 'rgba(5,8,22,0.97)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <button onClick={() => setPhase('intro')} style={{ background: 'none', border: 'none', color: FAINT, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', padding: 0 }}>
            <ChevronLeft size={15} strokeWidth={2} />Mission
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {chatConvId && (
              <Link href={`/messages/${chatConvId}`} title="Mission Chat" style={{
                width: 30, height: 30, borderRadius: 9,
                background: 'rgba(255,184,77,0.1)', border: '1px solid rgba(255,184,77,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none',
              }}>
                <MessageSquare size={13} style={{ color: '#FFB84D' }} />
              </Link>
            )}
            <span style={{ fontSize: 12, fontWeight: 700, color: FAINT }}>
              {currentIdx + 1} / {totalSteps}
            </span>
          </div>
        </div>

        {/* step indicator dots */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          {mission.steps.map((s, i) => (
            <div key={s.id} style={{
              flex: 1, height: 3, borderRadius: 3,
              background: doneIds.includes(s.id) ? '#22FFAA'
                : i === currentIdx ? 'rgba(34,255,170,0.45)'
                : 'rgba(255,255,255,0.06)',
              transition: 'background 0.35s ease',
            }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, color: FAINT, fontWeight: 600 }}>{pct}% complete</span>
          <span style={{ fontSize: 10, color: FAINT, fontWeight: 600 }}>{totalSteps - doneIds.length} remaining</span>
        </div>
      </div>

      {/* scrollable step content */}
      <div style={{ flex: 1, padding: '28px 20px 20px', maxWidth: 620, margin: '0 auto', width: '100%', overflowY: 'auto', boxSizing: 'border-box' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIdx}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            {/* type badge */}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 13px', background: sm.bg, border: `1px solid ${sm.border}`, borderRadius: 20, marginBottom: 20 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: sm.text, textTransform: 'capitalize' }}>{sm.label}</span>
            </div>

            {/* instruction */}
            <h2 style={{ fontSize: 22, fontWeight: 800, color: TXT, lineHeight: 1.35, marginBottom: 14, letterSpacing: '-0.02em' }}>
              {step.instruction}
            </h2>

            {/* success criteria */}
            {step.success_criteria && (
              <div className="liquid-glass" style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '10px 14px', background: 'rgba(34,255,170,0.04)', border: '1px solid rgba(34,255,170,0.12)', borderRadius: 12, marginBottom: 22 }}>
                <CheckCircle2 size={13} strokeWidth={2} style={{ color: '#22FFAA', marginTop: 1, flexShrink: 0 }} />
                <p style={{ fontSize: 12.5, color: DIM, margin: 0, lineHeight: 1.55 }}>{step.success_criteria}</p>
              </div>
            )}

            {/* response input */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 10, fontWeight: 800, color: FAINT, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'block', marginBottom: 10 }}>
                Your Response
              </label>
              <textarea
                value={responses[step.id] ?? ''}
                onChange={(e) => {
                  setResponses((prev) => ({ ...prev, [step.id]: e.target.value }));
                  setStepErr('');
                }}
                placeholder={
                  step.type === 'reflection'    ? 'Write your reflection — what you thought, felt, and discovered…'
                  : step.type === 'discovery'   ? 'Describe what you found. Include names, sources, or links…'
                  : step.type === 'research'    ? 'Share your research findings with evidence and context…'
                  : step.type === 'submission'  ? 'Describe what you are submitting and how it can be verified…'
                  : 'Describe what you did, the outcome, and any key results…'
                }
                rows={6}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${stepErr ? 'rgba(255,92,122,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 16,
                  padding: '14px 16px',
                  fontSize: 14,
                  color: TXT,
                  resize: 'vertical',
                  outline: 'none',
                  fontFamily: 'inherit',
                  lineHeight: 1.6,
                  boxSizing: 'border-box',
                  minHeight: 140,
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(34,255,170,0.3)'; }}
                onBlur={(e)  => { e.target.style.borderColor = stepErr ? 'rgba(255,92,122,0.4)' : 'rgba(255,255,255,0.08)'; }}
              />
              {stepErr && (
                <p style={{ fontSize: 12, color: '#FF5C7A', marginTop: 7, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <AlertCircle size={12} strokeWidth={2} />{stepErr}
                </p>
              )}
            </div>

            {/* AI coaching hint */}
            <div className="liquid-glass" style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', background: 'rgba(109,93,253,0.06)', border: '1px solid rgba(109,93,253,0.14)', borderRadius: 12 }}>
              <Sparkles size={12} strokeWidth={2} style={{ color: '#A99FFE', marginTop: 2, flexShrink: 0 }} />
              <p style={{ fontSize: 12, color: DIM, margin: 0, lineHeight: 1.55 }}>{sm.hint}</p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* sticky action bar */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(5,8,22,0.97)', backdropFilter: 'blur(20px)' }}>
        <div style={{ maxWidth: 620, margin: '0 auto', display: 'flex', gap: 10 }}>
          {currentIdx < totalSteps - 1 && (
            <button
              onClick={skipStep}
              style={{ height: 52, padding: '0 18px', borderRadius: 16, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: FAINT, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0, fontFamily: 'inherit' }}>
              <SkipForward size={14} strokeWidth={2} />Skip
            </button>
          )}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={completeStep}
            disabled={saving}
            style={{ flex: 1, height: 52, borderRadius: 16, background: saving ? 'rgba(34,255,170,0.5)' : '#22FFAA', border: 'none', color: BG, fontSize: 15, fontWeight: 900, cursor: saving ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, boxShadow: '0 4px 28px rgba(34,255,170,0.28)', transition: 'background 0.2s', fontFamily: 'inherit' }}>
            {saving
              ? <Loader2 size={17} strokeWidth={2.5} style={{ animation: 'spin 1s linear infinite' }} />
              : currentIdx === totalSteps - 1
              ? <><Trophy size={16} strokeWidth={2.5} /> Complete Mission</>
              : <><CheckCircle2 size={16} strokeWidth={2.5} /> Complete Step</>}
          </motion.button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
