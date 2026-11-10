'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, X, Send, Loader2, ArrowRight } from 'lucide-react';
import { PRICING_ENABLED } from '@/lib/pricing';
import { useRouter } from 'next/navigation';

export interface AIHuntContext {
  huntTitle?:       string;
  huntStory?:       string;
  stepInstruction?: string;
  stepType?:        string;
}

interface Props {
  context?: AIHuntContext;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface TierStatus {
  tier: 'free' | 'trial' | 'pro';
  canUseAI: boolean;
  trialDaysLeft: number;
  hasUsedTrial: boolean;
}

const T = {
  bg:     '#0e1719',
  elev:   '#17262a',
  line:   'rgba(255,255,255,.07)',
  txt:    '#e9eff0',
  muted:  '#7d8b8e',
  dim:    '#54625f',
  ai:     '#22d3ee',
  aiBg:   '#001a22',
  aiBord: 'rgba(34,211,238,.2)',
  green:  '#27e07d',
} as const;

const QUICK_PROMPTS = ['Give me a hint', "I'm stuck on this", 'Why does this step matter?'];

export default function AIAssistant({ context }: Props) {
  const router = useRouter();
  const [open, setOpen]               = useState(false);
  const [messages, setMessages]       = useState<Message[]>([]);
  const [input, setInput]             = useState('');
  const [loading, setLoading]         = useState(false);
  const [tierStatus, setTierStatus]   = useState<TierStatus | null>(null);
  const [checking, setChecking]       = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && !tierStatus) {
      setChecking(true);
      fetch('/api/subscription/status')
        .then((r) => r.json())
        .then((d: TierStatus) => setTierStatus(d))
        .catch(() => setTierStatus({ tier: 'free', canUseAI: false, trialDaysLeft: 0, hasUsedTrial: false }))
        .finally(() => setChecking(false));
    }
  }, [open, tierStatus]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setLoading(true);
    try {
      const res = await fetch('/api/ai-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, ...context, mode: 'general' }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'upgrade_required') {
          setTierStatus((p) => p ? { ...p, canUseAI: false } : { tier: 'free', canUseAI: false, trialDaysLeft: 0, hasUsedTrial: true });
          return;
        }
        if (data.error === 'rate_limit_exceeded') {
          setMessages((m) => [...m, { role: 'assistant', content: "You've hit your daily AI limit. It resets at midnight UTC." }]);
          return;
        }
        throw new Error('api-error');
      }
      setMessages((m) => [...m, { role: 'assistant', content: data.reply as string }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', content: "Connection hiccup — try again in a moment." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Trigger */}
      <motion.button
        whileTap={{ scale: 0.94 }}
        onClick={() => setOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 14px', borderRadius: 999,
          background: T.aiBg, border: `1px solid ${T.aiBord}`,
          cursor: 'pointer', boxShadow: '0 2px 12px rgba(34,211,238,.12)',
        }}
      >
        <Sparkles size={13} style={{ color: T.ai }} strokeWidth={2} />
        <span style={{ fontSize: 13, fontWeight: 700, color: T.ai }}>Ask AI</span>
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 50 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              style={{
                position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 51,
                borderRadius: '28px 28px 0 0',
                background: T.bg, borderTop: `1px solid ${T.line}`,
                padding: '20px 20px calc(1.5rem + env(safe-area-inset-bottom,0px))',
                maxHeight: '82vh', display: 'flex', flexDirection: 'column',
              }}
            >
              <div style={{ maxWidth: 430, margin: '0 auto', width: '100%', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                {/* Handle */}
                <div style={{ width: 40, height: 4, borderRadius: 999, background: 'rgba(255,255,255,.1)', margin: '0 auto 18px' }} />

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 11, background: T.aiBg, border: `1px solid ${T.aiBord}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Sparkles size={15} style={{ color: T.ai }} strokeWidth={2} />
                    </div>
                    <div>
                      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: T.txt }}>AI Mission Guide</p>
                      {tierStatus?.tier === 'trial' && tierStatus.trialDaysLeft > 0 && (
                        <p style={{ margin: 0, fontSize: 10.5, color: T.dim }}>{tierStatus.trialDaysLeft}d trial remaining</p>
                      )}
                      {tierStatus?.tier === 'pro' && (
                        <p style={{ margin: 0, fontSize: 10.5, color: T.green }}>Pro</p>
                      )}
                    </div>
                  </div>
                  <button onClick={() => setOpen(false)} style={{ background: 'none', border: 0, cursor: 'pointer', padding: 4 }}>
                    <X size={18} style={{ color: T.dim }} strokeWidth={2} />
                  </button>
                </div>

                {/* Body */}
                {checking ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Loader2 size={24} style={{ color: T.ai }} className="animate-spin" strokeWidth={2} />
                  </div>

                ) : tierStatus && !tierStatus.canUseAI ? (
                  /* ── Upgrade prompt ── */
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 18, padding: '0 8px' }}>
                    <div style={{ width: 68, height: 68, borderRadius: 22, background: 'rgba(34,211,238,.07)', border: `1px solid ${T.aiBord}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Sparkles size={30} style={{ color: T.ai }} strokeWidth={1.5} />
                    </div>
                    <div>
                      <p style={{ margin: '0 0 8px', fontSize: 19, fontWeight: 800, color: T.txt }}>
                        {tierStatus.hasUsedTrial ? 'Upgrade to Pro' : 'Start Free Trial'}
                      </p>
                      <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.6, maxWidth: 270 }}>
                        {tierStatus.hasUsedTrial
                          ? 'Your 14-day trial has ended. Upgrade to Pro for unlimited AI guidance on every mission.'
                          : 'Get 14 days of free AI step hints, mission guidance, and premium verified missions.'}
                      </p>
                    </div>
                    {PRICING_ENABLED ? (
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { setOpen(false); router.push('/upgrade'); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, height: 50,
                        padding: '0 26px', borderRadius: 999, border: 0, cursor: 'pointer',
                        background: 'linear-gradient(180deg,#3ee888,#19c268)',
                        color: '#04130b', fontSize: 14, fontWeight: 700,
                        boxShadow: '0 4px 20px rgba(39,224,125,.35)',
                      }}
                    >
                      {tierStatus.hasUsedTrial ? 'Upgrade to Pro' : 'Start 14-Day Trial'}
                      <ArrowRight size={16} strokeWidth={2.5} />
                    </motion.button>
                    ) : (
                      <p data-testid="ai-pricing-coming-soon" style={{ margin: 0, fontSize: 14, color: T.muted }}>
                        Plans are coming soon.
                      </p>
                    )}
                  </div>

                ) : (
                  /* ── Chat UI ── */
                  <>
                    <div style={{ flex: 1, overflowY: 'auto', marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 }}>
                      {messages.length === 0 && (
                        <div style={{ padding: '10px 0', textAlign: 'center' }}>
                          <p style={{ fontSize: 13, color: T.dim, margin: '0 0 12px' }}>
                            Ask me anything about this {context?.huntTitle ? 'step' : 'mission'}.
                          </p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, justifyContent: 'center' }}>
                            {QUICK_PROMPTS.map((q) => (
                              <button
                                key={q}
                                onClick={() => setInput(q)}
                                style={{
                                  fontSize: 12, fontWeight: 600, color: T.ai,
                                  background: 'rgba(34,211,238,.07)', border: `1px solid rgba(34,211,238,.18)`,
                                  padding: '5px 13px', borderRadius: 999, cursor: 'pointer',
                                }}
                              >
                                {q}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {messages.map((m, i) => (
                        <div
                          key={i}
                          style={{
                            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                            maxWidth: '86%',
                            padding: '10px 14px',
                            borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                            background: m.role === 'user' ? 'rgba(39,224,125,.1)' : T.elev,
                            border: `1px solid ${m.role === 'user' ? 'rgba(39,224,125,.2)' : T.line}`,
                            fontSize: 13, lineHeight: 1.55,
                            color: m.role === 'user' ? T.green : T.txt,
                          }}
                        >
                          {m.content}
                        </div>
                      ))}

                      {loading && (
                        <div style={{ alignSelf: 'flex-start', padding: '10px 14px', borderRadius: '18px 18px 18px 4px', background: T.elev, border: `1px solid ${T.line}`, display: 'flex', gap: 5 }}>
                          {[0, 1, 2].map((i) => (
                            <motion.div
                              key={i}
                              style={{ width: 6, height: 6, borderRadius: '50%', background: T.ai }}
                              animate={{ opacity: [0.3, 1, 0.3] }}
                              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                            />
                          ))}
                        </div>
                      )}
                      <div ref={endRef} />
                    </div>

                    {/* Input row */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }}
                        placeholder="Ask about this step…"
                        style={{
                          flex: 1, height: 44, borderRadius: 999,
                          background: T.elev, border: `1px solid ${T.line}`,
                          padding: '0 16px', fontSize: 13, color: T.txt,
                          outline: 'none', fontFamily: 'var(--font-onest), system-ui',
                        }}
                      />
                      <motion.button
                        whileTap={{ scale: 0.92 }}
                        onClick={() => void send()}
                        disabled={!input.trim() || loading}
                        style={{
                          width: 44, height: 44, borderRadius: '50%', border: `1px solid ${T.line}`,
                          background: input.trim() && !loading ? 'linear-gradient(180deg,#3ee888,#19c268)' : T.elev,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: input.trim() && !loading ? 'pointer' : 'default',
                          transition: 'background 0.2s',
                          flexShrink: 0,
                        }}
                      >
                        <Send size={16} style={{ color: input.trim() && !loading ? '#04130b' : T.dim }} strokeWidth={2.5} />
                      </motion.button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
