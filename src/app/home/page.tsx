'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Compass, Zap, X, ArrowUpRight, ArrowRight,
  Users, BarChart3, MessageSquare, Sparkles, Flame, Star, CheckCircle2, Target,
} from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { LIQUID_GLASS_STYLE } from '@/components/LiquidGlass';
import { MMSCard, StatCard } from '@/components/home/MMSCard';
import { MissionCard } from '@/components/home/MissionCard';
import { ActiveMissionCard } from '@/components/home/ActiveMissionCard';
import { AIInsightCard, type Recommendation } from '@/components/home/AIInsightCard';
import { ActivityFeed } from '@/components/home/ActivityFeed';
import { loadState, saveState, loadProfile } from '@/lib/store';
import { fetchSupabaseMissions } from '@/lib/supabase/events';
import { computeMatchScore, greeting } from '@/lib/missionHelpers';
import { loadAIConfig, DEFAULT_AI_CONFIG, type AIConfig } from '@/lib/aiConfig';
import { t } from '@/theme/colors';
import type { Hunt, ImpactProfile } from '@/lib/types';

interface SubStatus { tier: string; isTrialActive: boolean; trialDaysLeft: number; hasUsedTrial: boolean; canUseAI: boolean; }

const QUICK_ACTIONS = [
  { icon: Compass,       label: 'Explore',  href: '/explore'  },
  { icon: Users,         label: 'People',   href: '/people'   },
  { icon: BarChart3,     label: 'Missions', href: '/missions' },
  { icon: MessageSquare, label: 'Messages', href: '/messages' },
];

