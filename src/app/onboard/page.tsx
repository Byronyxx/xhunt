'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, ArrowRight, Loader2, Users, Briefcase, GraduationCap, Zap, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const ORG_TYPES = [
  { id: 'brand',      label: 'Brand / Marketing',    icon: Zap,            desc: 'Customer engagement campaigns' },
  { id: 'enterprise', label: 'Enterprise',            icon: Briefcase,      desc: 'Workforce & training missions' },
  { id: 'education',  label: 'Education',             icon: GraduationCap,  desc: 'Learning & assessment flows' },
  { id: 'community',  label: 'Community / Creator',   icon: Users,          desc: 'Experiences for your audience' },
];

const pageVariants = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } },
  exit:    { opacity: 0, y: -16, transition: { duration: 0.2 } },
};

const ACCENT = '#22FFAA', TXT = '#F0F4FF', DIM = '#8B9CC0', FAINT = '#4A5578';
const CARD: React.CSSProperties = { background: '#0A1226', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14 };

export default function OnboardPage() {
  const router  = useRouter();
  const [step, setStep]     = useState<1 | 2>(1);
  const [orgName, setOrgName] = useState('');
  const [orgType, setOrgType] = useState('');
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/sign-in?redirect_url=%2Fonboard'); return; }
      const { data: profile } = await supabase.from('user_profiles').select('tenant_id, onboarding_complete').eq('id', user.id).single();
      if (profile?.tenant_id && profile?.onboarding_complete) { router.replace('/workspace'); return; }
      setMounted(true);
    }
    checkAuth();
  }, [router]);

  if (!mounted) return null;

  function slugify(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  async function handleCreate() {
    if (!orgName || !orgType) return;
    setSaving(true); setError('');
    try {
      const slug = `${slugify(orgName)}-${Math.random().toString(36).slice(2, 7)}`;
      const res  = await fetch('/api/workspace/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgName, slug, org_type: orgType }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong');
      router.push('/workspace');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSaving(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#050816', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 20px' }}>
      <div style={{ width: '100%', maxWidth: 480 }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
          <img src="/xhunt-logo.png" alt="X-Hunt" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: FAINT, background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.08)', borderRadius: 999, padding: '3px 10px', textTransform: 'uppercase', letterSpacing: '.08em' }}>
            Workspace setup
          </span>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key="step1" variants={pageVariants} initial="hidden" animate="visible" exit="exit">
              <h1 style={{ fontSize: 26, fontWeight: 800, color: TXT, margin: '0 0 6px', letterSpacing: '-.02em' }}>Name your organization</h1>
              <p style={{ fontSize: 14, color: DIM, margin: '0 0 28px' }}>This is your team&apos;s workspace on X-hunt.</p>

              <div style={{ position: 'relative', marginBottom: 24 }}>
                <Building2 size={16} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: FAINT }} strokeWidth={2} />
                <input type="text" placeholder="e.g. Acme Corp, Nike Africa, Oxford University" value={orgName} onChange={(e) => setOrgName(e.target.value)} autoFocus
                  style={{ ...CARD, width: '100%', height: 50, paddingLeft: 44, paddingRight: 16, color: TXT, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(34,255,170,.35)'; }} onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; }} />
              </div>

              <motion.button whileTap={{ scale: 0.98 }} disabled={orgName.trim().length < 2} onClick={() => setStep(2)}
                style={{ width: '100%', height: 50, background: ACCENT, color: '#050816', borderRadius: 14, border: 'none', fontWeight: 800, fontSize: 15, cursor: orgName.trim().length < 2 ? 'not-allowed' : 'pointer', opacity: orgName.trim().length < 2 ? 0.45 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 20px rgba(34,255,170,.35)', fontFamily: 'inherit' }}>
                Continue <ArrowRight size={16} strokeWidth={2.5} />
              </motion.button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key="step2" variants={pageVariants} initial="hidden" animate="visible" exit="exit">
              <button onClick={() => setStep(1)} style={{ fontSize: 13, color: DIM, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                ← Back
              </button>

              <h1 style={{ fontSize: 26, fontWeight: 800, color: TXT, margin: '0 0 6px', letterSpacing: '-.02em' }}>What best describes you?</h1>
              <p style={{ fontSize: 14, color: DIM, margin: '0 0 20px' }}>We&apos;ll set up the right templates for your team.</p>

              {error && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,92,122,.1)', border: '1px solid rgba(255,92,122,.3)', borderRadius: 14, padding: '10px 14px', marginBottom: 18 }}>
                  <AlertCircle size={15} style={{ color: '#FF5C7A', flexShrink: 0 }} strokeWidth={2} />
                  <p style={{ fontSize: 13, color: '#FF5C7A', margin: 0 }}>{error}</p>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 24 }}>
                {ORG_TYPES.map(({ id, label, icon: Icon, desc }) => {
                  const active = orgType === id;
                  return (
                    <motion.button key={id} whileTap={{ scale: 0.97 }} onClick={() => setOrgType(id)}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12, padding: 16, borderRadius: 18, border: `2px solid ${active ? ACCENT : 'rgba(255,255,255,.08)'}`, background: active ? `rgba(34,255,170,.06)` : '#0A1226', cursor: 'pointer', textAlign: 'left', transition: 'all .15s', boxShadow: active ? `0 0 18px rgba(34,255,170,.15)` : 'none', fontFamily: 'inherit' }}>
                      <div style={{ width: 38, height: 38, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: active ? 'rgba(34,255,170,.12)' : 'rgba(109,93,253,.08)' }}>
                        <Icon size={18} style={{ color: active ? ACCENT : DIM }} strokeWidth={2} />
                      </div>
                      <div>
                        <p style={{ margin: '0 0 3px', fontSize: 13, fontWeight: 700, color: active ? ACCENT : TXT }}>{label}</p>
                        <p style={{ margin: 0, fontSize: 11, color: FAINT, lineHeight: 1.4 }}>{desc}</p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              <motion.button whileTap={{ scale: 0.98 }} disabled={!orgType || saving} onClick={handleCreate}
                style={{ width: '100%', height: 50, background: ACCENT, color: '#050816', borderRadius: 14, border: 'none', fontWeight: 800, fontSize: 15, cursor: !orgType || saving ? 'not-allowed' : 'pointer', opacity: !orgType || saving ? 0.45 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 20px rgba(34,255,170,.35)', fontFamily: 'inherit' }}>
                {saving ? <Loader2 size={18} strokeWidth={2} style={{ animation: 'spin 0.9s linear infinite' }} /> : <>Launch workspace <ArrowRight size={16} strokeWidth={2.5} /></>}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
