'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Brain, Shield, Zap, CheckCircle2, X, Clock, Lock } from 'lucide-react';
import Link from 'next/link';

const BG    = '#050816';
const CARD  = '#0A1226';
const ACCENT = '#22FFAA';
const AI_CLR = '#6D5DFD';
const TXT   = '#F0F4FF';
const DIM   = '#8B9CC0';
const FAINT = '#4A5578';

const STEPS = [
  { icon: CheckCircle2, label: 'Create Account',      desc: '30 seconds',  color: ACCENT  },
  { icon: Brain,        label: 'Build Your Profile',  desc: '~2 minutes',  color: AI_CLR  },
  { icon: Zap,          label: 'Start Earning',        desc: 'Immediately', color: '#FFB84D' },
];

const FEATURES = [
  { icon: Brain,  text: 'Personalised mission matches powered by your Impact DNA' },
  { icon: Shield, text: 'Secure, end-to-end encrypted communications' },
  { icon: Zap,    text: 'Earn real rewards from brands, NGOs and enterprises' },
  { icon: Lock,   text: 'Your profile data stays private and is never sold' },
];

interface OnboardingSplashProps {
  open: boolean;
  onClose: () => void;
}

export default function OnboardingSplash({ open, onClose }: OnboardingSplashProps) {
  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Prevent background scroll
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(5,8,22,0.88)',
            backdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px 16px',
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 480,
              background: CARD,
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 24,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Top glow */}
            <div style={{
              position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
              width: 280, height: 2,
              background: `linear-gradient(90deg, transparent, ${ACCENT}80, ${AI_CLR}80, transparent)`,
            }} />

            {/* Close */}
            <button
              onClick={onClose}
              style={{
                position: 'absolute', top: 14, right: 14,
                width: 30, height: 30, borderRadius: 8,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.09)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: FAINT,
              }}
            >
              <X size={14} />
            </button>

            <div style={{ padding: '28px 28px 24px' }}>
              {/* Header */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12,
                    background: `linear-gradient(135deg, ${ACCENT}20, ${AI_CLR}20)`,
                    border: `1px solid ${ACCENT}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Brain size={20} style={{ color: ACCENT }} strokeWidth={1.8} />
                  </div>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: FAINT, textTransform: 'uppercase', letterSpacing: '.1em', margin: 0 }}>
                      Welcome to X-Hunt
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                      <Clock size={10} style={{ color: FAINT }} />
                      <span style={{ fontSize: 10, color: FAINT }}>Takes about 3 minutes</span>
                    </div>
                  </div>
                </div>
                <h2 style={{
                  fontSize: 22, fontWeight: 900, color: TXT, margin: '0 0 8px',
                  letterSpacing: '-0.025em', lineHeight: 1.25,
                }}>
                  Earn money doing things{' '}
                  <span style={{ color: ACCENT }}>you already love</span>
                </h2>
                <p style={{ fontSize: 13.5, color: DIM, margin: 0, lineHeight: 1.6 }}>
                  Xeno, our AI, will learn what makes you unique and match you with missions worth completing — all in about 2 minutes.
                </p>
              </div>

              {/* 3-step journey */}
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: FAINT, textTransform: 'uppercase', letterSpacing: '.1em', margin: '0 0 12px' }}>
                  Your journey
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {STEPS.map(({ icon: Icon, label, desc, color }, i) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                      {/* Step dot + connector */}
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 2 }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: `${color}15`, border: `1.5px solid ${color}35`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Icon size={14} style={{ color }} strokeWidth={2} />
                        </div>
                        {i < STEPS.length - 1 && (
                          <div style={{ width: 1.5, height: 18, background: 'rgba(255,255,255,0.07)', margin: '4px 0' }} />
                        )}
                      </div>
                      {/* Label */}
                      <div style={{ paddingTop: 6, paddingBottom: i < STEPS.length - 1 ? 0 : 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: TXT, margin: '0 0 2px' }}>{label}</p>
                        <p style={{ fontSize: 11, color: FAINT, margin: 0 }}>{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Feature bullets */}
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 14, padding: '14px 16px', marginBottom: 22,
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {FEATURES.map(({ icon: Icon, text }) => (
                    <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                      <Icon size={12} style={{ color: ACCENT, flexShrink: 0, marginTop: 1.5 }} strokeWidth={2.2} />
                      <span style={{ fontSize: 12, color: DIM, lineHeight: 1.5 }}>{text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTAs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Link
                  href="/auth/signup?next=/get-started"
                  style={{
                    width: '100%', height: 50,
                    background: ACCENT, color: BG,
                    borderRadius: 14, border: 'none',
                    fontWeight: 900, fontSize: 15,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 8, textDecoration: 'none',
                    boxShadow: `0 4px 24px rgba(34,255,170,0.3)`,
                    letterSpacing: '-0.01em',
                  }}
                >
                  Create Free Account <ArrowRight size={16} strokeWidth={2.8} />
                </Link>
                <Link
                  href="/sign-in?redirect_url=%2Fget-started"
                  style={{
                    width: '100%', height: 44,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    color: DIM, borderRadius: 14,
                    fontWeight: 600, fontSize: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 8, textDecoration: 'none',
                  }}
                >
                  Already have an account? Sign in
                </Link>
              </div>

              <p style={{ textAlign: 'center', fontSize: 11, color: FAINT, marginTop: 14, lineHeight: 1.5 }}>
                Free to join · No credit card required · Your data is encrypted
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
