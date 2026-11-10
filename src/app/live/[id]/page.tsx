'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Eye, Play,
  ChevronRight, CheckSquare, Lightbulb,
  Lock,
} from 'lucide-react';
import Link from 'next/link';
import { PRICING_ENABLED } from '@/lib/pricing';
import { createClient } from '@/lib/supabase/client';

const T = {
  bg:       '#050816',
  panel:    '#07101F',
  elev:     '#17262a',
  line:     'rgba(255,255,255,.07)',
  line2:    'rgba(255,255,255,.12)',
  txt:      '#e9eff0',
  muted:    '#7d8b8e',
  dim:      '#54625f',
  green:    '#22FFAA',
  red:      '#FF5C7A',
  amber:    '#FFB84D',
  live:     '#ff3b30',
  liveGlow: 'rgba(255,59,48,.18)',
} as const;

interface DbStep {
  id: number;
  type: 'action' | 'reflection' | 'discovery';
  instruction: string;
  success_criteria: string;
}

interface SessionData {
  id: string;
  host_id: string;
  title: string;
  description: string | null;
  status: 'scheduled' | 'live' | 'ended';
  current_step_index: number;
  total_steps: number;
  viewer_count: number;
  is_pro_only: boolean;
  started_at: string | null;
  ended_at: string | null;
  host: {
    id: string;
    display_name: string;
    avatar_url: string | null;
  };
  mission: {
    id: string;
    title: string;
    story_context: string | null;
    steps: DbStep[];
  } | null;
}

const STEP_TYPE_META = {
  action:      { icon: <Play size={14} fill="currentColor" />,        color: '#22FFAA', label: 'Action'      },
  reflection:  { icon: <Lightbulb size={14} />,                        color: '#6D5DFD', label: 'Reflection'  },
  discovery:   { icon: <CheckSquare size={14} />,                      color: '#FFB84D', label: 'Discovery'   },
} as const;

