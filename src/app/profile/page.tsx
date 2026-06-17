'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Flame, CheckCircle, Settings, ArrowRight, Trophy, Loader2, Sparkles,
  Shield, Zap, Star, TrendingUp, Brain, Globe, Copy, Check,
} from 'lucide-react';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';
import { LIQUID_GLASS_STYLE } from '@/components/LiquidGlass';
import { loadState, clearState, loadProfile } from '@/lib/store';
import type { CompletedHunt, ImpactProfile } from '@/lib/types';

/* ── Design tokens ─────────────────────────────────────────────────────── */
const BG = '#050816', CARD = '#0A1226', SURFACE = '#07101F';
const ACCENT = '#22FFAA', AI = '#6D5DFD', WARN = '#FFB84D', ERR = '#FF5C7A';
const TXT = '#F0F4FF', DIM = '#8B9CC0', FAINT = '#4A5578';
const XGLASS: React.CSSProperties = LIQUID_GLASS_STYLE;

/* ── Types ──────────────────────────────────────────────────────────────── */
interface SkillData {
  name: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  confidence: number;
  evidence: string[];
}
interface CategoryData {
  catId: string;
  count: number;
  label: string;
  emoji: string;
  color: string;
}

/* ── Constants ──────────────────────────────────────────────────────────── */
const LEVEL_CFG = {
  Beginner:     { color: FAINT,  bg: 'rgba(74,85,120,.15)'   },
  Intermediate: { color: ACCENT, bg: 'rgba(34,255,170,.12)'  },
  Advanced:     { color: WARN,   bg: 'rgba(255,184,77,.12)'  },
};

const ARCHETYPE_COLORS: Record<string, string> = {
  Explorer: ACCENT, Builder: AI, Innovator: '#a78bfa',
  Mentor: WARN, Creator: ERR, Analyst: '#60A5FA', Activist: ACCENT,
};

const INTEREST_LABELS: Record<string, string> = {
  adventure: '🌍 Adventure', food: '🍴 Food', art: '🎨 Art', tech: '💻 Tech',
  fitness: '💪 Fitness', mindfulness: '🧘 Mindfulness', social: '👥 Social', learning: '📚 Learning',
};

function getInitials(name: string | null) {
  if (!name) return 'XP';
  const p = name.trim().split(' ');
  return p.length >= 2 ? (p[0][0] + p[1][0]).toUpperCase() : name.slice(0, 2).toUpperCase();
}

