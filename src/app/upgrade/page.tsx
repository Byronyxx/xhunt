'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Sparkles, Zap, Shield, Star, Loader2, ArrowRight, Clock } from 'lucide-react';
import { PRICING_ENABLED } from '@/lib/pricing';

interface TierInfo {
  tier: 'free' | 'trial' | 'pro';
  isTrialActive: boolean;
  trialDaysLeft: number;
  trialEndsAt: string | null;
  canUseAI: boolean;
  hasUsedTrial: boolean;
  aiRequestsPerDay: number;
}

const T = {
  bg:    '#050816',
  panel: '#07101F',
  elev:  '#0D1530',
  card:  '#0A1226',
  line:  'rgba(255,255,255,.07)',
  txt:   '#F0F4FF',
  muted: '#8B9CC0',
  dim:   '#4A5578',
  green: '#22FFAA',
  ai:    '#6D5DFD',
  amber: '#FFB84D',
} as const;

const FREE_FEATURES  = ['Access to standard missions', 'Basic Hunt generation', 'Progress tracking'];
const TRIAL_FEATURES = ['Everything in Free', 'AI Mission Guide (50 req/day)', 'Verified & sponsored missions', 'AI step adaptation', 'Priority mission recommendations'];
const PRO_FEATURES   = ['Everything in Trial', 'AI Mission Guide (500 req/day)', 'Advanced AI model (llama-3.3-70b)', 'Unlimited premium missions', 'Early access to new features'];