export default function LiveSessionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tier, setTier] = useState<string>('free');
  const [hostBusy, setHostBusy] = useState(false);

  const supabase = createClient();

  const loadSession = useCallback(async () => {
    const res = await fetch(`/api/live/${id}`);
    if (!res.ok) { setNotFound(true); setLoading(false); return; }
    const data: SessionData = await res.json();
    setSession(data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    async function init() {
      const [, subRes] = await Promise.all([
        loadSession(),
        fetch('/api/subscription/status'),
      ]);
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);

      if (subRes.ok) {
        const s = await subRes.json();
        setTier(s.tier ?? 'free');
      }
    }
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Realtime: listen for step advances and status changes
  useEffect(() => {
    const channel = supabase
      .channel(`live-session-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_sessions', filter: `id=eq.${id}` },
        (payload) => {
          setSession(prev => prev ? { ...prev, ...(payload.new as Partial<SessionData>) } : null);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const isHost      = session?.host_id === userId;
  const currentStep = session?.mission?.steps?.[session.current_step_index] ?? null;
  const stepMeta    = currentStep ? (STEP_TYPE_META[currentStep.type] ?? STEP_TYPE_META.action) : null;
  const isLive      = session?.status === 'live';
  const isEnded     = session?.status === 'ended';
  const isLocked    = session?.is_pro_only && tier !== 'pro' && !isHost;

  async function handleNextStep() {
    if (!session || hostBusy) return;
    setHostBusy(true);
    try {
      const res = await fetch(`/api/live/${id}/step`, { method: 'PATCH' });
      if (res.ok) {
        const { current_step_index } = await res.json();
        setSession(prev => prev ? { ...prev, current_step_index } : null);
      }
    } finally {
      setHostBusy(false);
    }
  }

  async function handleEndSession() {
    if (!session || hostBusy) return;
    if (!confirm('End this live session?')) return;
    setHostBusy(true);
    try {
      await fetch(`/api/live/${id}/end`, { method: 'POST' });
      setSession(prev => prev ? { ...prev, status: 'ended', ended_at: new Date().toISOString() } : null);
    } finally {
      setHostBusy(false);
    }
  }

  if (loading) {
    return (
      <main style={{ background: T.bg, minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity }}
          style={{ width: 12, height: 12, borderRadius: '50%', background: T.live }}
        />
      </main>
    );
  }

  if (notFound || !session) {
    return (
      <main style={{ background: T.bg, minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: 16 }}>📡</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: T.txt, marginBottom: 8 }}>Session not found</div>
        <p style={{ fontSize: 13, color: T.muted, marginBottom: 20 }}>This live session may have ended or doesn&apos;t exist.</p>
        <Link href="/timeline" style={{ color: T.green, fontSize: 14, fontWeight: 600 }}>← Back to Timeline</Link>
      </main>
    );
  }

  // Locked screen for Pro-only sessions
  if (isLocked) {
    return (
      <main style={{ background: T.bg, minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>🔒</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: T.txt, marginBottom: 8 }}>{session.title}</div>
        <p style={{ fontSize: 14, color: T.muted, marginBottom: 24, lineHeight: 1.6 }}>
          This is a Pro-only live session hosted by <span style={{ color: T.txt }}>{session.host.display_name}</span>.<br />
          Upgrade to Pro to watch and participate.
        </p>
        {PRICING_ENABLED && <Link
          href="/upgrade"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '12px 24px', borderRadius: 14, textDecoration: 'none',
            background: 'linear-gradient(135deg,#22FFAA,#6D5DFD)',
            color: '#050816', fontWeight: 700, fontSize: 15, marginBottom: 12,
          }}
        >
          <Lock size={16} /> Upgrade to Pro
        </Link>}
        <br />
        <Link href="/timeline" style={{ color: T.dim, fontSize: 13 }}>← Back to Timeline</Link>
      </main>
    );
  }

  const progress = session.total_steps > 0
    ? ((session.current_step_index + 1) / session.total_steps) * 100
    : 0;

  return (
    <main style={{ background: T.bg, minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 40,
        background: 'rgba(7,13,14,.92)', backdropFilter: 'blur(16px)',
        borderBottom: `1px solid ${T.line}`,
        padding: '12px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, padding: 4, display: 'flex' }}>
            <ArrowLeft size={20} />
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.txt, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {session.title}
            </div>
            <div style={{ fontSize: 11, color: T.muted }}>
              {session.host.display_name}
            </div>
          </div>
          {/* Status badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {isLive && (
              <>
                <motion.div
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                  style={{ width: 8, height: 8, borderRadius: '50%', background: T.live }}
                />
                <span style={{ fontSize: 11, fontWeight: 700, color: T.live, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Live</span>
              </>
            )}
            {isEnded && <span style={{ fontSize: 11, fontWeight: 700, color: T.dim, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Ended</span>}
            {session.status === 'scheduled' && <span style={{ fontSize: 11, fontWeight: 700, color: T.amber, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Scheduled</span>}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Viewer count + mission */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: T.muted, fontSize: 13 }}>
            <Eye size={15} />
            <span>{session.viewer_count.toLocaleString()} watching</span>
          </div>
          {session.mission && (
            <span style={{ fontSize: 12, color: T.dim }}>🎯 {session.mission.title}</span>
          )}
        </div>

        {/* Progress bar */}
        {session.total_steps > 1 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: T.muted, fontWeight: 600 }}>
                Step {session.current_step_index + 1} of {session.total_steps}
              </span>
              <span style={{ fontSize: 12, color: T.dim }}>{Math.round(progress)}%</span>
            </div>
            <div style={{ height: 4, borderRadius: 4, background: T.elev }}>
              <motion.div
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
                style={{ height: '100%', borderRadius: 4, background: isLive ? T.live : T.green }}
              />
            </div>
          </div>
        )}

        {/* Current step card */}
        <AnimatePresence mode="wait">
          {isLive && currentStep ? (
            <motion.div
              key={session.current_step_index}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              style={{
                background: T.panel,
                border: `1px solid ${T.line2}`,
                borderRadius: 20,
                padding: '20px',
                flex: 1,
              }}
            >
              {stepMeta && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 11, fontWeight: 700, color: stepMeta.color,
                  background: `${stepMeta.color}18`, border: `1px solid ${stepMeta.color}30`,
                  borderRadius: 8, padding: '4px 10px', marginBottom: 16, letterSpacing: '0.04em',
                }}>
                  {stepMeta.icon} {stepMeta.label.toUpperCase()}
                </div>
              )}
              <p style={{ fontSize: 17, fontWeight: 600, color: T.txt, lineHeight: 1.55, marginBottom: 16 }}>
                {currentStep.instruction}
              </p>
              {currentStep.success_criteria && (
                <div style={{
                  padding: '10px 14px', borderRadius: 12,
                  background: T.elev, border: `1px solid ${T.line}`,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: '0.04em', marginBottom: 4 }}>SUCCESS CRITERIA</div>
                  <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.5, margin: 0 }}>{currentStep.success_criteria}</p>
                </div>
              )}
            </motion.div>
          ) : isEnded ? (
            <div style={{ textAlign: 'center', padding: '2rem', background: T.panel, borderRadius: 20, border: `1px solid ${T.line}` }}>
              <div style={{ fontSize: '2rem', marginBottom: 12 }}>🏁</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.txt, marginBottom: 8 }}>Session ended</div>
              <p style={{ fontSize: 13, color: T.muted }}>
                {session.host.display_name} has wrapped up this live session.
              </p>
            </div>
          ) : session.status === 'scheduled' ? (
            <div style={{ textAlign: 'center', padding: '2rem', background: T.panel, borderRadius: 20, border: `1px solid ${T.line}` }}>
              <div style={{ fontSize: '2rem', marginBottom: 12 }}>⏳</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: T.txt, marginBottom: 8 }}>Not started yet</div>
              <p style={{ fontSize: 13, color: T.muted }}>
                Stay here — the page updates automatically when the host starts.
              </p>
            </div>
          ) : null}
        </AnimatePresence>

        {/* Mission description (if set) */}
        {session.mission?.story_context && (
          <div style={{
            padding: '14px 16px', borderRadius: 16,
            background: T.elev, border: `1px solid ${T.line}`,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, letterSpacing: '0.04em', marginBottom: 6 }}>ABOUT THIS MISSION</div>
            <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.6, margin: 0 }}>
              {session.mission.story_context}
            </p>
          </div>
        )}
      </div>

      {/* Bottom actions */}
      <div style={{
        padding: '16px 16px 32px',
        borderTop: `1px solid ${T.line}`,
        background: 'rgba(7,13,14,.95)', backdropFilter: 'blur(12px)',
      }}>
        {/* Host controls */}
        {isHost && isLive && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <button
              onClick={handleNextStep}
              disabled={hostBusy || (session.current_step_index + 1 >= session.total_steps)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '12px', borderRadius: 12, border: 'none', cursor: 'pointer',
                background: (hostBusy || session.current_step_index + 1 >= session.total_steps) ? T.elev : T.green,
                color: (hostBusy || session.current_step_index + 1 >= session.total_steps) ? T.dim : '#050816',
                fontWeight: 700, fontSize: 14,
              }}
            >
              Next Step <ChevronRight size={16} />
            </button>
            <button
              onClick={handleEndSession}
              disabled={hostBusy}
              style={{
                padding: '12px 16px', borderRadius: 12, border: `1px solid ${T.red}`,
                background: 'none', color: T.red, fontWeight: 600, fontSize: 14, cursor: 'pointer',
              }}
            >
              End
            </button>
          </div>
        )}

        {/* Viewer actions */}
        {!isHost && session.mission && !isEnded && (
          <Link
            href={`/missions`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '14px', borderRadius: 14, textDecoration: 'none',
              background: T.green, color: '#050816', fontWeight: 700, fontSize: 15, marginBottom: 10,
            }}
          >
            <Play size={16} fill="#050816" /> Start This Mission
          </Link>
        )}

        <Link
          href="/timeline"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '11px', borderRadius: 14, textDecoration: 'none',
            border: `1px solid ${T.line2}`, color: T.muted, fontWeight: 600, fontSize: 13,
          }}
        >
          ← Back to Timeline
        </Link>
      </div>
    </main>
  );
}
