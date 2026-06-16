'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Clock, Zap, Trophy, CheckCircle2, ShieldCheck, Building2,
  Lock, Sparkles, Bell, DollarSign, Star, Users, Calendar,
  Brain, TrendingUp, Award, MapPin, ChevronRight, Bookmark,
} from 'lucide-react';
import BottomNav from '@/components/BottomNav';
import { LIQUID_GLASS_STYLE } from '@/components/LiquidGlass';
import { loadState, saveState, loadProfile } from '@/lib/store';
import { fetchSupabaseMissions } from '@/lib/supabase/events';
import {
  DIFF_META, MISSION_TYPE_META, ORG_TYPE_META, SDG_META,
  estimateCashReward, estimateXP, deadlineLabel, spotsLabel, resolveCategory,
} from '@/lib/missionCategories';
import type { Hunt, ImpactProfile } from '@/lib/types';

/* ─── Unsplash thumbnails ─── */
const MISSION_IMAGES: Record<string, string> = {
  fitness:   'photo-1571019613454-1cb2f99b2d8b',
  adventure: 'photo-1476514525535-07fb3b4ae5f1',
  food:      'photo-1504674900247-0877df9cc836',
  tech:      'photo-1518770660439-4636190af475',
  learning:  'photo-1456513080510-7bf3a84b82f8',
  social:    'photo-1529156069898-49953e39b3ac',
  art:       'photo-1513364776144-60967b0f800f',
  travel:    'photo-1488085061387-422e29b40080',
  mindful:   'photo-1506126613408-eca07ce68773',
  civic:     'photo-1554224155-6726b3ff858f',
  nature:    'photo-1441974231531-c6227db76b6e',
  finance:   'photo-1611974789855-9c2a0a7236a3',
  default:   'photo-1519389950473-47ba0277781c',
};
function getMissionImage(tags: string[], w = 700, h = 260): string {
  for (const t of tags) { const id = MISSION_IMAGES[t.toLowerCase()]; if (id) return `https://images.unsplash.com/${id}?w=${w}&h=${h}&fit=crop&q=75&auto=format`; }
  return `https://images.unsplash.com/${MISSION_IMAGES.default}?w=${w}&h=${h}&fit=crop&q=75&auto=format`;
}

/* ─── tokens ─── */
const BG     = '#050816';
const CARD   = '#0A1226';
const SURF   = '#07101F';
const ACCENT = '#22FFAA';
const AI_CLR = '#6D5DFD';
const WARN   = '#FFB84D';
const ERR    = '#FF5C7A';
const TXT    = '#F0F4FF';
const DIM    = '#8B9CC0';
const FAINT  = '#4A5578';
const XGLASS: React.CSSProperties = LIQUID_GLASS_STYLE;

/* ─── helpers ─── */
function matchScore(hunt: Hunt, profile: ImpactProfile | null): number | null {
  if (!profile) return null;
  const tl = hunt.tags.map((t) => t.toLowerCase());
  const cl = profile.causes.map((c) => c.toLowerCase());
  const sl = profile.strengths.map((s) => s.name.toLowerCase());
  let s = 55;
  for (const t of tl) {
    if (cl.some((c) => c.includes(t) || t.includes(c))) s += 12;
    if (sl.some((k) => k.includes(t) || t.includes(k))) s += 8;
  }
  return Math.min(98, s + Math.round((profile.impactScore / 100) * 8));
}

/* ─── tabs ─── */
const TABS = ['All', 'Active', 'Applied', 'Completed'] as const;
type Tab = typeof TABS[number];

/* ─── interface ─── */
interface SubStatus { canAccessPremiumMissions: boolean; isTrialActive: boolean; trialDaysLeft: number; tier: string; hasUsedTrial: boolean; }
function isPremium(h: Hunt) { return h.isVerified || !!h.tenantName; }