function isUUID(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/* ── Page ───────────────────────────────────────────────────────────────── */
export default function ProfilePage() {
  const router = useRouter();
  const [interests, setInterests]       = useState<string[]>([]);
  const [completedHunts, setCompleted]  = useState<CompletedHunt[]>([]);
  const [streak, setStreak]             = useState(0);
  const [displayName, setName]          = useState<string | null>(null);
  const [loading, setLoading]           = useState(false);
  const [mounted, setMounted]           = useState(false);
  const [subStatus, setSub]             = useState<{ tier: string; isTrialActive: boolean; trialDaysLeft: number; hasUsedTrial: boolean; canUseAI: boolean } | null>(null);
  const [impactProfile, setProfile]     = useState<ImpactProfile | null>(null);
  const [skills, setSkills]             = useState<SkillData[]>([]);
  const [categories, setCategories]     = useState<CategoryData[]>([]);
  const [copied, setCopied]             = useState(false);

  useEffect(() => {
    const state = loadState();
    if (!state.user?.onboardingComplete) { router.replace('/get-started'); return; }
    setInterests(state.user?.interests ?? []);
    setCompleted(state.completedHunts);
    setStreak(state.streak);
    setMounted(true);
    setProfile(loadProfile());
    void fetch('/api/subscription/status').then((r) => r.json()).then((d) => setSub(d as typeof subStatus)).catch(() => {});

    void (async () => {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return;
      setLoading(true);
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const sb = createClient();
        const { data: { user } } = await sb.auth.getUser();
        if (!user) { setLoading(false); return; }

        const { data: profile } = await sb.from('user_profiles').select('display_name, interests').eq('id', user.id).single();
        if (profile?.display_name) setName(profile.display_name);
        if (profile?.interests?.length) setInterests(profile.interests);

        const { data: progress } = await sb
          .from('mission_progress')
          .select('mission_id, completed_at')
          .eq('user_id', user.id)
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: false });

        if (progress?.length) {
          const ids = [...new Set(progress.map((p: { mission_id: string }) => p.mission_id))];
          const { data: missions } = await sb.from('missions').select('id, title, reward').in('id', ids);
          if (missions?.length) {
            const mMap = new Map((missions as { id: string; title: string; reward: string }[]).map((m) => [m.id, m]));
            const merged: CompletedHunt[] = progress
              .filter((p: { mission_id: string }) => mMap.has(p.mission_id))
              .map((p: { mission_id: string; completed_at: string }) => {
                const m = mMap.get(p.mission_id)!;
                return { huntId: p.mission_id, huntTitle: m.title, reward: m.reward, completedAt: p.completed_at };
              });
            setCompleted((prev) => {
              const sbIds = new Set(merged.map((c) => c.huntId));
              const local = prev.filter((c) => !sbIds.has(c.huntId) && !isUUID(c.huntId));
              return [...merged, ...local].sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
            });
          }
        }

        const skillsRes = await fetch('/api/skills/infer');
        if (skillsRes.ok) {
          const data = await skillsRes.json() as { skills: SkillData[]; topCategories: CategoryData[] };
          setSkills(data.skills ?? []);
          setCategories(data.topCategories ?? []);
        }
      } catch { /* silent */ }
      setLoading(false);
    })();
  }, [router]);

  if (!mounted) return null;

  const initials   = getInitials(displayName);
  const name       = displayName ?? 'Explorer';
  const mms        = Math.min(1000, 50 + completedHunts.length * 40 + streak * 15);
  const tierLabel  = mms >= 700 ? 'Elite Hunter' : mms >= 400 ? 'Pro Hunter' : mms >= 150 ? 'Verified Hunter' : 'Explorer';
  const tierColor  = mms >= 700 ? WARN : mms >= 400 ? AI : mms >= 150 ? ACCENT : FAINT;
  const impactScore = completedHunts.length * 12 + streak * 5 + categories.length * 8;
  const aColor = ARCHETYPE_COLORS[impactProfile?.archetype ?? ''] ?? ACCENT;

  function copyLink() {
    void navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="consumer-app" style={{ minHeight: '100vh', paddingBottom: 100, background: BG, color: TXT }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* ── Hero ── */}
        <div style={{
          padding: '56px 20px 24px',
          background: `radial-gradient(600px 500px at 50% -40px, rgba(34,255,170,.06) 0%, rgba(109,93,253,.04) 40%, transparent 70%), ${SURFACE}`,
          borderBottom: '1px solid rgba(255,255,255,.07)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: TXT, letterSpacing: '-.02em' }}>Impact Portfolio</h1>
            <div style={{ display: 'flex', gap: 8 }}>
              {loading && <Loader2 size={14} style={{ color: FAINT, animation: 'spin 1s linear infinite', marginTop: 3 }} strokeWidth={2} />}
              <button onClick={copyLink} title="Copy portfolio link"
                style={{ width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(34,255,170,.07)', border: '1px solid rgba(34,255,170,.18)', cursor: 'pointer' }}>
                {copied
                  ? <Check size={15} strokeWidth={2.5} style={{ color: ACCENT }} />
                  : <Copy size={15} strokeWidth={1.8} style={{ color: ACCENT }} />}
              </button>
              <button
                onClick={() => { if (confirm('Reset all data and start fresh?')) { clearState(); router.replace('/'); } }}
                style={{ width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', cursor: 'pointer' }}>
                <Settings size={16} strokeWidth={1.8} style={{ color: DIM }} />
              </button>
            </div>
          </div>

          {/* Avatar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: 68, height: 68, borderRadius: 22, background: `linear-gradient(135deg, ${ACCENT}22, ${AI}30)`, border: `2px solid ${ACCENT}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 28px ${ACCENT}20` }}>
                <span style={{ fontSize: 24, fontWeight: 900, color: ACCENT }}>{initials}</span>
              </div>
              <div style={{ position: 'absolute', bottom: -4, right: -4, width: 20, height: 20, borderRadius: '50%', background: CARD, border: `2px solid ${BG}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: tierColor, boxShadow: `0 0 8px ${tierColor}` }} />
              </div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: TXT, letterSpacing: '-.02em' }}>{name}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: tierColor, background: `${tierColor}14`, border: `1px solid ${tierColor}28`, borderRadius: 999, padding: '2px 10px' }}>{tierLabel}</span>
                {impactProfile?.archetype && (
                  <span style={{ fontSize: 11, fontWeight: 600, color: aColor, background: `${aColor}12`, border: `1px solid ${aColor}22`, borderRadius: 999, padding: '2px 10px' }}>{impactProfile.archetype}</span>
                )}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {[
              { label: 'MMS',      value: mms,                   accent: ACCENT, icon: TrendingUp },
              { label: 'Missions', value: completedHunts.length, accent: ACCENT, icon: Trophy     },
              { label: 'Skills',   value: skills.length,         accent: AI,     icon: Brain      },
              { label: 'Impact',   value: impactScore,           accent: WARN,   icon: Star       },
            ].map(({ label, value, accent, icon: Icon }) => (
              <div key={label} className="liquid-glass" style={{ ...XGLASS, borderRadius: 14, padding: '11px 6px', textAlign: 'center' }}>
                <Icon size={12} strokeWidth={2} style={{ color: accent, marginBottom: 4 }} />
                <div style={{ fontSize: 17, fontWeight: 800, color: accent, lineHeight: 1 }}>{value.toLocaleString()}</div>
                <div style={{ fontSize: 9.5, fontWeight: 600, color: FAINT, textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 3 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: '20px' }}>

          {/* ── Skills Intelligence ── */}
          {skills.length > 0 && (
            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: TXT }}>Skills</h2>
                <span style={{ fontSize: 10, fontWeight: 700, color: FAINT, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 999, padding: '3px 10px', textTransform: 'uppercase', letterSpacing: '.07em' }}>AI Inferred</span>
              </div>
              <div className="liquid-glass" style={{ ...XGLASS, borderRadius: 20, padding: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
                  {skills.slice(0, 6).map((s, i) => {
                    const cfg = LEVEL_CFG[s.level] ?? LEVEL_CFG.Beginner;
                    return (
                      <motion.div key={s.name} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12.5, fontWeight: 600, color: DIM }}>{s.name}</span>
                            <span style={{ fontSize: 9, fontWeight: 800, color: cfg.color, background: cfg.bg, borderRadius: 999, padding: '1px 7px', textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.level}</span>
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 800, color: cfg.color }}>{s.confidence}%</span>
                        </div>
                        <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,.05)', overflow: 'hidden' }}>
                          <motion.div
                            initial={{ width: 0 }} animate={{ width: `${s.confidence}%` }}
                            transition={{ duration: 0.7, delay: 0.2 + i * 0.06 }}
                            style={{ height: '100%', borderRadius: 3, background: `linear-gradient(90deg, ${cfg.color}70, ${cfg.color})` }}
                          />
                        </div>
                        {s.evidence.length > 0 && (
                          <p style={{ margin: '4px 0 0', fontSize: 10, color: FAINT }}>via {s.evidence.slice(0, 2).join(' · ')}</p>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </motion.section>
          )}

          {/* ── Impact Areas / SDG Categories ── */}
          {categories.length > 0 && (
            <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: TXT }}>Impact Areas</h2>
                <Globe size={13} strokeWidth={2} style={{ color: FAINT }} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {categories.map((cat) => (
                  <div key={cat.catId} style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 999, padding: '6px 13px', background: `${cat.color}0F`, border: `1px solid ${cat.color}25` }}>
                    <span style={{ fontSize: 13 }}>{cat.emoji}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: cat.color }}>{cat.label}</span>
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: cat.color, background: `${cat.color}18`, borderRadius: 999, padding: '0 5px' }}>{cat.count}</span>
                  </div>
                ))}
              </div>
            </motion.section>
          )}

          {/* ── Rewards CTA ── */}
          <motion.a href="/rewards" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 18, marginBottom: 14, background: 'linear-gradient(135deg, rgba(34,255,170,.07), rgba(109,93,253,.07))', border: '1px solid rgba(34,255,170,.18)', textDecoration: 'none' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg,#22FFAA,#6D5DFD)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 18 }}>🏆</div>
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 700, color: TXT }}>Rewards & Earnings</p>
              <p style={{ margin: 0, fontSize: 12, color: DIM }}>Badges, payouts, Hunter Score progress</p>
            </div>
            <ArrowRight size={16} strokeWidth={2} style={{ color: ACCENT, flexShrink: 0 }} />
          </motion.a>

          {/* ── Streak ── */}
          {streak > 0 && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              style={{ borderRadius: 20, padding: '16px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14, background: `rgba(255,184,77,.07)`, border: `1px solid rgba(255,184,77,.18)` }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `rgba(255,184,77,.12)` }}>
                <Flame size={22} strokeWidth={2} style={{ color: WARN }} />
              </div>
              <div>
                <p style={{ margin: '0 0 1px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: FAINT }}>Daily Streak</p>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: WARN }}>{streak} Day{streak !== 1 ? 's' : ''}</p>
              </div>
            </motion.div>
          )}

          {/* ── Plan Card ── */}
          {subStatus && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              style={{ borderRadius: 20, padding: '14px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12,
                background: subStatus.isTrialActive ? `rgba(109,93,253,.07)` : subStatus.tier === 'pro' ? `rgba(34,255,170,.06)` : CARD,
                border: `1px solid ${subStatus.isTrialActive ? 'rgba(109,93,253,.2)' : subStatus.tier === 'pro' ? 'rgba(34,255,170,.15)' : 'rgba(255,255,255,.07)'}` }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: subStatus.isTrialActive ? `rgba(109,93,253,.12)` : subStatus.tier === 'pro' ? `rgba(34,255,170,.1)` : 'rgba(255,255,255,.04)' }}>
                {subStatus.tier === 'pro' ? <Shield size={19} style={{ color: ACCENT }} strokeWidth={2} /> : subStatus.isTrialActive ? <Sparkles size={19} style={{ color: AI }} strokeWidth={2} /> : <Zap size={19} style={{ color: FAINT }} strokeWidth={2} />}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 1px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: FAINT }}>Current Plan</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: TXT }}>{subStatus.tier === 'pro' ? 'Pro' : subStatus.isTrialActive ? `Trial · ${subStatus.trialDaysLeft}d left` : 'Free'}</p>
              </div>
              {subStatus.tier !== 'pro' && (
                <button onClick={() => router.push('/upgrade')} style={{ fontSize: 12, fontWeight: 700, color: subStatus.isTrialActive ? AI : ACCENT, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3, padding: 0, flexShrink: 0 }}>
                  {subStatus.isTrialActive ? 'Upgrade' : subStatus.hasUsedTrial ? 'Go Pro' : 'Try Free'} <ArrowRight size={12} strokeWidth={2.5} />
                </button>
              )}
            </motion.div>
          )}

          {/* ── Impact DNA ── */}
          {impactProfile && (
            <section style={{ marginBottom: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: TXT }}>Impact DNA</h2>
                <span style={{ fontSize: 10, fontWeight: 700, color: FAINT, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 999, padding: '3px 10px', textTransform: 'uppercase', letterSpacing: '.07em' }}>AI Profile</span>
              </div>

              <div style={{ borderRadius: 20, padding: '14px 16px', background: `linear-gradient(135deg, ${aColor}08, ${AI}06)`, border: `1px solid ${aColor}18`, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 46, height: 46, borderRadius: 14, background: `${aColor}18`, border: `1.5px solid ${aColor}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Brain size={21} strokeWidth={1.5} style={{ color: aColor }} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 1px', fontSize: 10, fontWeight: 700, color: FAINT, textTransform: 'uppercase', letterSpacing: '.08em' }}>Archetype</p>
                  <p style={{ margin: '0 0 3px', fontSize: 18, fontWeight: 900, color: aColor, letterSpacing: '-.02em' }}>{impactProfile.archetype}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 10, color: FAINT }}>Impact Score</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: aColor }}>{impactProfile.impactScore}</span>
                    <span style={{ fontSize: 10, color: FAINT }}>/ 100</span>
                  </div>
                </div>
              </div>

              {impactProfile.strengths.length > 0 && (
                <div className="liquid-glass" style={{ ...XGLASS, borderRadius: 18, padding: '14px 16px', marginBottom: 10 }}>
                  <p style={{ margin: '0 0 12px', fontSize: 10, fontWeight: 700, color: FAINT, textTransform: 'uppercase', letterSpacing: '.08em' }}>Top Strengths</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {impactProfile.strengths.slice(0, 4).map((s) => (
                      <div key={s.name}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, color: DIM, fontWeight: 600 }}>{s.name}</span>
                          <span style={{ fontSize: 11, color: aColor, fontWeight: 800 }}>{s.score}%</span>
                        </div>
                        <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,.05)', overflow: 'hidden' }}>
                          <motion.div
                            initial={{ width: 0 }} animate={{ width: `${s.score}%` }}
                            transition={{ duration: 0.7, ease: 'easeOut' }}
                            style={{ height: '100%', borderRadius: 3, background: `linear-gradient(90deg, ${aColor}80, ${aColor})` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {impactProfile.causes.length > 0 && (
                  <div className="liquid-glass" style={{ ...XGLASS, borderRadius: 16, padding: '12px 14px' }}>
                    <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 700, color: FAINT, textTransform: 'uppercase', letterSpacing: '.08em' }}>Causes</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {impactProfile.causes.map((c) => (
                        <span key={c} style={{ fontSize: 9.5, fontWeight: 700, color: ACCENT, background: `${ACCENT}10`, border: `1px solid ${ACCENT}20`, borderRadius: 999, padding: '2px 8px' }}>{c}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div className="liquid-glass" style={{ ...XGLASS, borderRadius: 16, padding: '12px 14px' }}>
                  <p style={{ margin: '0 0 8px', fontSize: 10, fontWeight: 700, color: FAINT, textTransform: 'uppercase', letterSpacing: '.08em' }}>Availability</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Sparkles size={11} style={{ color: ACCENT }} strokeWidth={2} />
                    <span style={{ fontSize: 11, color: TXT, fontWeight: 600 }}>{impactProfile.availability}</span>
                  </div>
                  <p style={{ margin: '5px 0 0', fontSize: 9.5, color: FAINT }}>per week</p>
                </div>
              </div>
            </section>
          )}

          {/* ── Interests ── */}
          {interests.length > 0 && (
            <section style={{ marginBottom: 22 }}>
              <h2 style={{ margin: '0 0 12px', fontSize: 15, fontWeight: 700, color: TXT }}>Interests</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {interests.map((id) => (
                  <span key={id} style={{ ...XGLASS, borderRadius: 999, padding: '6px 14px', fontSize: 13, fontWeight: 500, color: TXT }}>{INTEREST_LABELS[id] ?? id}</span>
                ))}
              </div>
            </section>
          )}

          {/* ── Mission Timeline ── */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: TXT }}>
                Mission History {completedHunts.length > 0 && `(${completedHunts.length})`}
              </h2>
              {completedHunts.length > 0 && (
                <Link href="/missions" style={{ fontSize: 11, fontWeight: 600, color: ACCENT, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                  Browse More <ArrowRight size={11} strokeWidth={2.5} />
                </Link>
              )}
            </div>

            {completedHunts.length === 0 ? (
              <div className="liquid-glass" style={{ ...XGLASS, borderRadius: 20, padding: '32px 20px', textAlign: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: `rgba(34,255,170,.08)`, border: `1px solid rgba(34,255,170,.15)`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                  <Trophy size={22} strokeWidth={1.6} style={{ color: ACCENT }} />
                </div>
                <p style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: TXT }}>No completed missions yet</p>
                <p style={{ margin: '0 0 18px', fontSize: 13, color: DIM }}>Complete missions to build your impact portfolio.</p>
                <button onClick={() => router.push('/missions')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: ACCENT, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Browse Missions <ArrowRight size={14} strokeWidth={2.5} />
                </button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 19, top: 8, bottom: 8, width: 2, background: 'rgba(255,255,255,.05)', borderRadius: 1 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {completedHunts.map((c, i) => (
                    <motion.div key={c.huntId} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                      style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: CARD, border: `2px solid ${ACCENT}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, marginTop: 11 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: ACCENT, boxShadow: `0 0 6px ${ACCENT}80` }} />
                      </div>
                      <div className="liquid-glass" style={{ flex: 1, ...XGLASS, borderRadius: 18, padding: '13px 15px' }}>
                        <p style={{ margin: '0 0 3px', fontSize: 13.5, fontWeight: 600, color: TXT, lineHeight: 1.3 }}>{c.huntTitle}</p>
                        <p style={{ margin: '0 0 8px', fontSize: 11.5, fontWeight: 600, color: ACCENT }}>{c.reward.split('+')[0].trim()}</p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <p style={{ margin: 0, fontSize: 10.5, color: FAINT }}>
                            {new Date(c.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle size={11} strokeWidth={2} style={{ color: ACCENT }} />
                            <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT }}>Completed</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <p style={{ textAlign: 'center', fontSize: 11, marginTop: 32, color: FAINT }}>XHunt · AI-Powered Outcome Intelligence</p>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