export default function HomePage() {
  const router = useRouter();
  const [hunts, setHunts]           = useState<Hunt[]>([]);
  const [completedIds, setIds]       = useState<string[]>([]);
  const [activeMissionSteps, setAMS] = useState(0);
  const [streak, setStreak]          = useState(0);
  const [mounted, setMounted]        = useState(false);
  const [subStatus, setSub]          = useState<SubStatus | null>(null);
  const [nudgeDismissed, setNudge]   = useState(false);
  const [aiDismissed, setAIDismiss]  = useState(false);
  const [recs, setRecs]              = useState<Recommendation[]>([]);
  const [userName, setUserName]      = useState('Explorer');
  const [profile, setProfile]        = useState<ImpactProfile | null>(null);
  const [aiConfig, setAIConfig]      = useState<AIConfig>(DEFAULT_AI_CONFIG);

  useEffect(() => {
    const state = loadState();
    if (!state.user?.onboardingComplete) { router.replace('/get-started'); return; }
    const completed = state.completedHunts.map(h => h.huntId);
    setIds(completed);
    setStreak(state.streak);
    if ((state.user as { name?: string }).name) setUserName((state.user as { name?: string }).name!);
    setHunts(state.hunts);
    setProfile(loadProfile());
    setAIConfig(loadAIConfig());
    const topId = state.hunts.find(h => !completed.includes(h.id))?.id;
    if (topId && state.progress[topId]) setAMS(state.progress[topId].completedSteps?.length ?? 0);
    setMounted(true);
    void fetchSupabaseMissions().then(r => { if (r?.length) { setHunts(r); const s = loadState(); saveState({ ...s, hunts: r }); } });
    void fetch('/api/subscription/status').then(r => r.json()).then((d: SubStatus) => setSub(d)).catch(() => {});
    void fetch('/api/recommendations?limit=5').then(r => r.ok ? r.json() : null).then(d => { if (d?.recommendations?.length) setRecs(d.recommendations); }).catch(() => {});
  }, [router]);

  if (!mounted) return null;

  const active   = hunts.filter(h => !completedIds.includes(h.id));
  const done     = hunts.filter(h =>  completedIds.includes(h.id));
  const topHunt  = active[0] ?? null;
  const mms      = Math.min(1000, 50 + completedIds.length * 40 + streak * 15);
  const mmsDelta = streak * 3 + completedIds.length * 2;
  const xpBal    = 100 + completedIds.length * 250 + streak * 15;
  const tier     = mms >= 700 ? 'Elite Hunter' : mms >= 400 ? 'Pro Hunter' : mms >= 150 ? 'Verified Hunter' : 'Explorer';
  const tierClr  = mms >= 700 ? t.warning : mms >= 400 ? t.ai : mms >= 150 ? t.accent : t.txtFaint;
  const displayedMissions = active.length > 0 ? active : done;

  const quickActionsBlock = (
    <div>
      <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, color: t.txtFaint, textTransform: 'uppercase', letterSpacing: '.08em' }}>Quick Actions</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 9 }}>
        {QUICK_ACTIONS.map(({ icon: Icon, label, href }) => (
          <Link key={label} href={href} style={{ textDecoration: 'none' }}>
            <motion.div whileTap={{ scale: .93 }} className="liquid-glass"
              style={{ ...LIQUID_GLASS_STYLE, borderRadius: 14, padding: '12px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <Icon size={18} strokeWidth={1.8} style={{ color: t.txtDim }} />
              <span style={{ fontSize: 10, fontWeight: 600, color: t.txtFaint }}>{label}</span>
            </motion.div>
          </Link>
        ))}
      </div>
    </div>
  );

  const streakBlock = streak > 0 && (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .35 }}
      className="liquid-glass" style={{ ...LIQUID_GLASS_STYLE, borderRadius: 20, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 34, height: 34, borderRadius: 11, background: `${t.warning}14`, border: `1px solid ${t.warning}28`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Flame size={17} strokeWidth={2} style={{ color: t.warning }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: t.txt }}>Daily Streak</p>
            <p style={{ margin: 0, fontSize: 10.5, color: t.txtFaint }}>{streak} days in a row</p>
          </div>
        </div>
        <span style={{ fontSize: 28, fontWeight: 900, color: t.warning, letterSpacing: '-0.04em' }}>{streak}</span>
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'space-between' }}>
        {['M','T','W','T','F','S','S'].map((d, i) => {
          const filled = i < streak;
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: filled ? `${t.accent}18` : 'rgba(255,255,255,.04)', border: `1px solid ${filled ? t.accent : 'rgba(255,255,255,.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: filled ? `0 0 8px ${t.accent}30` : 'none' }}>
                {filled && <div style={{ width: 8, height: 8, borderRadius: '50%', background: t.accent }} />}
              </div>
              <span style={{ fontSize: 9, fontWeight: 600, color: filled ? t.accent : t.txtFaint }}>{d}</span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );

  return (
    <div className="consumer-app" style={{ minHeight: '100vh', background: 'var(--t-bg)', paddingBottom: 100 }}>
      {/* Ambient glows */}
      <div style={{ position: 'fixed', top: -80, right: -80, width: 320, height: 320, borderRadius: '50%', background: `radial-gradient(circle,${t.accent}08 0%,transparent 65%)`, pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: 80, left: -60, width: 200, height: 200, borderRadius: '50%', background: `radial-gradient(circle,${t.ai}08 0%,transparent 65%)`, pointerEvents: 'none', zIndex: 0 }} />

      <div style={{ maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 1 }}>

        {/* Top bar */}
        <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(5,8,22,.88)', backdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(255,255,255,.05)', padding: '50px 24px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="md:hidden" style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div style={{ position: 'relative', width: 36, height: 36 }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `2px solid ${t.accent}`, opacity: .95 }} />
              <div style={{ position: 'absolute', inset: 6, borderRadius: '50%', border: `1.5px solid ${t.accent}50` }} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: t.accent, letterSpacing: '-0.05em' }}>X</span>
              </div>
            </div>
            <span style={{ fontSize: 15, fontWeight: 800, color: t.txt, letterSpacing: '-0.03em' }}>XHUNT</span>
          </div>
          <div className="hidden md:block">
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: t.txt, letterSpacing: '-0.025em' }}>{greeting()}, {userName} 👋</h2>
            <p style={{ margin: 0, fontSize: 12, color: t.txtDim }}>
              {active.length > 0 ? `${active.length} mission${active.length !== 1 ? 's' : ''} waiting` : done.length > 0 ? `${done.length} completed · Great work` : 'Start your first mission'}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link href="/explore" style={{ textDecoration: 'none' }}>
              <div style={{ height: 38, borderRadius: 12, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px', cursor: 'pointer' }}>
                <span style={{ fontSize: 12, color: t.txtFaint }}>Search missions…</span>
              </div>
            </Link>
            <button style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', position: 'relative', flexShrink: 0 }}>
              <Bell size={16} strokeWidth={1.8} style={{ color: t.txtDim }} />
              <div style={{ position: 'absolute', top: 7, right: 7, width: 7, height: 7, borderRadius: '50%', background: t.accent, border: `1.5px solid ${t.bg}`, animation: 'breathe 2.5s ease-in-out infinite' }} />
            </button>
            <Link href="/profile" style={{ textDecoration: 'none' }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: `linear-gradient(135deg,${t.accent}20,${t.ai}20)`, border: `1.5px solid ${t.accent}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: t.accent }}>{userName[0].toUpperCase()}</span>
              </div>
            </Link>
          </div>
        </div>

        {/* Mobile greeting */}
        <div className="md:hidden" style={{ padding: '24px 24px 0' }}>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .4 }}>
            <h1 style={{ margin: '0 0 3px', fontSize: 22, fontWeight: 800, color: t.txt, letterSpacing: '-0.03em' }}>{greeting()}, {userName} 👋</h1>
            <p style={{ margin: 0, fontSize: 13, color: t.txtDim }}>
              {active.length > 0 ? `${active.length} mission${active.length !== 1 ? 's' : ''} waiting · Let's complete them.` : done.length > 0 ? `${done.length} completed · Great work.` : 'Generate your first mission to start earning.'}
            </p>
          </motion.div>
        </div>

        {/* Stat cards */}
        <div style={{ padding: '20px 24px 0' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <MMSCard score={mms} delta={mmsDelta} tier={tier} tierColor={tierClr} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: '0 0 108px', width: 108 }}>
              <StatCard label="XPoints" value={xpBal} sub={`+${completedIds.length * 50 || 0} Today`} icon={Star} accent={t.ai} index={0} />
              <StatCard label="Completed" value={completedIds.length} sub={`+${Math.min(streak, 3)} this week`} icon={CheckCircle2} accent={t.accent} index={1} />
            </div>
          </div>
        </div>

        {/* Freemium nudge */}
        <AnimatePresence>
          {subStatus && !subStatus.canUseAI && !subStatus.hasUsedTrial && !nudgeDismissed && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
              style={{ margin: '16px 24px 0', borderRadius: 16, background: `${t.ai}0D`, border: `1px solid ${t.ai}28`, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Sparkles size={15} strokeWidth={2} style={{ color: t.ai, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: t.txt }}>Unlock AI Agents + Premium Missions</p>
                <p style={{ margin: '1px 0 0', fontSize: 10.5, color: t.txtFaint }}>14-day free trial · No card required</p>
              </div>
              <button onClick={() => router.push('/upgrade')} style={{ fontSize: 11.5, fontWeight: 700, color: t.ai, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                Try free <ArrowRight size={11} strokeWidth={2.5} />
              </button>
              <button onClick={() => setNudge(true)} style={{ background: 'none', border: 0, cursor: 'pointer', padding: 2 }}>
                <X size={13} strokeWidth={2} style={{ color: t.txtFaint }} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Two-column layout */}
        <div className="md:flex md:gap-6 md:items-start" style={{ padding: '0 24px' }}>

          {/* Main column */}
          <div className="md:flex-1 md:min-w-0">

            {topHunt && (
              <div style={{ paddingTop: 20 }}>
                <ActiveMissionCard hunt={topHunt} stepsCompleted={activeMissionSteps} matchScore={computeMatchScore(topHunt, profile)} />
              </div>
            )}

            {recs.length > 0 && !aiDismissed && (
              <div style={{ paddingTop: 16 }}>
                <AIInsightCard recs={recs} onDismiss={() => setAIDismiss(true)} config={aiConfig} onConfigSave={setAIConfig} />
              </div>
            )}

            <div style={{ paddingTop: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: t.txt }}>
                  {recs.length > 0 ? 'Recommended for You' : active.length > 0 ? 'Active Missions' : 'All Missions'}
                </p>
                <Link href="/explore" style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 600, color: t.txtDim, textDecoration: 'none' }}>
                  View all <ArrowUpRight size={12} strokeWidth={2} />
                </Link>
              </div>

              {hunts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 0' }}>
                  <div style={{ width: 52, height: 52, borderRadius: '50%', background: `${t.accent}0D`, border: `1px solid ${t.accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                    <Compass size={22} strokeWidth={1.6} style={{ color: t.accent }} />
                  </div>
                  <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: t.txt }}>No missions yet</p>
                  <p style={{ margin: '0 0 20px', fontSize: 12.5, color: t.txtFaint }}>Generate your first AI mission to start earning.</p>
                  <Link href="/explore" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 22px', borderRadius: 14, background: t.accent, color: t.bg, fontWeight: 800, fontSize: 13.5, textDecoration: 'none', boxShadow: `0 0 24px ${t.accent}40` }}>
                    <Zap size={14} strokeWidth={2.5} /> Start My First Hunt
                  </Link>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {displayedMissions.slice(0, 4).map((hunt, i) => (
                    <MissionCard key={hunt.id} hunt={hunt} index={i} isCompleted={completedIds.includes(hunt.id)} matchScore={computeMatchScore(hunt, profile)} />
                  ))}
                </div>
              )}
            </div>

            {done.length > 0 && (
              <div className="liquid-glass" style={{ marginTop: 24, ...LIQUID_GLASS_STYLE, borderRadius: 22, padding: '18px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: t.txt }}>Recent Activity</p>
                  <Link href="/profile" style={{ fontSize: 12, fontWeight: 600, color: t.txtDim, textDecoration: 'none' }}>View all</Link>
                </div>
                <ActivityFeed completedHunts={done} streak={streak} />
              </div>
            )}

            {done.length > 0 && active.length > 0 && (
              <div style={{ paddingTop: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: t.txt }}>Completed</p>
                  <span style={{ fontSize: 11, color: t.txtFaint }}>{done.length} verified</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {done.slice(0, 3).map((hunt, i) => <MissionCard key={hunt.id} hunt={hunt} index={i} isCompleted matchScore={null} />)}
                </div>
              </div>
            )}

            <div className="md:hidden">
              <div style={{ paddingTop: 20 }}>{quickActionsBlock}</div>
              {streak > 0 && <div style={{ marginTop: 16 }}>{streakBlock}</div>}
            </div>
          </div>

          {/* Desktop right rail */}
          <div className="hidden md:flex md:flex-col md:gap-5" style={{ width: 300, flexShrink: 0, paddingTop: 20 }}>
            {quickActionsBlock}
            {streakBlock}

            <div className="liquid-glass" style={{ ...LIQUID_GLASS_STYLE, borderRadius: 20, padding: '16px 18px' }}>
              <p style={{ margin: '0 0 14px', fontSize: 13, fontWeight: 800, color: t.txt }}>Your Progress</p>
              {[
                { label: 'Profile Complete', pct: 72,                                               color: t.accent  },
                { label: 'Impact Score',     pct: Math.min(100, 45 + completedIds.length * 12),     color: t.ai     },
                { label: 'Mission XP',       pct: Math.min(100, Math.round(xpBal / 50)),            color: t.warning },
              ].map(({ label, pct, color }) => (
                <div key={label} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 11, color: t.txtDim, fontWeight: 600 }}>{label}</span>
                    <span style={{ fontSize: 11, color, fontWeight: 700 }}>{pct}%</span>
                  </div>
                  <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: .8, delay: .3, ease: 'easeOut' }}
                      style={{ height: '100%', borderRadius: 999, background: color, boxShadow: `0 0 6px ${color}60` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="liquid-glass" style={{ ...LIQUID_GLASS_STYLE, borderRadius: 20, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 13, background: `${t.accent}14`, border: `1px solid ${t.accent}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Target size={20} strokeWidth={1.8} style={{ color: t.accent }} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 900, color: t.txt, letterSpacing: '-0.04em' }}>{active.length}</p>
                <p style={{ margin: 0, fontSize: 11, color: t.txtDim }}>Active mission{active.length !== 1 ? 's' : ''}</p>
              </div>
              <Link href="/missions" style={{ marginLeft: 'auto', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: t.accent }}>
                View all <ArrowRight size={11} strokeWidth={2.5} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