/* ─── rich mission card ─── */
function MissionCard({ hunt, done, locked, profile, index }: {
  hunt: Hunt; done: boolean; locked: boolean;
  profile: ImpactProfile | null; index: number;
}) {
  const cash    = estimateCashReward(hunt.cashReward, hunt.difficulty, hunt.missionType);
  const xp      = estimateXP(hunt.xpReward, hunt.difficulty, hunt.steps.length);
  const diff    = DIFF_META[hunt.difficulty] ?? DIFF_META.easy;
  const cat     = resolveCategory(hunt.tags, hunt.category);
  const mtype   = hunt.missionType ? MISSION_TYPE_META[hunt.missionType] : null;
  const orgType = hunt.organizationType ? ORG_TYPE_META[hunt.organizationType] : null;
  const dlLabel = deadlineLabel(hunt.deadline);
  const spLabel = spotsLabel(hunt.spotsRemaining, hunt.spotsTotal);
  const ms      = matchScore(hunt, profile);
  const msColor = ms == null ? DIM : ms >= 80 ? ACCENT : ms >= 65 ? WARN : DIM;
  const [imgFailed, setImgFailed] = useState(false);
  const thumbImg = getMissionImage(hunt.tags);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.055, duration: 0.28 }}
      className="liquid-glass"
      style={{ borderRadius: 22, overflow: 'hidden', opacity: locked ? 0.78 : 1, position: 'relative',
        background: done ? 'rgba(255,255,255,.025)' : CARD,
        border: `1px solid ${done ? 'rgba(255,255,255,.06)' : cat.color + '22'}`,
        boxShadow: done ? 'none' : `0 0 40px ${cat.color}08` }}>

      {/* ── thumbnail banner ── */}
      <div style={{ position: 'relative', height: 120, overflow: 'hidden', background: '#030A18' }}>
        {!imgFailed && (
          <Image src={thumbImg} alt="" fill style={{ objectFit: 'cover', objectPosition: 'center', opacity: done ? 0.3 : locked ? 0.4 : 0.78 }}
            onError={() => setImgFailed(true)} unoptimized />
        )}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg,transparent 0%,rgba(10,18,38,.9) 100%)' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: done ? 'rgba(255,255,255,.08)' : `linear-gradient(90deg,${cat.color},${cat.color}00)` }} />
        {/* status badge */}
        {done && (
          <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(5,8,22,.88)', border: `1px solid ${ACCENT}40`, borderRadius: 999, padding: '3px 9px' }}>
            <CheckCircle2 size={9} strokeWidth={2.5} style={{ color: ACCENT }} /><span style={{ fontSize: 9.5, fontWeight: 700, color: ACCENT }}>Completed</span>
          </div>
        )}
        {locked && (
          <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(5,8,22,.88)', border: `1px solid ${AI_CLR}40`, borderRadius: 999, padding: '3px 9px' }}>
            <Sparkles size={9} strokeWidth={2.5} style={{ color: AI_CLR }} /><span style={{ fontSize: 9.5, fontWeight: 700, color: AI_CLR }}>Premium</span>
          </div>
        )}
        {ms != null && !done && !locked && (
          <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(5,8,22,.88)', border: `1px solid ${msColor}40`, borderRadius: 999, padding: '3px 9px' }}>
            <TrendingUp size={9} strokeWidth={2.5} style={{ color: msColor }} /><span style={{ fontSize: 9.5, fontWeight: 800, color: msColor }}>{ms}% match</span>
          </div>
        )}
      </div>

      <div style={{ padding: '14px 16px 0' }}>

        {/* row 1 — type + org + status badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {done && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9.5, fontWeight: 700, color: ACCENT, background: `${ACCENT}10`, border: `1px solid ${ACCENT}20`, padding: '2px 8px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '.04em' }}>
              <CheckCircle2 size={9} strokeWidth={2.5} /> Completed
            </div>
          )}
          {locked && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9.5, fontWeight: 700, color: AI_CLR, background: `${AI_CLR}10`, border: `1px solid ${AI_CLR}20`, padding: '2px 8px', borderRadius: 999, textTransform: 'uppercase', letterSpacing: '.04em' }}>
              <Sparkles size={9} strokeWidth={2.5} /> Premium
            </div>
          )}
          {mtype && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9.5, fontWeight: 700, color: mtype.color, background: `${mtype.color}10`, border: `1px solid ${mtype.color}20`, padding: '2px 8px', borderRadius: 999 }}>
              <span style={{ fontSize: 10 }}>{mtype.emoji}</span> {mtype.label}
            </div>
          )}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9.5, fontWeight: 700, color: cat.color, background: `${cat.color}10`, border: `1px solid ${cat.color}20`, padding: '2px 8px', borderRadius: 999 }}>
            <span style={{ fontSize: 10 }}>{cat.emoji}</span> {cat.label}
          </div>
        </div>

        {/* row 2 — icon + title + match */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, flexShrink: 0, background: locked ? 'rgba(255,255,255,.04)' : `${cat.color}14`, border: `1px solid ${locked ? 'rgba(255,255,255,.06)' : cat.color + '22'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
            {locked ? <Lock size={18} style={{ color: FAINT }} strokeWidth={2} /> : cat.emoji}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: '0 0 3px', fontSize: 15, fontWeight: 800, color: done ? DIM : TXT, lineHeight: 1.25, letterSpacing: '-.01em' }}>{hunt.title}</h3>
            {/* org + verified */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              {orgType && <span style={{ fontSize: 10 }}>{orgType.emoji}</span>}
              <span style={{ fontSize: 11, color: FAINT, fontWeight: 500 }}>{hunt.tenantName ?? 'X-Hunt Community'}</span>
              {hunt.isVerified && <ShieldCheck size={10} strokeWidth={2.5} style={{ color: ACCENT }} />}
            </div>
          </div>
        </div>

        {/* description excerpt */}
        <p style={{ margin: '0 0 10px', fontSize: 12.5, color: DIM, lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {hunt.story_context}
        </p>

        {/* skills/tags */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
          {(hunt.requiredSkills ?? hunt.tags).slice(0, 4).map((tag) => (
            <span key={tag} style={{ fontSize: 10, color: DIM, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', padding: '2px 9px', borderRadius: 999 }}>{tag}</span>
          ))}
        </div>

        {/* SDG pills */}
        {(hunt.sdgGoals?.length ?? 0) > 0 && (
          <div style={{ display: 'flex', gap: 5, marginBottom: 10 }}>
            {(hunt.sdgGoals ?? []).slice(0, 3).map((g) => {
              const meta = SDG_META[g as keyof typeof SDG_META];
              return meta ? (
                <div key={g} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: `${meta.color}14`, border: `1px solid ${meta.color}22`, borderRadius: 8, padding: '2px 7px' }}>
                  <span style={{ fontSize: 10 }}>{meta.emoji}</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: meta.color }}>SDG {g}</span>
                </div>
              ) : null;
            })}
          </div>
        )}

        {/* econometrics bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,.06)', marginBottom: 12 }}>
          {/* cash */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <DollarSign size={12} strokeWidth={2} style={{ color: ACCENT }} />
            <span style={{ fontSize: 13.5, fontWeight: 900, color: done ? FAINT : ACCENT, letterSpacing: '-.02em' }}>${cash}</span>
          </div>
          <div style={{ width: 3, height: 3, borderRadius: '50%', background: FAINT }} />
          {/* xp */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Star size={11} strokeWidth={2} style={{ color: AI_CLR }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: done ? FAINT : AI_CLR }}>+{xp} XP</span>
          </div>
          {/* cert */}
          {hunt.certificationReward && (
            <>
              <div style={{ width: 3, height: 3, borderRadius: '50%', background: FAINT }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Award size={11} strokeWidth={2} style={{ color: WARN }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: WARN }}>Cert</span>
              </div>
            </>
          )}
          {/* time */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
            <Clock size={11} strokeWidth={2} style={{ color: FAINT }} />
            <span style={{ fontSize: 11, color: DIM }}>{hunt.estimated_time}</span>
          </div>
        </div>

        {/* urgency + location row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: `${diff.color}10`, border: `1px solid ${diff.color}20` }}>
            <Zap size={9} strokeWidth={2.5} style={{ color: diff.color }} />
            <span style={{ fontSize: 9.5, fontWeight: 700, color: diff.color }}>{diff.label}</span>
          </div>
          {hunt.locationType && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <MapPin size={10} strokeWidth={2} style={{ color: FAINT }} />
              <span style={{ fontSize: 10, color: FAINT, textTransform: 'capitalize' }}>{hunt.locationType}</span>
            </div>
          )}
          {dlLabel && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={10} strokeWidth={2} style={{ color: dlLabel.color }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: dlLabel.color }}>{dlLabel.label}</span>
            </div>
          )}
          {spLabel && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' }}>
              <Users size={10} strokeWidth={2} style={{ color: spLabel.color }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: spLabel.color }}>{spLabel.label}</span>
            </div>
          )}
        </div>
      </div>

      {/* CTA */}
      <div style={{ padding: '0 16px 16px' }}>
        {done ? (
          <Link href="/profile" style={{ height: 44, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: `${ACCENT}06`, border: `1px solid ${ACCENT}14`, textDecoration: 'none' }}>
            <CheckCircle2 size={14} strokeWidth={2.5} style={{ color: ACCENT }} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: ACCENT }}>Completed · View Portfolio</span>
          </Link>
        ) : locked ? (
          <Link href="/upgrade" style={{ height: 44, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: `${AI_CLR}0A`, border: `1px solid ${AI_CLR}22`, color: AI_CLR, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
            <Sparkles size={13} strokeWidth={2.5} /> Unlock with Trial
          </Link>
        ) : (
          <Link href={`/missions/${hunt.id}`} style={{ height: 44, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: ACCENT, boxShadow: `0 0 24px ${ACCENT}30`, color: BG, fontSize: 13.5, fontWeight: 900, textDecoration: 'none' }}>
            <Target size={14} strokeWidth={2.5} /> Start Mission
          </Link>
        )}
      </div>
    </motion.div>
  );
}

/* ─── page ─── */
export default function MissionsPage() {
  const router = useRouter();
  const [hunts, setHunts]         = useState<Hunt[]>([]);
  const [completedIds, setIds]    = useState<string[]>([]);
  const [streak, setStreak]       = useState(0);
  const [tab, setTab]             = useState<Tab>('All');
  const [mounted, setMounted]     = useState(false);
  const [subStatus, setSub]       = useState<SubStatus | null>(null);
  const [profile, setProfile]     = useState<ImpactProfile | null>(null);

  useEffect(() => {
    const state = loadState();
    // PREVIEW MODE: onboarding gate bypassed — re-enable before production launch
    // if (!state.user?.onboardingComplete) { router.replace('/'); return; }
    setIds(state.completedHunts.map((h) => h.huntId));
    setStreak(state.streak);
    setHunts(state.hunts);
    setProfile(loadProfile());
    setMounted(true);
    void fetch('/api/subscription/status').then((r) => r.json())
      .then((d: SubStatus) => setSub(d))
      .catch(() => setSub({ canAccessPremiumMissions: false, isTrialActive: false, trialDaysLeft: 0, tier: 'free', hasUsedTrial: false }));
    void fetchSupabaseMissions().then((r) => {
      if (r?.length) { setHunts(r); const s = loadState(); saveState({ ...s, hunts: r }); }
    });
  }, [router]);

  if (!mounted) return null;

  const canPremium   = true; // PREVIEW MODE: unlocked — re-enable subscription check before production
  const activeHunts  = hunts.filter((h) => !completedIds.includes(h.id));
  const doneHunts    = hunts.filter((h) =>  completedIds.includes(h.id));
  const filtered     = tab === 'Active' ? activeHunts : tab === 'Completed' ? doneHunts : tab === 'Applied' ? [] : hunts;

  /* aggregate econometrics */
  const totalCashAvailable = activeHunts.reduce((acc, h) => acc + estimateCashReward(h.cashReward, h.difficulty, h.missionType), 0);
  const totalXPAvailable   = activeHunts.reduce((acc, h) => acc + estimateXP(h.xpReward, h.difficulty, h.steps.length), 0);
  const totalEarned        = doneHunts.reduce((acc, h) => acc + estimateCashReward(h.cashReward, h.difficulty, h.missionType), 0);

  function handleClick(hunt: Hunt) {
    const locked = isPremium(hunt) && !canPremium && !completedIds.includes(hunt.id);
    router.push(locked ? '/upgrade' : `/hunt/${hunt.id}`);
  }

  return (
    <div className="consumer-app" style={{ minHeight: '100vh', paddingBottom: 100, background: BG, color: TXT }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* ── HEADER ── */}
        <div style={{ padding: '56px 20px 0' }}>

          {/* trial banners */}
          {subStatus?.isTrialActive && subStatus.trialDaysLeft <= 3 && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              style={{ borderRadius: 14, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, background: `${WARN}0A`, border: `1px solid ${WARN}22` }}>
              <span>⏳</span>
              <p style={{ margin: 0, fontSize: 12, color: WARN, fontWeight: 600 }}>Trial ends in {subStatus.trialDaysLeft} day{subStatus.trialDaysLeft !== 1 ? 's' : ''}</p>
              <button onClick={() => router.push('/upgrade')} style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: WARN, background: `${WARN}18`, border: 'none', padding: '4px 10px', borderRadius: 999, cursor: 'pointer' }}>Upgrade</button>
            </motion.div>
          )}
          {subStatus && !subStatus.canAccessPremiumMissions && !subStatus.hasUsedTrial && (
            <motion.button initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} onClick={() => router.push('/upgrade')}
              style={{ width: '100%', borderRadius: 14, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10, background: `${AI_CLR}0A`, border: `1px solid ${AI_CLR}22`, cursor: 'pointer', textAlign: 'left' }}>
              <Sparkles size={15} style={{ color: AI_CLR }} strokeWidth={2} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: AI_CLR }}>Unlock AI + Premium Missions</p>
                <p style={{ margin: 0, fontSize: 11, color: FAINT }}>Start your free 14-day trial</p>
              </div>
              <ChevronRight size={14} style={{ color: AI_CLR }} strokeWidth={2} />
            </motion.button>
          )}

          {/* title row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <span style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: FAINT, marginBottom: 4 }}>Mission Marketplace</span>
              <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, letterSpacing: '-.03em', color: TXT }}>Missions</h1>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {streak > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 999, background: `${WARN}12`, border: `1px solid ${WARN}22` }}>
                  <span style={{ fontSize: 13 }}>🔥</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: WARN }}>{streak}</span>
                </div>
              )}
              <button style={{ width: 40, height: 40, borderRadius: 12, border: '1px solid rgba(255,255,255,.08)', background: 'rgba(255,255,255,.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <Bell size={17} strokeWidth={1.8} style={{ color: DIM }} />
              </button>
            </div>
          </div>

          {/* ── ECONOMETRICS PANEL ── */}
          <div style={{ borderRadius: 22, padding: '16px 18px', marginBottom: 18, background: `linear-gradient(135deg, ${ACCENT}07, ${AI_CLR}05)`, border: `1px solid ${ACCENT}15` }}>
            <p style={{ margin: '0 0 12px', fontSize: 10, fontWeight: 700, color: FAINT, textTransform: 'uppercase', letterSpacing: '.08em' }}>
              Your Economic Opportunity
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              {[
                { label: 'Available',  value: `$${totalCashAvailable}`, sub: `${activeHunts.length} missions`, icon: DollarSign, color: ACCENT },
                { label: 'Earned',     value: `$${totalEarned}`,        sub: `${doneHunts.length} completed`,  icon: TrendingUp,  color: AI_CLR },
                { label: 'Total XP',   value: `+${totalXPAvailable}`,   sub: 'XP available',                   icon: Star,        color: WARN   },
              ].map(({ label, value, sub, icon: Icon, color }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <Icon size={13} strokeWidth={2} style={{ color, marginBottom: 4 }} />
                  <div style={{ fontSize: 17, fontWeight: 900, color, letterSpacing: '-.02em', lineHeight: 1 }}>{value}</div>
                  <div style={{ fontSize: 9.5, color: FAINT, marginTop: 3 }}>{sub}</div>
                </div>
              ))}
            </div>
            {profile && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Brain size={12} strokeWidth={2} style={{ color: AI_CLR }} />
                <span style={{ fontSize: 11, color: DIM }}>
                  AI matching against your <span style={{ color: TXT, fontWeight: 700 }}>{profile.archetype}</span> Impact DNA
                </span>
              </div>
            )}
          </div>

          {/* impact stat chips */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 18 }}>
            {[
              { label: 'Total',   value: hunts.length,        color: TXT    },
              { label: 'Active',  value: activeHunts.length,  color: ACCENT },
              { label: 'Done',    value: doneHunts.length,    color: ACCENT },
            ].map((s) => (
              <div key={s.label} className="liquid-glass" style={{ ...XGLASS, borderRadius: 14, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: s.color, letterSpacing: '-.02em' }}>{s.value}</div>
                <div style={{ fontSize: 9.5, fontWeight: 600, color: FAINT, marginTop: 2, textTransform: 'uppercase', letterSpacing: '.06em' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* tabs */}
          <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 999, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', marginBottom: 20 }}>
            {TABS.map((t) => {
              const active = tab === t;
              return (
                <button key={t} onClick={() => setTab(t)} style={{ flex: 1, height: 38, borderRadius: 999, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, letterSpacing: '-.01em', transition: 'all .18s', ...(active ? { background: ACCENT, boxShadow: `0 0 20px ${ACCENT}35`, color: BG } : { background: 'transparent', color: DIM }) }}>
                  {t}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── MISSION LIST ── */}
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {filtered.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 0', textAlign: 'center' }}>
              <Target size={44} strokeWidth={1.2} style={{ color: FAINT, marginBottom: 16 }} />
              <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: TXT }}>
                {tab === 'Completed' ? 'Nothing completed yet'
                  : tab === 'Applied' ? 'No applications yet'
                  : 'No missions here'}
              </p>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: DIM }}>
                {tab === 'Completed' ? 'Finish a mission to see it here.'
                  : tab === 'Applied' ? 'Apply to a mission to track it.'
                  : 'Check back soon for new opportunities.'}
              </p>
            </div>
          ) : (
            <AnimatePresence>
              {filtered.map((hunt, i) => {
                const done   = completedIds.includes(hunt.id);
                const locked = isPremium(hunt) && !canPremium && !done;
                return (
                  <div key={hunt.id} onClick={() => handleClick(hunt)} style={{ cursor: 'pointer' }}>
                    <MissionCard hunt={hunt} done={done} locked={locked} profile={profile} index={i} />
                  </div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
