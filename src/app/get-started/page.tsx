'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, ArrowRight, Sparkles, Brain, Shield, Lock } from 'lucide-react';
import { saveState, loadState, saveProfile } from '@/lib/store';
import { createClient } from '@/lib/supabase/client';
import type { ImpactProfile } from '@/lib/types';

/* ─── design tokens ─── */
const BG     = '#050816';
const CARD   = '#0A1226';
const SURF   = '#07101F';
const ACCENT = '#22FFAA';
const AI_CLR = '#6D5DFD';
const TXT    = '#F0F4FF';
const DIM    = '#8B9CC0';
const FAINT  = '#4A5578';

const MAX_USER_MESSAGES = 8;

interface Message { role: 'assistant' | 'user'; content: string }

const XENO_INTRO = "Hey! 👋 I'm Xeno — your X-Hunt AI guide. Before I match you with the right missions and opportunities, I'd love to get to know you a little. What gets you genuinely excited in life? Could be work, a hobby, a cause — anything at all.";

// Context-aware quick replies for each question stage (0–5)
const STAGE_REPLIES: Record<number, string[]> = {
  0: ['Fitness & health 💪', 'Design & creativity 🎨', 'Tech & AI 💻', 'Social impact 🌍', 'Teaching & mentoring 📚', 'Business & finance 📊'],
  1: ['UX / Product design', 'Software development', 'Writing & storytelling', 'Community building', 'Research & analysis', 'Marketing & growth'],
  2: ['Climate & environment 🌱', 'Education & learning', 'Health & wellness', 'Economic equality', 'Tech for good', 'Community development'],
  3: ['Solo deep work 🧘', 'Team collaboration 🤝', 'Mix of both', 'Short quick tasks', 'Long-form projects', 'Flexible — depends'],
  4: ['2–5 hrs/week', '5–10 hrs/week', '10–20 hrs/week', 'Full-time focus', 'Flexible / varies'],
  5: ['More income 💰', 'New skills 📚', 'Real-world impact 🌍', 'Build reputation 🏆', 'Purpose & meaning ✨'],
};

// Labels for each question stage shown in the progress header
const STAGE_LABELS = [
  'Passions',
  'Skills',
  'Causes',
  'Work Style',
  'Availability',
  'Goals',
];

const ARCHETYPE_COLORS: Record<string, string> = {
  Explorer: ACCENT, Builder: '#6D5DFD', Innovator: '#a78bfa',
  Mentor: '#FFB84D', Creator: '#FF5C7A', Analyst: '#60A5FA', Activist: ACCENT,
};

/* ─── StrengthBar ─── */
function StrengthBar({ name, score, color, delay }: { name: string; score: number; color: string; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay, duration: 0.4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: DIM, fontWeight: 600 }}>{name}</span>
        <span style={{ fontSize: 12, color, fontWeight: 800 }}>{score}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,.06)', overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }} animate={{ width: `${score}%` }}
          transition={{ delay: delay + 0.2, duration: 0.7, ease: 'easeOut' }}
          style={{ height: '100%', borderRadius: 3, background: `linear-gradient(90deg, ${color}99, ${color})` }}
        />
      </div>
    </motion.div>
  );
}

