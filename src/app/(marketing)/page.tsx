'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { Spotlight } from '@/components/ui/spotlight';
import { SplineScene } from '@/components/ui/splite';
import {
  ArrowRight, ChevronRight, Shield, CheckCircle2,
  Clock, Award, Wallet, Users, Camera, MapPin,
  Zap, Star, TrendingUp, BarChart3,
  Dumbbell, UtensilsCrossed, Trees, Laptop,
} from 'lucide-react';
import { Radar, IconContainer } from '@/components/ui/radar';
import OnboardingSplash from '@/components/OnboardingSplash';

/* ─── animation helpers ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (d = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const, delay: d } }),
};

function Sec({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.section ref={ref} initial="hidden" animate={inView ? 'visible' : 'hidden'} className={className} style={style}>
      {children}
    </motion.section>
  );
}

/* ─── missions shown in marketplace section ─── */
const SAMPLE_MISSIONS = [
  {
    brand: 'FitLife Pro', brandInitials: 'FL', brandColor: '#22FFAA', category: 'Fitness',
    title: '7-Day Morning Workout Streak',
    description: 'Work out every morning for 7 days. Take a selfie at the gym or your workout spot. Upload by 10am each day.',
    reward: 45, duration: '7 days', difficulty: 'Easy',
    huntersActive: 1240, completionRate: 91,
    tags: ['fitness', 'daily', 'streak'], hot: true,
    why: 'Perfect for people already working out. You\'re doing this anyway.',
  },
  {
    brand: 'VisitLagos', brandInitials: 'VL', brandColor: '#FFB84D', category: 'Explore',
    title: 'Find 5 Hidden Spots in Your City',
    description: 'Discover 5 local gems using our GPS map. Visit, take a photo at each one, and write a quick 50-word review.',
    reward: 60, duration: '14 days', difficulty: 'Easy',
    huntersActive: 587, completionRate: 83,
    tags: ['explore', 'local', 'photo'], hot: false,
    why: 'Great excuse to get out of the house and discover new places.',
  },
  {
    brand: 'NutrientBox', brandInitials: 'NB', brandColor: '#a78bfa', category: 'Wellness',
    title: '14-Day Nutrition Challenge',
    description: 'Follow the meal plan, log daily photos of your meals, and submit a short end-of-week reflection.',
    reward: 75, duration: '14 days', difficulty: 'Medium',
    huntersActive: 432, completionRate: 78,
    tags: ['nutrition', 'wellness', 'habit'], hot: true,
    why: 'Brands want real feedback from real people. Not influencers.',
  },
  {
    brand: 'TechHub', brandInitials: 'TH', brandColor: '#6D5DFD', category: 'Community',
    title: 'Attend & Review a Local Meetup',
    description: 'Go to any tech meetup this month. Check in via GPS. Write a 100-word recap. Simple.',
    reward: 35, duration: '3 days', difficulty: 'Easy',
    huntersActive: 291, completionRate: 96,
    tags: ['events', 'networking', 'review'], hot: false,
    why: 'Easiest $35 you\'ll make this week.',
  },
];

const TIERS = [
  {
    tier: 'New Hunter', range: 'Just starting', color: '#8B9CC0', border: 'rgba(139,156,192,.2)', bg: 'rgba(139,156,192,.04)',
    desc: 'Free missions to build your track record. AI generates one for your city right now.',
    gigs: 'Free community missions', earnings: 'Build your score first',
  },
  {
    tier: 'Verified Hunter', range: 'Score 3.0+', color: '#22FFAA', border: 'rgba(34,255,170,.25)', bg: 'rgba(34,255,170,.05)',
    desc: 'Unlock brand gigs. Real money, real brands, automatic escrow.',
    gigs: '$10–$100 per mission', earnings: 'Avg $80 / month',
  },
  {
    tier: 'Pro Hunter', range: 'Score 6.0+', color: '#6D5DFD', border: 'rgba(109,93,253,.25)', bg: 'rgba(109,93,253,.05)',
    desc: 'Premium gigs, live streaming, AI coaching, faster validation.',
    gigs: '$100–$500 per mission', earnings: 'Avg $320 / month',
  },
  {
    tier: 'Elite Hunter', range: 'Score 8.5+', color: '#FFB84D', border: 'rgba(255,184,77,.25)', bg: 'rgba(255,184,77,.05)',
    desc: 'Enterprise contracts, direct brand relationships, priority everything.',
    gigs: '$500+ per mission', earnings: 'Avg $900 / month',
  },
];