function FeatureRow({ text, included }: { text: string; included: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, background: included ? 'rgba(34,255,170,.15)' : 'rgba(255,255,255,.04)', border: `1px solid ${included ? 'rgba(34,255,170,.3)' : T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {included && <Check size={11} strokeWidth={3} style={{ color: T.green }} />}
      </div>
      <span style={{ fontSize: 13, color: included ? T.txt : T.dim }}>{text}</span>
    </div>
  );
}

function UpgradePageInner() {
  const router       = useRouter();
  const params       = useSearchParams();
  const justUpgraded = params.get('success') === '1';
  const [tierInfo, setTierInfo]   = useState<TierInfo | null>(null);
  const [loading, setLoading]     = useState(true);
  const [starting, setStarting]   = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => {
    fetch('/api/subscription/status')
      .then((r) => r.json())
      .then((d: TierInfo) => setTierInfo(d))
      .catch(() => setTierInfo({ tier: 'free', isTrialActive: false, trialDaysLeft: 0, trialEndsAt: null, canUseAI: false, hasUsedTrial: false, aiRequestsPerDay: 0 }))
      .finally(() => setLoading(false));
  }, []);

  async function handleUpgrade() {
    if (!PRICING_ENABLED) return;
    setUpgrading(true); setError('');
    try {
      const res  = await fetch('/api/stripe/checkout', { method: 'POST' });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok) { if (res.status === 401) { router.push('/sign-in?redirect_url=%2Fupgrade'); return; } setError(data.error ?? 'Something went wrong.'); return; }
      if (data.url) window.location.href = data.url;
    } catch { setError('Network error — please try again.'); }
    finally { setUpgrading(false); }
  }

  async function startTrial() {
    if (!PRICING_ENABLED) return;
    setStarting(true); setError('');
    try {
      const res  = await fetch('/api/trial/start', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { if (res.status === 401) { router.push('/sign-in?redirect_url=%2Fupgrade'); return; } setError((data as { error?: string }).error ?? 'Something went wrong.'); return; }
      setTierInfo((prev) => prev ? { ...prev, tier: 'trial', isTrialActive: true, trialDaysLeft: 14, canUseAI: true } : prev);
    } catch { setError('Network error — please try again.'); }
    finally { setStarting(false); }
  }

  const isPro   = tierInfo?.tier === 'pro';
  const isTrial = tierInfo?.isTrialActive;
  const isFree  = !isTrial && !isPro;

  return (
    <div style={{ minHeight: '100vh', background: `radial-gradient(800px 600px at 50% 0%, rgba(34,255,170,.07), transparent 60%), ${T.bg}`, color: T.txt, fontFamily: 'var(--font-onest), system-ui' }}>
      <div style={{ maxWidth: 430, margin: '0 auto', padding: '0 20px 80px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 52, paddingBottom: 28 }}>
          <button onClick={() => router.back()} style={{ width: 38, height: 38, borderRadius: '50%', background: T.card, border: `1px solid ${T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ArrowLeft size={17} strokeWidth={2} style={{ color: T.txt }} />
          </button>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-.025em' }}>Plans & Billing</h1>
        </div>

        {/* Stripe success banner */}
        {justUpgraded && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            style={{ borderRadius: 18, padding: '16px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(34,255,170,.08)', border: '1px solid rgba(34,255,170,.2)' }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(34,255,170,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Check size={18} style={{ color: T.green }} strokeWidth={2.5} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: T.txt }}>Welcome to Pro!</p>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: T.muted }}>Your subscription is now active. Enjoy unlimited AI access.</p>
            </div>
          </motion.div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <Loader2 size={28} style={{ color: T.green, animation: 'spin 0.9s linear infinite' }} strokeWidth={2} />
          </div>
        ) : (
          <>
            {/* Current plan badge */}
            {tierInfo && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                style={{ borderRadius: 18, padding: '16px 18px', marginBottom: 24, background: isTrial ? 'rgba(109,93,253,.07)' : isPro ? 'rgba(34,255,170,.07)' : T.card, border: `1px solid ${isTrial ? 'rgba(109,93,253,.18)' : isPro ? 'rgba(34,255,170,.18)' : T.line}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ margin: '0 0 3px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: isTrial ? T.ai : isPro ? T.green : T.dim }}>Current Plan</p>
                  <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: T.txt }}>{isPro ? 'Pro' : isTrial ? `Trial — ${tierInfo.trialDaysLeft}d left` : 'Free'}</p>
                  {isTrial && tierInfo.trialEndsAt && (
                    <p style={{ margin: '3px 0 0', fontSize: 11, color: T.dim, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={10} strokeWidth={2} />
                      Expires {new Date(tierInfo.trialEndsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                  )}
                </div>
                <div style={{ width: 42, height: 42, borderRadius: 14, background: isTrial ? 'rgba(109,93,253,.1)' : isPro ? 'rgba(34,255,170,.1)' : 'rgba(255,255,255,.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isPro ? <Star size={20} style={{ color: T.green }} strokeWidth={1.8} /> : isTrial ? <Sparkles size={20} style={{ color: T.ai }} strokeWidth={1.8} /> : <Zap size={20} style={{ color: T.dim }} strokeWidth={1.8} />}
                </div>
              </motion.div>
            )}

            {/* Trial active state */}
            {isTrial && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                style={{ borderRadius: 18, padding: '20px 18px', marginBottom: 24, background: 'rgba(109,93,253,.06)', border: '1px solid rgba(109,93,253,.18)', textAlign: 'center' }}>
                <div style={{ width: 52, height: 52, borderRadius: 18, background: 'rgba(109,93,253,.12)', margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={24} style={{ color: T.ai }} strokeWidth={2} />
                </div>
                <p style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800, color: T.txt }}>Trial Active</p>
                <p style={{ margin: 0, fontSize: 13, color: T.muted, lineHeight: 1.6 }}>
                  You have {tierInfo?.trialDaysLeft} days of full AI access and premium missions. Enjoy every step!
                </p>
                <button onClick={() => router.push('/missions')}
                  style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 6, height: 42, padding: '0 20px', borderRadius: 999, border: 0, cursor: 'pointer', background: 'rgba(109,93,253,.12)', color: T.ai, fontSize: 13, fontWeight: 700, fontFamily: 'inherit' }}>
                  Browse Missions <ArrowRight size={14} strokeWidth={2.5} />
                </button>
              </motion.div>
            )}

            {/* Plan cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Free */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                style={{ borderRadius: 20, padding: '18px 18px 20px', background: T.card, border: `1px solid ${isFree && !tierInfo?.hasUsedTrial ? 'rgba(255,255,255,.15)' : T.line}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div>
                    <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: T.txt }}>Free</p>
                    <p style={{ margin: '2px 0 0', fontSize: 11, color: T.dim }}>Always</p>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: T.txt }}>$0</div>
                </div>
                {FREE_FEATURES.map((f) => <FeatureRow key={f} text={f} included />)}
                <FeatureRow text="AI assistance" included={false} />
                <FeatureRow text="Verified & sponsored missions" included={false} />
              </motion.div>

              {/* Trial */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                style={{ borderRadius: 20, overflow: 'hidden', border: `1px solid ${isTrial ? 'rgba(109,93,253,.3)' : 'rgba(109,93,253,.15)'}` }}>
                <div style={{ height: 3, background: 'linear-gradient(90deg,#6D5DFD,rgba(109,93,253,0))' }} />
                <div style={{ padding: '18px 18px 20px', background: 'rgba(109,93,253,.03)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: T.txt }}>Trial</p>
                    <span style={{ fontSize: 11, fontWeight: 700, color: T.ai, background: 'rgba(109,93,253,.12)', padding: '3px 10px', borderRadius: 999 }}>14 DAYS FREE</span>
                  </div>
                  <p style={{ margin: '0 0 16px', fontSize: 11, color: T.dim }}>Then $12/mo — cancel anytime</p>
                  {TRIAL_FEATURES.map((f) => <FeatureRow key={f} text={f} included />)}

                  {error && <p style={{ fontSize: 12, color: '#FF5C7A', margin: '10px 0 0' }}>{error}</p>}

                  {PRICING_ENABLED && !isTrial && !isPro && (
                    <motion.button whileTap={{ scale: 0.98 }} onClick={() => void startTrial()} disabled={starting || !!tierInfo?.hasUsedTrial}
                      style={{ width: '100%', height: 48, borderRadius: 999, cursor: tierInfo?.hasUsedTrial ? 'not-allowed' : 'pointer', marginTop: 16, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, background: tierInfo?.hasUsedTrial ? T.elev : 'rgba(109,93,253,.15)', color: tierInfo?.hasUsedTrial ? T.dim : T.ai, border: `1px solid ${tierInfo?.hasUsedTrial ? T.line : 'rgba(109,93,253,.25)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      {starting ? <Loader2 size={17} strokeWidth={2} style={{ animation: 'spin 0.9s linear infinite' }} /> : tierInfo?.hasUsedTrial ? 'Trial already used' : 'Start Free Trial'}
                      {!starting && !tierInfo?.hasUsedTrial && <ArrowRight size={15} strokeWidth={2.5} />}
                    </motion.button>
                  )}
                  {isTrial && (
                    <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 12, background: 'rgba(109,93,253,.08)', border: '1px solid rgba(109,93,253,.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Check size={15} style={{ color: T.ai }} strokeWidth={2.5} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.ai }}>Active — {tierInfo?.trialDaysLeft} days remaining</span>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Pro */}
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                style={{ borderRadius: 20, overflow: 'hidden', border: `1px solid ${isPro ? 'rgba(34,255,170,.3)' : 'rgba(34,255,170,.15)'}` }}>
                <div style={{ height: 3, background: 'linear-gradient(90deg,#22FFAA,rgba(34,255,170,0))' }} />
                <div style={{ padding: '18px 18px 20px', background: 'rgba(34,255,170,.02)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <p style={{ margin: 0, fontSize: 17, fontWeight: 800, color: T.txt }}>Pro</p>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ margin: 0, fontSize: 22, fontWeight: 900, color: T.green }}>$12<span style={{ fontSize: 13, fontWeight: 600, color: T.muted }}>/mo</span></p>
                    </div>
                  </div>
                  <p style={{ margin: '0 0 16px', fontSize: 11, color: T.dim }}>Full AI power, no limits</p>
                  {PRO_FEATURES.map((f) => <FeatureRow key={f} text={f} included />)}

                  {!isPro && !PRICING_ENABLED ? (
                    <p data-testid="pricing-coming-soon" style={{ margin: '16px 0 0', fontSize: 15, color: T.dim }}>Plans are coming soon.</p>
                  ) : !isPro ? (
                    <motion.button whileTap={{ scale: 0.98 }} onClick={() => void handleUpgrade()} disabled={upgrading}
                      style={{ width: '100%', height: 50, borderRadius: 999, border: 0, cursor: upgrading ? 'default' : 'pointer', marginTop: 16, fontFamily: 'inherit', fontSize: 14, fontWeight: 700, background: T.green, color: '#050816', boxShadow: '0 4px 20px rgba(34,255,170,.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: upgrading ? 0.7 : 1 }}>
                      {upgrading ? <Loader2 size={17} strokeWidth={2} style={{ animation: 'spin 0.9s linear infinite' }} /> : <><Shield size={16} strokeWidth={2.5} />Upgrade to Pro</>}
                    </motion.button>
                  ) : (
                    <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 12, background: 'rgba(34,255,170,.08)', border: '1px solid rgba(34,255,170,.2)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Check size={15} style={{ color: T.green }} strokeWidth={2.5} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.green }}>Active Pro plan</span>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>

            <p style={{ textAlign: 'center', fontSize: 11, color: T.dim, marginTop: 24 }}>
              Prices in USD · Secure payments via Stripe · Cancel anytime
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function UpgradePage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#050816', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 28, height: 28, border: '2px solid #22FFAA', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.9s linear infinite' }} />
      </div>
    }>
      <UpgradePageInner />
    </Suspense>
  );
}