/* ─── ImpactDNAReveal ─── */
function ImpactDNAReveal({ profile, onContinue }: { profile: ImpactProfile; onContinue: () => void }) {
  const archetypeColor = ARCHETYPE_COLORS[profile.archetype] ?? ACCENT;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      style={{ maxWidth: 420, margin: '0 auto', padding: '0 20px 40px' }}>

      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 280, damping: 18 }}
          style={{ width: 72, height: 72, borderRadius: '50%', background: `linear-gradient(135deg, ${archetypeColor}20, ${AI_CLR}20)`,
            border: `2px solid ${archetypeColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', boxShadow: `0 0 40px ${archetypeColor}25` }}>
          <Brain size={30} style={{ color: archetypeColor }} strokeWidth={1.5} />
        </motion.div>
        <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          style={{ fontSize: 11, fontWeight: 700, color: FAINT, textTransform: 'uppercase', letterSpacing: '.1em', margin: '0 0 6px' }}>
          Your Impact DNA
        </motion.p>
        <motion.h2 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          style={{ fontSize: 28, fontWeight: 900, color: archetypeColor, margin: '0 0 4px', letterSpacing: '-.02em' }}>
          {profile.archetype}
        </motion.h2>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.32 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <div style={{ height: 3, width: 32, borderRadius: 2, background: `linear-gradient(90deg, transparent, ${archetypeColor})` }} />
          <span style={{ fontSize: 11, color: FAINT }}>Impact Score</span>
          <span style={{ fontSize: 14, fontWeight: 900, color: archetypeColor }}>{profile.impactScore}</span>
          <div style={{ height: 3, width: 32, borderRadius: 2, background: `linear-gradient(90deg, ${archetypeColor}, transparent)` }} />
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
        style={{ background: CARD, border: `1px solid ${archetypeColor}18`, borderRadius: 18, padding: '18px 20px', marginBottom: 14 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: FAINT, textTransform: 'uppercase', letterSpacing: '.09em', margin: '0 0 14px' }}>Strengths</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {profile.strengths.slice(0, 5).map((s, i) => (
            <StrengthBar key={s.name} name={s.name} score={s.score} color={archetypeColor} delay={0.35 + i * 0.07} />
          ))}
        </div>
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
        {[
          { label: 'Causes', items: profile.causes, color: ACCENT },
          { label: 'Motivations', items: profile.motivations, color: AI_CLR },
        ].map(({ label, items, color }, gi) => (
          <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 + gi * 0.07 }}
            style={{ background: CARD, border: '1px solid rgba(255,255,255,.06)', borderRadius: 16, padding: '14px 16px' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: FAINT, textTransform: 'uppercase', letterSpacing: '.09em', margin: '0 0 10px' }}>{label}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {items.map((item) => (
                <span key={item} style={{ fontSize: 10, fontWeight: 700, color, background: `${color}12`, border: `1px solid ${color}20`, borderRadius: 999, padding: '3px 9px' }}>
                  {item}
                </span>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.68 }}
        style={{ background: CARD, border: '1px solid rgba(255,255,255,.06)', borderRadius: 16, padding: '14px 16px', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 24 }}>
          {[
            { label: 'Personality', items: profile.personality, color: '#a78bfa' },
            { label: 'Growth Areas', items: profile.growthAreas, color: '#FFB84D' },
          ].map(({ label, items, color }) => (
            <div key={label} style={{ flex: 1 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: FAINT, textTransform: 'uppercase', letterSpacing: '.09em', margin: '0 0 8px' }}>{label}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {items.map((item) => (
                  <span key={item} style={{ fontSize: 11, color, fontWeight: 600 }}>· {item}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.74 }}
        style={{ display: 'flex', alignItems: 'center', gap: 10, background: `${ACCENT}08`, border: `1px solid ${ACCENT}18`, borderRadius: 14, padding: '12px 16px', marginBottom: 14 }}>
        <Sparkles size={15} style={{ color: ACCENT, flexShrink: 0 }} strokeWidth={2} />
        <span style={{ fontSize: 12, color: DIM }}>
          <strong style={{ color: TXT }}>Available</strong> {profile.availability} · AI will match missions to your window
        </span>
      </motion.div>

      {/* E2E encryption indicator */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.78 }}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', marginBottom: 20,
          background: 'rgba(109,93,253,0.06)', border: '1px solid rgba(109,93,253,0.15)', borderRadius: 12 }}>
        <Lock size={12} style={{ color: AI_CLR, flexShrink: 0 }} />
        <span style={{ fontSize: 11, color: DIM }}>Your profile and all messages are <strong style={{ color: '#a78bfa' }}>end-to-end encrypted</strong></span>
      </motion.div>

      <motion.button
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.82 }}
        onClick={onContinue}
        style={{ width: '100%', height: 52, background: ACCENT, color: BG, borderRadius: 16, border: 'none', fontWeight: 900,
          fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: `0 0 28px ${ACCENT}35`, fontFamily: 'inherit', letterSpacing: '-.01em' }}>
        Start Hunting <ArrowRight size={17} strokeWidth={2.8} />
      </motion.button>

      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.92 }}
        style={{ textAlign: 'center', fontSize: 11, color: FAINT, marginTop: 12 }}>
        Your Impact DNA updates with every mission you complete.
      </motion.p>
    </motion.div>
  );
}

/* ─── Main page ─── */
export default function GetStartedPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [userId, setUserId]           = useState<string | null>(null);
  const [messages, setMessages]       = useState<Message[]>([]);
  const [input, setInput]             = useState('');
  const [isTyping, setIsTyping]       = useState(false);
  const [phase, setPhase]             = useState<'chat' | 'analyzing' | 'complete'>('chat');
  const [userMsgCount, setUserMsgCount] = useState(0);
  const [profile, setProfile]         = useState<ImpactProfile | null>(null);
  const [analyzeStep, setAnalyzeStep] = useState(0);
  const [rateLimited, setRateLimited] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLInputElement>(null);

  // ── Auth guard ─────────────────────────────────────────────────────────
  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/sign-up?next=/get-started');
        return;
      }
      setUserId(user.id);

      // Check if already onboarded (localStorage fast-path)
      const state = loadState();
      if (state.user?.onboardingComplete) {
        router.replace('/home');
        return;
      }

      // Also check DB in case localStorage was cleared
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('onboarding_complete')
        .eq('id', user.id)
        .single();

      if (profile?.onboarding_complete) {
        router.replace('/home');
        return;
      }

      setAuthChecked(true);
    }
    checkAuth();
  }, [router]);

  // Seed Xeno's opening message
  useEffect(() => {
    if (!authChecked) return;
    setMessages([{ role: 'assistant', content: XENO_INTRO }]);
    setTimeout(() => inputRef.current?.focus(), 600);
  }, [authChecked]);

  // Auto-scroll
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Analysis animation stepper
  useEffect(() => {
    if (phase !== 'analyzing') return;
    let i = 0;
    const t = setInterval(() => { i++; setAnalyzeStep(i); if (i >= 3) clearInterval(t); }, 900);
    return () => clearInterval(t);
  }, [phase]);

  async function fetchXenoReply(history: Message[]) {
    setIsTyping(true);
    try {
      const res = await fetch('/api/ai/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, mode: 'chat', userId }),
      });

      if (res.status === 429) {
        setRateLimited(true);
        setIsTyping(false);
        return;
      }

      const data = await res.json() as { message?: string };
      const reply = data.message ?? "Tell me more — what else excites you?";
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);

      if (reply.includes('Impact DNA') && reply.includes('moment')) {
        setTimeout(() => beginExtraction([...history, { role: 'assistant', content: reply }]), 1200);
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: "Can you tell me a bit more about what excites you?" }]);
    }
    setIsTyping(false);
  }

  async function beginExtraction(history: Message[]) {
    setPhase('analyzing');
    try {
      const res = await fetch('/api/ai/onboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history, mode: 'extract', userId }),
      });
      const data = await res.json() as { profile?: ImpactProfile };
      if (data.profile) {
        saveProfile(data.profile);
        const state = loadState();
        saveState({
          ...state,
          user: {
            interests: data.profile.causes,
            goals: data.profile.motivations,
            onboardingComplete: true,
          },
        });

        // Persist to Supabase so auth-based routing works on any device
        if (userId) {
          await fetch('/api/auth/me', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              interests:           data.profile.causes,
              goals:               data.profile.motivations,
              onboarding_complete: true,
            }),
          }).catch(() => {});
        }

        setTimeout(() => { setProfile(data.profile!); setPhase('complete'); }, 2800);
      }
    } catch {
      setTimeout(() => router.push('/home'), 2000);
    }
  }

  async function handleSend(text?: string) {
    const content = (text ?? input).trim();
    if (!content || isTyping || phase !== 'chat') return;
    if (userMsgCount >= MAX_USER_MESSAGES) {
      // Auto-extract once limit is reached
      beginExtraction([...messages, { role: 'user', content }]);
      return;
    }
    setInput('');
    const newHistory: Message[] = [...messages, { role: 'user', content }];
    setMessages(newHistory);
    const newCount = userMsgCount + 1;
    setUserMsgCount(newCount);
    // Auto-extract after 6 questions
    if (newCount >= 6) {
      setTimeout(() => beginExtraction(newHistory), 1000);
    } else {
      fetchXenoReply(newHistory);
    }
  }

  const currentStage   = Math.min(userMsgCount, 5);
  const quickReplies   = phase === 'chat' && !isTyping && userMsgCount < 6
    ? (STAGE_REPLIES[currentStage] ?? [])
    : [];
  const progressPct    = Math.min(100, Math.round((userMsgCount / 6) * 100));
  const stageLabel     = STAGE_LABELS[currentStage] ?? '';

  // Loading until auth check completes
  if (!authChecked) {
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 24, height: 24, border: `2px solid ${FAINT}`, borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  /* ─── analyzing ─── */
  if (phase === 'analyzing') {
    const steps = ['Reading your story…', 'Mapping your skills & strengths…', 'Matching your causes…', 'Building your Impact DNA…'];
    return (
      <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            style={{ width: 72, height: 72, borderRadius: '50%', background: `conic-gradient(${ACCENT}, ${AI_CLR}, ${ACCENT})`, margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Brain size={24} style={{ color: ACCENT }} strokeWidth={1.5} />
            </div>
          </motion.div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: TXT, margin: '0 0 6px', letterSpacing: '-.02em' }}>Building your Impact DNA</h2>
          <p style={{ fontSize: 13, color: DIM, margin: '0 0 28px' }}>Xeno is analysing your conversation…</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {steps.map((step, i) => (
              <motion.div key={step}
                initial={{ opacity: 0, x: -12 }} animate={{ opacity: analyzeStep >= i ? 1 : 0.2, x: 0 }}
                transition={{ delay: i * 0.1, duration: 0.3 }}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12,
                  background: analyzeStep >= i ? `${ACCENT}08` : 'rgba(255,255,255,.02)',
                  border: `1px solid ${analyzeStep >= i ? `${ACCENT}20` : 'rgba(255,255,255,.04)'}` }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: analyzeStep >= i ? ACCENT : FAINT, boxShadow: analyzeStep >= i ? `0 0 8px ${ACCENT}` : 'none' }} />
                <span style={{ fontSize: 12, color: analyzeStep >= i ? TXT : FAINT, fontWeight: 600 }}>{step}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ─── complete / DNA reveal ─── */
  if (phase === 'complete' && profile) {
    return (
      <div style={{ minHeight: '100vh', background: BG, color: TXT, paddingTop: 40 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Image src="/xhunt-logo.png" alt="X-Hunt" width={160} height={120} style={{ height: 30, width: 'auto', objectFit: 'contain' }} />
        </div>
        <ImpactDNAReveal profile={profile} onContinue={() => router.push('/home')} />
      </div>
    );
  }

  /* ─── chat screen ─── */
  return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column', maxWidth: 520, margin: '0 auto' }}>

      {/* Top bar */}
      <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <Image src="/xhunt-logo.png" alt="X-Hunt" width={160} height={120} style={{ height: 26, width: 'auto', objectFit: 'contain' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: `${ACCENT}08`, border: `1px solid ${ACCENT}18`, borderRadius: 999, padding: '4px 12px' }}>
          <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.8, repeat: Infinity }}
            style={{ width: 5, height: 5, borderRadius: '50%', background: ACCENT }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: ACCENT, letterSpacing: '.08em', textTransform: 'uppercase' }}>Xeno AI</span>
        </div>
      </div>

      {/* Progress section */}
      <div style={{ margin: '14px 20px 0' }}>
        {/* Stage labels */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: DIM }}>
            {userMsgCount < 6 ? `Question ${userMsgCount + 1} of 6 · ${stageLabel}` : 'Analysing…'}
          </span>
          <span style={{ fontSize: 10, color: FAINT }}>{progressPct}%</span>
        </div>

        {/* Step dots */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 8 }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 3,
              background: i < userMsgCount ? ACCENT : i === userMsgCount ? `${ACCENT}55` : 'rgba(255,255,255,0.07)',
              transition: 'background 0.35s',
              boxShadow: i < userMsgCount ? `0 0 6px ${ACCENT}60` : 'none',
            }} />
          ))}
        </div>

        {/* Thin gradient progress bar */}
        <div style={{ height: 2, borderRadius: 2, background: 'rgba(255,255,255,.04)', overflow: 'hidden' }}>
          <motion.div animate={{ width: `${progressPct}%` }} transition={{ duration: 0.4 }}
            style={{ height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${ACCENT}, ${AI_CLR})`, boxShadow: `0 0 8px ${ACCENT}50` }} />
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '18px 16px 6px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div key={i}
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.3 }}
              style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 10 }}>
              {msg.role === 'assistant' && (
                <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, marginBottom: 2,
                  background: `linear-gradient(135deg, ${ACCENT}30, ${AI_CLR}30)`,
                  border: `1px solid ${ACCENT}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Brain size={14} style={{ color: ACCENT }} strokeWidth={1.8} />
                </div>
              )}
              <div style={{
                maxWidth: '78%',
                padding: msg.role === 'assistant' ? '12px 15px' : '10px 15px',
                borderRadius: msg.role === 'assistant' ? '4px 18px 18px 18px' : '18px 4px 18px 18px',
                background: msg.role === 'assistant' ? SURF : `linear-gradient(135deg, ${ACCENT}18, ${AI_CLR}12)`,
                border: msg.role === 'assistant' ? '1px solid rgba(255,255,255,.07)' : `1px solid ${ACCENT}25`,
                fontSize: 13.5, lineHeight: 1.6, color: TXT,
                fontWeight: msg.role === 'user' ? 500 : 400,
              }}>
                {msg.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {isTyping && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
              background: `linear-gradient(135deg, ${ACCENT}30, ${AI_CLR}30)`,
              border: `1px solid ${ACCENT}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Brain size={14} style={{ color: ACCENT }} strokeWidth={1.8} />
            </div>
            <div style={{ padding: '12px 16px', borderRadius: '4px 18px 18px 18px', background: SURF, border: '1px solid rgba(255,255,255,.07)' }}>
              <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                {[0, 1, 2].map((i) => (
                  <motion.div key={i}
                    animate={{ y: [0, -5, 0] }} transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }}
                    style={{ width: 5, height: 5, borderRadius: '50%', background: ACCENT, opacity: 0.6 }} />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Rate limited message */}
        {rateLimited && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            style={{ padding: '12px 16px', borderRadius: 14, background: 'rgba(255,184,77,0.08)', border: '1px solid rgba(255,184,77,0.2)', fontSize: 13, color: '#FFB84D' }}>
            You&apos;ve reached the conversation limit. Click &quot;Generate my profile&quot; to continue.
          </motion.div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Quick replies (next best actions) */}
      {quickReplies.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          style={{ padding: '4px 16px 6px', display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {quickReplies.map((r) => (
            <button key={r} onClick={() => handleSend(r)}
              style={{
                fontSize: 11, fontWeight: 700, color: ACCENT, background: `${ACCENT}0A`,
                border: `1px solid ${ACCENT}22`, borderRadius: 999, padding: '6px 12px',
                cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                transition: 'all .15s',
              }}>
              {r}
            </button>
          ))}
        </motion.div>
      )}

      {/* Generate profile button (after 5 messages) */}
      {userMsgCount >= 5 && phase === 'chat' && !isTyping && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          style={{ padding: '6px 16px 4px' }}>
          <button
            onClick={() => beginExtraction(messages)}
            style={{
              width: '100%', height: 40, borderRadius: 12,
              background: `linear-gradient(135deg, ${ACCENT}15, ${AI_CLR}15)`,
              border: `1px solid ${ACCENT}30`,
              color: ACCENT, fontSize: 12, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
            <Brain size={13} strokeWidth={2} />
            Generate my Impact DNA now
          </button>
        </motion.div>
      )}

      {/* Input */}
      <div style={{ padding: '10px 16px 28px', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 10, background: CARD, border: '1px solid rgba(255,255,255,.08)',
          borderRadius: 18, padding: '8px 8px 8px 16px', alignItems: 'center' }}>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={rateLimited ? 'Limit reached — use the button above' : 'Type your answer…'}
            disabled={isTyping || phase !== 'chat' || rateLimited}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: TXT, fontSize: 13.5, fontFamily: 'inherit', caretColor: ACCENT }}
          />
          <button onClick={() => handleSend()} disabled={!input.trim() || isTyping || rateLimited}
            style={{ width: 38, height: 38, borderRadius: 12, border: 'none', flexShrink: 0, transition: 'background .15s',
              background: input.trim() && !isTyping && !rateLimited ? ACCENT : 'rgba(255,255,255,.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: input.trim() && !isTyping && !rateLimited ? 'pointer' : 'not-allowed' }}>
            <Send size={15} style={{ color: input.trim() && !isTyping && !rateLimited ? BG : FAINT }} strokeWidth={2.5} />
          </button>
        </div>

        {/* Encryption indicator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 8 }}>
          <Shield size={9} style={{ color: FAINT }} />
          <p style={{ textAlign: 'center', fontSize: 10, color: FAINT, margin: 0 }}>
            Conversation is end-to-end encrypted
          </p>
        </div>
      </div>
    </div>
  );
}