/* ─── Mission Card ─── */
function MissionCard({ m, index }: { m: typeof SAMPLE_MISSIONS[0]; index: number }) {
  const diffColor = { Easy: '#22FFAA', Medium: '#FFB84D', Hard: '#FF5C7A' }[m.difficulty] ?? '#7d8b8e';
  return (
    <motion.div
      variants={fadeUp} custom={index * 0.08}
      className="relative rounded-2xl border p-5 flex flex-col gap-4 group cursor-pointer transition-all duration-300 hover:-translate-y-1"
      style={{ background: '#0A1226', borderColor: `${m.brandColor}22` }}
    >
      {m.hot && (
        <div className="absolute -top-2.5 left-5 text-[10px] font-black uppercase tracking-wider px-3 py-0.5 rounded-full"
          style={{ background: m.brandColor, color: '#050816' }}>Hot right now</div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[12px] font-black flex-shrink-0"
            style={{ background: `${m.brandColor}15`, border: `1px solid ${m.brandColor}28`, color: m.brandColor }}>
            {m.brandInitials}
          </div>
          <div>
            <p className="text-[12px] font-semibold text-[#8B9CC0] leading-none">{m.brand}</p>
            <p className="text-[10px] text-[#4A5578] mt-0.5">{m.category}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[26px] font-black leading-none" style={{ color: m.brandColor }}>${m.reward}</p>
          <p className="text-[10px] text-[#4A5578]">held in escrow</p>
        </div>
      </div>

      <div>
        <h3 className="text-[15px] font-bold text-[#F0F4FF] leading-snug mb-2">{m.title}</h3>
        <p className="text-[12px] text-[#8B9CC0] leading-relaxed line-clamp-2">{m.description}</p>
      </div>

      <div className="px-3 py-2.5 rounded-xl text-[11px] italic"
        style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.05)', color: '#6D9E8A' }}>
        &quot;{m.why}&quot;
      </div>

      <div className="flex items-center gap-3 pt-3 mt-auto" style={{ borderTop: '1px solid rgba(255,255,255,.05)' }}>
        <div className="flex items-center gap-1.5">
          <Clock size={10} strokeWidth={2} className="text-[#4A5578]" />
          <span className="text-[11px] text-[#8B9CC0]">{m.duration}</span>
        </div>
        <div className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${diffColor}12`, color: diffColor }}>
          {m.difficulty}
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <Users size={10} strokeWidth={2} className="text-[#4A5578]" />
          <span className="text-[11px] text-[#8B9CC0]">{m.huntersActive.toLocaleString()} hunting</span>
        </div>
        <div className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(34,255,170,.08)', color: '#22FFAA' }}>
          {m.completionRate}% paid out
        </div>
      </div>

      <div className="h-11 rounded-xl flex items-center justify-center gap-2 font-bold text-[13px] transition-all duration-200 group-hover:shadow-[0_0_20px_rgba(34,255,170,.2)]"
        style={{ background: 'rgba(34,255,170,.08)', border: '1px solid rgba(34,255,170,.18)', color: '#22FFAA' }}>
        Accept Mission <ArrowRight size={13} strokeWidth={2.5} />
      </div>
    </motion.div>
  );
}

/* ─── Phone Frame ─── */
function PhoneFrame({ children, tilt = 0, scale = 1, zIndex = 1 }: {
  children: React.ReactNode; tilt?: number; scale?: number; zIndex?: number;
}) {
  return (
    <div style={{
      transform: `rotate(${tilt}deg) scale(${scale})`,
      transformOrigin: 'center bottom',
      position: 'relative', zIndex,
      filter: 'drop-shadow(0 32px 64px rgba(0,0,0,0.7))',
    }}>
      <div style={{
        width: 248, height: 500, borderRadius: 42,
        background: '#0D1530',
        border: '2px solid rgba(255,255,255,0.12)',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04), 0 0 40px rgba(34,255,170,0.04)',
        overflow: 'hidden', position: 'relative',
      }}>
        <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', width: 72, height: 8, borderRadius: 4, background: '#000', zIndex: 10 }} />
        <div style={{ position: 'absolute', inset: 0, overflowY: 'hidden', overflowX: 'hidden' }}>{children}</div>
        <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', width: 80, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.25)', zIndex: 10 }} />
      </div>
    </div>
  );
}

/* ─── Screen: Discover missions ─── */
function DiscoverScreen() {
  const missions = [
    { emoji: '🏋️', brand: 'FitLife Pro', title: '7-Day Workout Streak', reward: '$45', color: '#22FFAA', distance: '0.3 km', tag: 'Easy · 7 days' },
    { emoji: '📍', brand: 'VisitLagos', title: 'Find 5 Hidden City Spots', reward: '$60', color: '#FFB84D', distance: '1.2 km', tag: 'Easy · 14 days' },
    { emoji: '🥗', brand: 'NutrientBox', title: '14-Day Nutrition Challenge', reward: '$75', color: '#a78bfa', distance: 'Remote', tag: 'Medium · 14 days' },
  ];

  return (
    <div style={{ background: '#050816', height: '100%', padding: '30px 0 0', fontFamily: 'inherit' }}>
      <div style={{ padding: '0 16px 14px' }}>
        <p style={{ margin: 0, fontSize: 10, color: '#4A5578', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em' }}>What&apos;s near you</p>
        <p style={{ margin: '2px 0 0', fontSize: 15, color: '#F0F4FF', fontWeight: 800 }}>Find a mission</p>
      </div>

      <div style={{ padding: '0 16px 12px', display: 'flex', gap: 6 }}>
        {['All', 'Fitness', 'Explore', 'Food'].map((tab, i) => (
          <div key={tab} style={{
            padding: '4px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
            background: i === 0 ? 'rgba(34,255,170,.1)' : 'rgba(255,255,255,.04)',
            border: `1px solid ${i === 0 ? 'rgba(34,255,170,.25)' : 'rgba(255,255,255,.08)'}`,
            color: i === 0 ? '#22FFAA' : '#4A5578',
          }}>{tab}</div>
        ))}
      </div>

      {missions.map((m, i) => (
        <div key={i} style={{ margin: '0 16px 8px', padding: '12px', borderRadius: 16, background: '#0A1226', border: `1px solid ${m.color}18` }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${m.color}12`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{m.emoji}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 9, color: '#4A5578', fontWeight: 600 }}>{m.brand}</p>
              <p style={{ margin: '2px 0 3px', fontSize: 11, color: '#F0F4FF', fontWeight: 700, lineHeight: 1.3 }}>{m.title}</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 9, color: '#4A5578' }}>{m.distance}</span>
                <span style={{ fontSize: 9, color: '#4A5578' }}>·</span>
                <span style={{ fontSize: 9, color: '#4A5578' }}>{m.tag}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: m.color, lineHeight: 1 }}>{m.reward}</p>
              <p style={{ margin: '2px 0 0', fontSize: 8, color: '#4A5578' }}>escrow</p>
            </div>
          </div>
        </div>
      ))}

      <div style={{ margin: '4px 16px 0', padding: '10px 14px', borderRadius: 14, background: 'rgba(34,255,170,.06)', border: '1px solid rgba(34,255,170,.15)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>🤖</span>
          <div>
            <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: '#22FFAA' }}>AI just matched you</p>
            <p style={{ margin: 0, fontSize: 8, color: '#4A5578' }}>Based on your profile & location</p>
          </div>
        </div>
        <span style={{ fontSize: 9, color: '#22FFAA', fontWeight: 700 }}>3 new →</span>
      </div>

      <div style={{ position: 'absolute', bottom: 14, left: 0, right: 0, padding: '8px 0', borderTop: '1px solid rgba(255,255,255,.05)', background: 'rgba(5,8,22,.95)', display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
        {[{ icon: '⌂', label: 'Home', active: false }, { icon: '◎', label: 'Explore', active: true }, { icon: '⏱', label: 'Feed', active: false }, { icon: '○', label: 'Me', active: false }].map(item => (
          <div key={item.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <span style={{ fontSize: 12, color: item.active ? '#22FFAA' : '#F0F4FF', opacity: item.active ? 1 : 0.35 }}>{item.icon}</span>
            <span style={{ fontSize: 7, color: item.active ? '#22FFAA' : '#4A5578', fontWeight: item.active ? 700 : 400 }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Screen: Proving It (active mission) ─── */
function ProvingScreen() {
  const [uploaded, setUploaded] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setUploaded(true), 1800);
    const t2 = setTimeout(() => setSubmitted(true), 3400);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div style={{ background: '#050816', height: '100%', fontFamily: 'inherit' }}>
      <div style={{ height: 3, background: '#0D1530' }}>
        <div style={{ height: '100%', width: '57%', background: 'linear-gradient(90deg, #22FFAA, #6D5DFD)', boxShadow: '0 0 8px rgba(34,255,170,.5)' }} />
      </div>

      <div style={{ padding: '26px 16px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 9, color: '#4A5578', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em' }}>FitLife Pro · Day 4 of 7</p>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: '#F0F4FF', fontWeight: 800 }}>Morning Workout Streak</p>
        </div>
        <div style={{ fontSize: 9, fontWeight: 800, color: '#22FFAA', background: 'rgba(34,255,170,.08)', border: '1px solid rgba(34,255,170,.15)', borderRadius: 8, padding: '4px 10px' }}>
          $45 locked
        </div>
      </div>

      <div style={{ padding: '0 16px 12px', display: 'flex', gap: 3 }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < 3 ? '#22FFAA' : i === 3 ? 'rgba(34,255,170,.4)' : 'rgba(255,255,255,.07)' }} />
        ))}
      </div>

      <div style={{ margin: '0 16px 12px', padding: '14px', borderRadius: 18, background: 'rgba(34,255,170,.05)', border: '1px solid rgba(34,255,170,.15)' }}>
        <p style={{ margin: '0 0 4px', fontSize: 8, color: '#22FFAA', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em' }}>Today&apos;s step</p>
        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#F0F4FF', lineHeight: 1.4 }}>Take a selfie at your workout spot and upload it before 10am</p>
      </div>

      <AnimatePresence mode="wait">
        {!uploaded ? (
          <motion.div key="upload"
            initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
            style={{ margin: '0 16px 12px', padding: '18px 14px', borderRadius: 16, background: '#0A1226', border: '1px dashed rgba(255,255,255,.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 36, height: 36, borderRadius: 12, background: 'rgba(109,93,253,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 18 }}>📸</span>
            </div>
            <p style={{ margin: 0, fontSize: 11, color: '#8B9CC0', fontWeight: 600 }}>Tap to upload your photo</p>
            <p style={{ margin: 0, fontSize: 9, color: '#4A5578' }}>GPS location will be captured automatically</p>
          </motion.div>
        ) : (
          <motion.div key="uploaded"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            style={{ margin: '0 16px 12px', padding: '12px 14px', borderRadius: 16, background: 'rgba(34,255,170,.05)', border: '1px solid rgba(34,255,170,.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: '#22FFAA', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>✓</div>
            <div>
              <p style={{ margin: 0, fontSize: 11, color: '#22FFAA', fontWeight: 700 }}>Photo uploaded!</p>
              <p style={{ margin: 0, fontSize: 9, color: '#4A5578' }}>GPS: Ikoyi Fitness Centre · 14m accuracy</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ margin: '0 16px 12px', padding: '10px 12px', borderRadius: 12, background: 'rgba(109,93,253,.06)', border: '1px solid rgba(109,93,253,.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13 }}>🤖</span>
        <div>
          <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: '#a78bfa' }}>AI will review in ~30 seconds</p>
          <p style={{ margin: 0, fontSize: 8, color: '#4A5578' }}>Photo + GPS + timestamp checked automatically</p>
        </div>
      </div>

      {uploaded && (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          style={{ margin: '0 16px' }}>
          <div style={{
            height: 42, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            background: submitted ? 'rgba(34,255,170,.15)' : '#22FFAA',
            border: submitted ? '1px solid rgba(34,255,170,.3)' : 'none',
          }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: submitted ? '#22FFAA' : '#050816' }}>
              {submitted ? '⏳ Under review…' : 'Submit for review'}
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}

/* ─── Screen: You Got Paid ─── */
function PayoutScreen() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 800);
    const t2 = setTimeout(() => setStage(2), 2000);
    const t3 = setTimeout(() => setStage(3), 3200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div style={{ background: '#050816', height: '100%', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 16px', textAlign: 'center' }}>
      {stage < 1 ? (
        <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(109,93,253,.1)', border: '1px solid rgba(109,93,253,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.span style={{ fontSize: 24 }} animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}>⚙️</motion.span>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: '#8B9CC0' }}>AI reviewing evidence…</p>
        </motion.div>
      ) : (
        <motion.div key="result" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}
            style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, #22FFAA, #6D5DFD)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, boxShadow: '0 0 40px rgba(34,255,170,.35)' }}>
            ✓
          </motion.div>

          {stage >= 1 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <p style={{ margin: 0, fontSize: 11, color: '#4A5578', fontWeight: 600 }}>MISSION COMPLETE</p>
              <p style={{ margin: '4px 0 0', fontSize: 32, fontWeight: 900, color: '#22FFAA', letterSpacing: '-1px', lineHeight: 1 }}>$45</p>
              <p style={{ margin: '4px 0 0', fontSize: 11, color: '#8B9CC0' }}>released from escrow</p>
            </motion.div>
          )}

          {stage >= 2 && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              style={{ padding: '8px 16px', borderRadius: 12, background: 'rgba(34,255,170,.06)', border: '1px solid rgba(34,255,170,.15)', width: '100%' }}>
              <p style={{ margin: 0, fontSize: 9, color: '#22FFAA', fontWeight: 700 }}>✓ Validated in 23 seconds</p>
              <p style={{ margin: '2px 0 0', fontSize: 9, color: '#4A5578' }}>Photo + GPS + timestamp verified</p>
            </motion.div>
          )}

          {stage >= 3 && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              style={{ width: '100%' }}>
              <div style={{ padding: '8px 12px', borderRadius: 12, background: '#0A1226', border: '1px solid rgba(255,255,255,.07)', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 9, color: '#8B9CC0' }}>Hunter Score</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 9, color: '#4A5578' }}>4.8</span>
                  <span style={{ fontSize: 10, color: '#22FFAA' }}>→</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#22FFAA' }}>5.1</span>
                  <span style={{ fontSize: 9, color: '#22FFAA', background: 'rgba(34,255,170,.1)', padding: '1px 5px', borderRadius: 6 }}>+0.3</span>
                </div>
              </div>
              <div style={{ height: 40, borderRadius: 14, background: 'rgba(34,255,170,.08)', border: '1px solid rgba(34,255,170,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#22FFAA' }}>See next missions →</span>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}

/* ─── App Mocks Section ─── */
function AppMocksSection({ onCTA }: { onCTA: () => void }) {
  const [activeScreen, setActiveScreen] = useState(0);
  const screens = [
    { id: 'discover', label: 'Browse Missions', tagline: 'Pick what fits your life', component: <DiscoverScreen /> },
    { id: 'prove',   label: 'Do & Prove It',   tagline: 'Complete it, upload proof',  component: <ProvingScreen /> },
    { id: 'payout',  label: 'Get Paid',         tagline: 'AI confirms, money moves',   component: <PayoutScreen /> },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveScreen(prev => (prev + 1) % screens.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [screens.length]);

  return (
    <Sec className="py-24 lg:py-32 overflow-hidden" style={{ background: '#050816' }}>
      <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <motion.p variants={fadeUp} className="text-[11px] font-bold text-[#4A5578] uppercase tracking-widest mb-3">How it feels</motion.p>
          <motion.h2 variants={fadeUp} custom={0.06} className="text-[clamp(1.9rem,3.5vw,2.8rem)] font-black text-[#F0F4FF] leading-tight tracking-tight mb-4">
            Three steps to your
            <br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-[#22FFAA] to-[#6D5DFD]">first payout.</span>
          </motion.h2>
          <motion.p variants={fadeUp} custom={0.12} className="text-[14px] text-[#8B9CC0] max-w-[420px] mx-auto">
            From scrolling to getting paid in under a week. Most hunters complete their first mission within 48 hours.
          </motion.p>
        </div>

        <motion.div variants={fadeUp} custom={0.16} className="flex justify-center gap-2 mb-12">
          {screens.map((s, i) => (
            <button key={s.id} onClick={() => setActiveScreen(i)}
              className="flex flex-col items-center gap-1 px-5 py-3 rounded-xl text-[12px] font-semibold transition-all duration-200"
              style={{
                background: activeScreen === i ? 'rgba(34,255,170,.08)' : 'rgba(255,255,255,.03)',
                border: `1px solid ${activeScreen === i ? 'rgba(34,255,170,.25)' : 'rgba(255,255,255,.06)'}`,
                color: activeScreen === i ? '#22FFAA' : '#8B9CC0',
                fontFamily: 'inherit', cursor: 'pointer',
              }}>
              <span className="text-[10px] font-black uppercase tracking-widest" style={{ opacity: 0.6 }}>{String(i + 1).padStart(2, '0')}</span>
              {s.label}
            </button>
          ))}
        </motion.div>

        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          <motion.div variants={fadeUp} custom={0.2} className="flex-shrink-0 relative" style={{ height: 550 }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, rgba(34,255,170,.07) 0%, transparent 65%)', transform: 'scale(1.4)' }} />
            <div className="relative flex items-end justify-center gap-6" style={{ height: 550 }}>
              <AnimatePresence mode="popLayout">
                <motion.div key={`left-${(activeScreen + screens.length - 1) % screens.length}`}
                  initial={{ opacity: 0, x: -40 }} animate={{ opacity: 0.38, x: 0 }} exit={{ opacity: 0, x: -40 }}
                  transition={{ duration: 0.4 }} className="hidden md:block">
                  <PhoneFrame tilt={-7} scale={0.8} zIndex={1}>
                    {screens[(activeScreen + screens.length - 1) % screens.length].component}
                  </PhoneFrame>
                </motion.div>
              </AnimatePresence>

              <AnimatePresence mode="popLayout">
                <motion.div key={`center-${activeScreen}`}
                  initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -24, scale: 0.96 }}
                  transition={{ duration: 0.45, ease: 'easeOut' as const }}
                  style={{ zIndex: 3, position: 'relative' }}>
                  <PhoneFrame tilt={0} scale={1} zIndex={3}>
                    {screens[activeScreen].component}
                  </PhoneFrame>
                </motion.div>
              </AnimatePresence>

              <AnimatePresence mode="popLayout">
                <motion.div key={`right-${(activeScreen + 1) % screens.length}`}
                  initial={{ opacity: 0, x: 40 }} animate={{ opacity: 0.38, x: 0 }} exit={{ opacity: 0, x: 40 }}
                  transition={{ duration: 0.4 }} className="hidden md:block">
                  <PhoneFrame tilt={7} scale={0.8} zIndex={1}>
                    {screens[(activeScreen + 1) % screens.length].component}
                  </PhoneFrame>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="flex justify-center gap-2 mt-5">
              {screens.map((_, i) => (
                <button key={i} onClick={() => setActiveScreen(i)} style={{
                  width: i === activeScreen ? 22 : 6, height: 6, borderRadius: 3,
                  background: i === activeScreen ? '#22FFAA' : 'rgba(255,255,255,.15)',
                  border: 'none', cursor: 'pointer', transition: 'all 0.3s', padding: 0,
                }} />
              ))}
            </div>
          </motion.div>

          <div className="flex-1 max-w-lg">
            <AnimatePresence mode="wait">
              <motion.div key={activeScreen} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.35 }}>
                <div className="inline-flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest"
                  style={{ background: 'rgba(34,255,170,.08)', color: '#22FFAA', border: '1px solid rgba(34,255,170,.2)' }}>
                  <span className="font-black text-[#4A5578]">{String(activeScreen + 1).padStart(2, '0')}</span>
                  {screens[activeScreen].label}
                </div>
                <h3 className="text-[clamp(1.5rem,2.5vw,2rem)] font-black text-[#F0F4FF] leading-tight mb-3">
                  {activeScreen === 0 && <>Browse missions<br />that match your life.</>}
                  {activeScreen === 1 && <>Do the mission.<br />Upload your proof.</>}
                  {activeScreen === 2 && <>AI validates.<br />Money moves.</>}
                </h3>
                <p className="text-[14px] text-[#8B9CC0] leading-relaxed mb-8">
                  {activeScreen === 0 && 'Scroll through missions posted by real brands near you. Filter by type, time commitment, or payout. Every mission shows exactly what you need to do and exactly what you\'ll get paid.'}
                  {activeScreen === 1 && 'Follow the step-by-step mission guide. GPS confirms your location. The camera captures your proof. You submit it in-app — no emails, no spreadsheets, no DMs.'}
                  {activeScreen === 2 && 'AI reviews your evidence automatically — usually in under 60 seconds. If you did the mission, escrow releases. Money arrives in your wallet. Your Hunter Score updates.'}
                </p>
              </motion.div>
            </AnimatePresence>

            <div className="flex flex-col gap-3">
              {[
                { icon: MapPin, title: 'Missions near you', body: 'GPS-matched to your city. Walk there, drive there, or do it remotely.' },
                { icon: Camera, title: 'Evidence is simple', body: 'A photo, a GPS check-in, or a quick log. AI handles the rest.' },
                { icon: Wallet, title: 'Money moves automatically', body: 'No invoices. No chasing brands. Proof confirmed = payment released.' },
                { icon: TrendingUp, title: 'Every mission grows your score', body: 'Better track record = higher-value gigs. The more you do, the more you earn.' },
              ].map((feat, i) => (
                <motion.div key={feat.title} variants={fadeUp} custom={0.24 + i * 0.07}
                  className="flex items-start gap-4 p-4 rounded-xl border"
                  style={{ background: 'rgba(255,255,255,.02)', borderColor: 'rgba(255,255,255,.06)' }}>
                  <feat.icon size={16} strokeWidth={1.8} className="flex-shrink-0 mt-0.5" style={{ color: '#22FFAA' }} />
                  <div>
                    <p className="text-[13px] font-bold text-[#F0F4FF] mb-1">{feat.title}</p>
                    <p className="text-[12px] text-[#8B9CC0] leading-relaxed">{feat.body}</p>
                  </div>
                </motion.div>
              ))}
            </div>

            <motion.div variants={fadeUp} custom={0.52} className="mt-8 flex flex-wrap gap-3">
              <button onClick={onCTA}
                className="flex items-center gap-2.5 h-12 px-6 bg-accent text-[#050816] rounded-xl text-[14px] font-bold shadow-[0_0_24px_rgba(34,255,170,0.3)] hover:shadow-[0_0_40px_rgba(34,255,170,0.5)] transition-all cursor-pointer border-none">
                Find your first mission <ArrowRight size={15} strokeWidth={2.8} />
              </button>
            </motion.div>
          </div>
        </div>
      </div>
    </Sec>
  );
}

/* ─── Timeline preview ─── */
function TimelineFeed() {
  const posts = [
    {
      initials: 'AO', color: '#22FFAA', name: 'Adeola O.', time: '4m ago',
      badge: 'Paid out ✓', badgeColor: '#22FFAA',
      text: 'Day 30 of the FitLife challenge — done. Just got the $120 payout notification 🎉 Never thought I\'d get paid to work out.',
      earned: '+$120',
    },
    {
      initials: 'MV', color: '#6D5DFD', name: 'Marcus V.', time: 'LIVE',
      badge: '● LIVE', badgeColor: '#ff3b30',
      text: 'On checkpoint 6 of 12 for the Lagos Hidden Spots mission. Just found this unbelievable mural near Balogun. Follow along →',
      viewers: '218 watching',
    },
    {
      initials: 'RM', color: '#a78bfa', name: 'Ryan M.', time: '32m ago',
      badge: 'Score up', badgeColor: '#FFB84D',
      text: 'Hunter Score just crossed 6.0! That unlocks Pro-tier gigs. First one I\'m applying for pays $180. Wild.',
      earned: '+0.8 score',
    },
  ];

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#0A1226', border: '1px solid rgba(255,255,255,.07)', boxShadow: '0 24px 80px rgba(0,0,0,.55)' }}>
      <div style={{ padding: '14px 20px 12px', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 800, color: '#F0F4FF' }}>Live Timeline</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 8, background: '#ff3b30', color: '#fff', fontWeight: 700, fontSize: 11 }}>
          <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.2, repeat: Infinity }} style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} />
          Live now
        </span>
      </div>
      {posts.map((post, i) => (
        <div key={i} style={{ padding: '14px 20px', borderBottom: i < 2 ? '1px solid rgba(255,255,255,.05)' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', flexShrink: 0, background: `${post.color}15`, border: `1px solid ${post.color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: post.color }}>{post.initials}</div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#F0F4FF' }}>{post.name}</span>
              <span style={{ fontSize: 11, color: '#4A5578', marginLeft: 8 }}>{post.time}</span>
            </div>
            <span style={{ fontSize: 10, fontWeight: 800, color: post.badgeColor, background: `${post.badgeColor}15`, border: `1px solid ${post.badgeColor}22`, borderRadius: 8, padding: '2px 8px' }}>{post.badge}</span>
          </div>
          <p style={{ margin: '0 0 8px', fontSize: 12.5, color: '#8B9CC0', lineHeight: 1.55 }}>{post.text}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {'earned' in post && post.earned && (
              <span style={{ fontSize: 11, fontWeight: 700, color: post.color }}>{post.earned}</span>
            )}
            {'viewers' in post && post.viewers && (
              <span style={{ fontSize: 11, color: '#4A5578' }}>{post.viewers}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── PAGE ─── */
export default function RootPage() {
  const [splashOpen, setSplashOpen] = useState(false);
  const openSplash = () => setSplashOpen(true);

  return (
    <div className="bg-[#050816] text-[#F0F4FF] overflow-x-hidden">
      <OnboardingSplash open={splashOpen} onClose={() => setSplashOpen(false)} />

      {/* ─── HERO ─── */}
      <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 opacity-[0.022]" style={{
            backgroundImage: 'linear-gradient(rgba(34,255,170,1) 1px,transparent 1px),linear-gradient(90deg,rgba(34,255,170,1) 1px,transparent 1px)',
            backgroundSize: '52px 52px',
          }} />
          <div className="absolute top-1/2 right-[8%] -translate-y-1/2 w-[600px] h-[600px] bg-[#22FFAA]/5 blur-[140px] rounded-full" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-[#6D5DFD]/4 blur-[100px] rounded-full" />
        </div>

        {/* ─ Hero visual: interactive 3D scene ─ */}
        <motion.div
          initial={{ opacity: 0, x: 60, scale: 0.96 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 1.1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="hidden lg:block absolute right-[-4%] bottom-0 w-[52%] h-[88vh] z-10">
          <Spotlight className="-top-10 left-20" fill="#22FFAA" />
          {/* Ambient glow */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 70% 60% at 55% 50%, rgba(0,200,130,0.18) 0%, rgba(0,120,90,0.07) 50%, transparent 75%)', filter: 'blur(40px)' }} />
          {/* Interactive Spline 3D scene */}
          <SplineScene
            scene="https://prod.spline.design/kZDDjO5HuC9GJUM2/scene.splinecode"
            className="w-full h-full"
          />
          {/* Ground glow */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[420px] h-[80px] rounded-full pointer-events-none"
            style={{ background: 'radial-gradient(ellipse, rgba(34,255,170,.22) 0%, transparent 70%)', filter: 'blur(28px)' }} />
        </motion.div>

        <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 py-20 lg:py-28 w-full">
          <div className="max-w-[620px]">
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2.5 mb-8"
                style={{ background: 'rgba(34,255,170,.06)', border: '1px solid rgba(34,255,170,.15)', borderRadius: 999, padding: '6px 16px' }}>
                <div className="w-1.5 h-1.5 bg-[#22FFAA] rounded-full animate-pulse" />
                <span className="text-[11px] font-semibold text-[#22FFAA] tracking-wider uppercase">Free to start · No followers needed</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }}
                className="text-[clamp(2.8rem,5.5vw,4.8rem)] font-black text-[#F0F4FF] leading-[1.04] tracking-tighter mb-6">
                Brands pay you
                <br />to do real things.
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#22FFAA] to-[#6D5DFD]">
                  AI confirms it.
                </span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.22 }}
                className="text-[1.08rem] text-[#8B9CC0] leading-relaxed max-w-[540px] mb-3">
                Pick a mission — hit the gym, explore your city, try a product.
                Upload your proof. AI validates it in seconds. Escrow releases automatically.
                <strong className="text-[#F0F4FF]"> No followers, no content skills, no pitch decks.</strong>
              </motion.p>

              <motion.p
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
                className="text-[13px] text-[#4A5578] mb-10">
                You just do the thing. We verify it. They pay you.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.38 }}
                className="flex flex-wrap gap-x-8 gap-y-3 mb-12">
                {[
                  { value: '4,200+', label: 'Open missions right now' },
                  { value: '$67', label: 'Average payout per mission' },
                  { value: '94%', label: 'Payout success rate' },
                  { value: '<60s', label: 'Average AI validation time' },
                ].map((m) => (
                  <div key={m.label}>
                    <p className="text-[1.5rem] font-black text-[#F0F4FF] tracking-tight leading-none mb-1">{m.value}</p>
                    <p className="text-[11px] text-[#4A5578]">{m.label}</p>
                  </div>
                ))}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.46 }}
                className="flex flex-wrap gap-3">
                <Link href="/home"
                  className="flex items-center gap-2.5 h-13 px-7 bg-[#22FFAA] text-[#050816] rounded-xl text-[15px] font-bold shadow-[0_0_28px_rgba(34,255,170,0.3)] hover:shadow-[0_0_44px_rgba(34,255,170,0.5)] transition-all duration-200">
                  Find a mission now <ArrowRight size={16} strokeWidth={2.8} />
                </Link>
                <Link href="/missions"
                  className="flex items-center gap-2.5 h-13 px-6 border text-[#8B9CC0] rounded-xl text-[15px] font-semibold hover:text-[#F0F4FF] transition-all duration-200"
                  style={{ background: 'rgba(255,255,255,.04)', borderColor: 'rgba(255,255,255,.09)' }}>
                  See what&apos;s open
                </Link>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.62 }}
                className="mt-5 text-[12px] text-[#4A5578]">
                Already hunting?{' '}
                <Link href="/home" className="text-[#22FFAA] underline underline-offset-2 hover:opacity-80 transition-opacity">
                  Open your dashboard →
                </Link>
              </motion.p>

          </div>
        </div>
      </section>

      {/* ─── SOCIAL PROOF STRIP ─── */}
      <div className="py-6 border-y border-[rgba(255,255,255,.05)]" style={{ background: '#07101F' }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
            {[
              { icon: '🏋️', text: '"Earned $120 just from my gym routine. Wild."' },
              { icon: '📍', text: '"Got paid $75 to explore Lagos. Felt like a game."' },
              { icon: '🥗', text: '"Tried a product I actually liked. Got $75 for it."' },
              { icon: '⭐', text: '"My Hunter Score is 7.1. Brands approach me now."' },
            ].map((q, i) => (
              <div key={i} className="flex items-center gap-2.5 text-[12px] text-[#8B9CC0]">
                <span>{q.icon}</span>
                <span>{q.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── APP MOCKS ─── */}
      <AppMocksSection onCTA={openSplash} />

      {/* ─── HOW IT WORKS ─── */}
      <Sec className="py-24 lg:py-32 border-y border-[rgba(255,255,255,.05)]" style={{ background: '#07101F' }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <motion.p variants={fadeUp} className="text-[11px] font-bold text-[#4A5578] uppercase tracking-widest mb-3">The simple version</motion.p>
            <motion.h2 variants={fadeUp} custom={0.06} className="text-[clamp(1.9rem,3.5vw,2.8rem)] font-black text-[#F0F4FF] leading-tight tracking-tight">
              How X-Hunt works in plain English.
            </motion.h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
            {[
              {
                step: '01', icon: '🗺️', color: '#22FFAA',
                title: 'A brand posts a mission',
                body: 'FitLife wants people to complete a 7-day workout streak. They post a mission, lock $45 per person into escrow, and wait for hunters.',
                note: 'Brands pay upfront. You never have to chase anyone.',
              },
              {
                step: '02', icon: '✅', color: '#6D5DFD',
                title: 'You accept it and do it',
                body: 'You browse missions, accept one that fits your life, and actually do it. GPS tracks your location. You upload photos or logs as evidence.',
                note: 'The app walks you through every step. No guessing.',
              },
              {
                step: '03', icon: '💸', color: '#FFB84D',
                title: 'AI validates. You get paid.',
                body: 'Our AI checks your evidence automatically — usually under 60 seconds. If it checks out, escrow releases. Money goes straight to your wallet.',
                note: 'No humans reviewing. No waiting 30 days. No disputes.',
              },
            ].map((item, i) => (
              <motion.div key={item.step} variants={fadeUp} custom={i * 0.1}
                className="rounded-2xl p-7 border"
                style={{ background: '#0A1226', borderColor: `${item.color}18` }}>
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-[11px] font-black tabular-nums" style={{ color: item.color }}>{item.step}</span>
                  <span className="text-[28px]">{item.icon}</span>
                </div>
                <h3 className="text-[17px] font-bold text-[#F0F4FF] mb-3">{item.title}</h3>
                <p className="text-[13px] text-[#8B9CC0] leading-relaxed mb-4">{item.body}</p>
                <p className="text-[11px] font-semibold italic" style={{ color: item.color }}>{item.note}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </Sec>

      {/* ─── NEARBY GIGS ─── */}
      <Sec className="py-28 lg:py-36 border-y border-[rgba(255,255,255,0.05)]" style={{ background: '#050816' }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-14 lg:gap-20 items-center">
            <div>
              <motion.p variants={fadeUp} className="text-[11px] font-bold text-[#4A5578] uppercase tracking-widest mb-3">
                Work near you, right now
              </motion.p>
              <motion.h2 variants={fadeUp} custom={0.06}
                className="text-[clamp(1.9rem,3.5vw,2.8rem)] font-black text-[#F0F4FF] leading-tight tracking-tight mb-5">
                The app brings paid gigs
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#22FFAA] to-[#6D5DFD]">
                  to wherever you are.
                </span>
              </motion.h2>
              <motion.p variants={fadeUp} custom={0.12}
                className="text-[14px] text-[#8B9CC0] leading-relaxed mb-8">
                X-Hunt uses your location to surface paid missions nearby — right now, in your city. Going to the gym? There&apos;s probably a fitness brand paying for that. Exploring a neighbourhood? A tourism brand might want your photos. You don&apos;t find the work. The work finds you.
              </motion.p>
              <div className="flex flex-col gap-3">
                {[
                  { icon: MapPin, title: 'GPS confirms you were actually there', body: 'Every location-based mission validates your presence — no faking it, no disputes.' },
                  { icon: Zap, title: 'New gigs appear as you move', body: 'As you go about your day, relevant paid opportunities surface based on where you are right now.' },
                  { icon: Shield, title: 'Works even with bad signal', body: 'Mission clues and checkpoints cache locally so your work isn\'t interrupted in the field.' },
                ].map((f, i) => (
                  <motion.div key={f.title} variants={fadeUp} custom={0.18 + i * 0.07}
                    className="flex items-start gap-4 p-4 rounded-xl border"
                    style={{ background: 'rgba(255,255,255,.02)', borderColor: 'rgba(255,255,255,.06)' }}>
                    <f.icon size={16} strokeWidth={1.8} className="flex-shrink-0 mt-0.5" style={{ color: '#22FFAA' }} />
                    <div>
                      <p className="text-[13px] font-bold text-[#F0F4FF] mb-1">{f.title}</p>
                      <p className="text-[12px] text-[#8B9CC0] leading-relaxed">{f.body}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Radar visualisation */}
            <motion.div variants={fadeUp} custom={0.16}
              className="relative flex items-center justify-center"
              style={{ minHeight: 480 }}>
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(34,255,170,0.07) 0%, transparent 70%)' }} />
              <div className="absolute top-[12%] left-[8%] z-50">
                <IconContainer icon={<Dumbbell size={20} strokeWidth={1.8} className="text-[#22FFAA]" />} text="Fitness" delay={0.3} />
              </div>
              <div className="absolute top-[10%] right-[10%] z-50">
                <IconContainer icon={<UtensilsCrossed size={20} strokeWidth={1.8} className="text-[#FFB84D]" />} text="Food" delay={0.5} />
              </div>
              <div className="absolute top-[42%] left-[2%] z-50">
                <IconContainer icon={<Trees size={20} strokeWidth={1.8} className="text-[#6D5DFD]" />} text="Outdoors" delay={0.7} />
              </div>
              <div className="absolute top-[40%] right-[2%] z-50">
                <IconContainer icon={<Laptop size={20} strokeWidth={1.8} className="text-[#a78bfa]" />} text="Tech" delay={0.9} />
              </div>
              <div className="absolute bottom-[12%] left-[10%] z-50">
                <IconContainer icon={<MapPin size={20} strokeWidth={1.8} className="text-[#22FFAA]" />} text="Explore" delay={1.1} />
              </div>
              <div className="absolute bottom-[10%] right-[8%] z-50">
                <IconContainer icon={<Zap size={20} strokeWidth={1.8} className="text-[#FFB84D]" />} text="Quick Gig" delay={1.3} />
              </div>
              <Radar className="h-[380px] w-[380px]" />
            </motion.div>
          </div>
        </div>
      </Sec>

      {/* ─── TRUST ─── */}
      <Sec className="py-24 lg:py-32 border-y border-[rgba(255,255,255,.05)]" style={{ background: '#050816' }}>
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <motion.p variants={fadeUp} className="text-[11px] font-bold text-[#4A5578] uppercase tracking-widest mb-3">Why it works</motion.p>
            <motion.h2 variants={fadeUp} custom={0.06} className="text-[clamp(1.9rem,3.5vw,2.8rem)] font-black text-[#F0F4FF] leading-tight tracking-tight">
              We built the boring parts
              <br />so you just have to show up.
            </motion.h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
            {[
              { icon: Wallet, color: '#22FFAA', title: 'Money locked before you start', desc: 'Brands deposit the reward into escrow before your mission goes live. You can see the balance before you accept. No one can pull it back once you\'ve started.' },
              { icon: Zap, color: '#6D5DFD', title: 'AI review in seconds, not days', desc: 'Photo analysis, GPS verification, timestamp checking — all automated. You submit evidence at 11pm and it\'s validated before you wake up.' },
              { icon: Star, color: '#FFB84D', title: 'Your score is yours forever', desc: 'Hunter Score follows you across every brand, every category, every platform version. It\'s your verified track record, not a follower count.' },
              { icon: Shield, color: '#a78bfa', title: 'Tamper-proof evidence chain', desc: 'Every submission, validation decision, and payment record is logged immutably. If there\'s a dispute, there\'s a trail. No he-said-she-said.' },
              { icon: Users, color: '#22FFAA', title: 'Missions match your level', desc: 'Just starting? Free missions to build your score. Proven track record? Enterprise contracts. The gigs always match where you actually are.' },
              { icon: TrendingUp, color: '#6D5DFD', title: 'Getting harder as you grow', desc: 'The AI adapts mission difficulty to your current score. You never plateau. Elite hunters work to tighter standards and earn proportionally more.' },
            ].map((item, i) => (
              <motion.div key={item.title} variants={fadeUp} custom={i * 0.07}
                className="rounded-2xl p-6 border transition-all hover:border-[rgba(255,255,255,.1)] cursor-default"
                style={{ background: '#0A1226', borderColor: `${item.color}15` }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5" style={{ background: `${item.color}10` }}>
                  <item.icon size={20} strokeWidth={1.8} style={{ color: item.color }} />
                </div>
                <p className="text-[14px] font-bold text-[#F0F4FF] mb-2">{item.title}</p>
                <p className="text-[12.5px] text-[#8B9CC0] leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </Sec>

      {/* ─── CTA ─── */}
      <Sec className="py-24 lg:py-32 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 right-0 -translate-y-1/2 w-[500px] h-[500px] bg-[#22FFAA]/4 blur-[120px] rounded-full" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#050816] via-[#050816]/80 to-transparent" />
        </div>
        <div className="relative z-10 max-w-3xl mx-auto px-5 sm:px-6 lg:px-8 text-left">
          <motion.p variants={fadeUp} className="text-[11px] font-bold text-[#4A5578] uppercase tracking-widest mb-5">Ready to start?</motion.p>
          <motion.h2 variants={fadeUp} custom={0.07}
            className="text-[clamp(2.2rem,5vw,3.8rem)] font-black text-[#F0F4FF] leading-[1.04] tracking-tighter mb-5">
            What are you doing this week
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#22FFAA] to-[#6D5DFD]">that someone would pay for?</span>
          </motion.h2>
          <motion.p variants={fadeUp} custom={0.14} className="text-[15px] text-[#8B9CC0] max-w-[480px] mb-3">
            Seriously — going to the gym, exploring new places, trying new products. There&apos;s probably a brand willing to pay you for that right now.
          </motion.p>
          <motion.p variants={fadeUp} custom={0.2} className="text-[12px] text-[#4A5578] mb-10">
            Free to join · No credit card · First mission generated in under 15 seconds
          </motion.p>
          <motion.div variants={fadeUp} custom={0.26} className="flex flex-col sm:flex-row gap-3 justify-start">
            <Link href="/home"
              className="flex items-center justify-center gap-2.5 h-13 px-8 bg-[#22FFAA] text-[#050816] rounded-xl text-[15px] font-bold shadow-[0_0_32px_rgba(34,255,170,0.3)] hover:shadow-[0_0_48px_rgba(34,255,170,0.5)] transition-all">
              Start hunting free <ArrowRight size={16} strokeWidth={2.8} />
            </Link>
            <Link href="/enterprise"
              className="flex items-center justify-center gap-2.5 h-13 px-7 border text-[#8B9CC0] rounded-xl text-[15px] font-semibold hover:text-[#F0F4FF] transition-all"
              style={{ background: 'rgba(255,255,255,.04)', borderColor: 'rgba(255,255,255,.09)' }}>
              Post a mission as a brand <ChevronRight size={15} strokeWidth={2.5} />
            </Link>
          </motion.div>
        </div>
      </Sec>
    </div>
  );
}
