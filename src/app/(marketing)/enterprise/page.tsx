'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import {
  ArrowRight, Shield, BarChart3, Brain, Users, Lock,
  ChevronRight, Building2, Zap, Globe, FileCheck, TrendingUp, Layers,
} from 'lucide-react';
import { cn } from '@/lib/cn';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (d = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" as const, delay: d } }),
};

function Sec({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <motion.section ref={ref} initial="hidden" animate={inView ? 'visible' : 'hidden'} className={className}>
      {children}
    </motion.section>
  );
}

const MODULES = [
  {
    title: 'Mission Studio',
    desc: 'Design, configure, and publish missions at scale. Rich templates, branching logic, AI-assisted authoring, and a no-code visual editor.',
    icon: Layers,
    color: 'accent',
    caps: ['Visual mission builder', 'AI-assisted authoring', 'Template library', 'Branching logic'],
  },
  {
    title: 'Mission Control',
    desc: 'Real-time orchestration hub. Monitor every active mission, track participant progress, and intervene with intelligent nudges.',
    icon: Zap,
    color: 'ai',
    caps: ['Live mission dashboard', 'AI intervention engine', 'Cohort management', 'Real-time alerts'],
  },
  {
    title: 'AI Agent Suite',
    desc: 'Six specialised AI agents handle architecture, behaviour analysis, outcome planning, and knowledge delivery automatically.',
    icon: Brain,
    color: 'accent',
    caps: ['Mission Architect', 'Behavioral Analyst', 'Insight Analyst', 'Knowledge Agent'],
  },
  {
    title: 'Outcome Analytics',
    desc: 'The Mission Effectiveness Index, cohort analysis, comparative outcomes, and exportable ROI reports for stakeholders.',
    icon: BarChart3,
    color: 'ai',
    caps: ['MEI dashboards', 'Cohort analytics', 'ROI reporting', 'Custom exports'],
  },
  {
    title: 'Governance & Compliance',
    desc: 'Multi-tenant isolation, role-based access control, approval workflows, audit trails, and GDPR / SOC 2 tooling built in.',
    icon: Shield,
    color: 'accent',
    caps: ['RBAC permissions', 'Approval workflows', 'Full audit trail', 'Data residency'],
  },
  {
    title: 'Audience Intelligence',
    desc: 'Segment participants by role, behaviour, performance, and demographics. Personalise missions at the individual level.',
    icon: Users,
    color: 'ai',
    caps: ['Smart segmentation', 'Behavioural profiling', 'Dynamic personalisation', 'Predictive cohorts'],
  },
];

const USE_CASES = [
  {
    icon: '🚀',
    title: 'Employee Onboarding',
    metric: '40% faster time-to-productivity',
    desc: 'Transform day-one docs into guided missions that build capability through real tasks, not passive consumption.',
  },
  {
    icon: '📚',
    title: 'Learning & Development',
    metric: '94% knowledge application rate',
    desc: 'Replace completion-rate thinking with outcome intelligence. Measure whether learning actually changes behaviour.',
  },
  {
    icon: '🎯',
    title: 'Customer Success',
    metric: '3× faster product adoption',
    desc: 'Guide customers through their first-value moments with adaptive mission sequences tied to subscription outcomes.',
  },
  {
    icon: '💡',
    title: 'Innovation Programs',
    metric: '2.8× more ideas actioned',
    desc: 'Run structured innovation sprints where participants complete discovery missions that surface high-value insights.',
  },
  {
    icon: '🌱',
    title: 'Sustainability',
    metric: '62% behaviour change rate',
    desc: 'Drive measurable ESG outcomes with missions that translate sustainability commitments into daily employee actions.',
  },
  {
    icon: '🤝',
    title: 'Partner Enablement',
    metric: '55% reduction in support tickets',
    desc: 'Certify partners through guided missions that build real capability, verified through outcome-based assessments.',
  },
  {
    icon: '🌍',
    title: 'Community Development',
    metric: '3× participant follow-through',
    desc: 'NGOs and civic programs use X-Hunt missions to mobilise communities around real-world goals — from health drives to neighbourhood clean-ups, all with verified completion.',
  },
  {
    icon: '⚖️',
    title: 'Social Accountability',
    metric: 'Tamper-proof evidence chain',
    desc: 'Public sector and social enterprises can deploy missions that require GPS-verified proof of delivery — ensuring aid, services, and initiatives actually reach their intended recipients.',
  },
  {
    icon: '🌱',
    title: 'Impact & ESG Programs',
    metric: '62% sustained behaviour change',
    desc: 'Translate sustainability commitments into verified daily actions. Participants complete environmental missions and earn impact badges — creating auditable ESG evidence for stakeholders.',
  },
];

const TRUST_SIGNALS = [
  { icon: Shield, label: 'SOC 2 Type II', sub: 'Certified' },
  { icon: Globe, label: 'GDPR', sub: 'Compliant' },
  { icon: Lock, label: 'SSO / SAML', sub: 'Enterprise auth' },
  { icon: FileCheck, label: 'Audit Logs', sub: 'Full trail' },
  { icon: Building2, label: 'Multi-tenant', sub: 'Isolation' },
  { icon: TrendingUp, label: '99.9% SLA', sub: 'Uptime guarantee' },
];

export default function EnterprisePage() {
  return (
    <div className="bg-muted text-txt overflow-x-hidden">
      {/* ── HERO ── */}
      <section className="relative pt-28 pb-20 lg:pt-36 lg:pb-28 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-[800px] h-[600px] bg-ai/4 blur-[120px] rounded-full" />
          <div
            className="absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage: 'linear-gradient(rgba(109,93,253,1) 1px, transparent 1px), linear-gradient(90deg, rgba(109,93,253,1) 1px, transparent 1px)',
              backgroundSize: '56px 56px',
            }}
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
          <div className="max-w-[720px]">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="inline-flex items-center gap-2 bg-ai/8 border border-ai/20 rounded-full px-3.5 py-1.5 mb-8"
            >
              <Building2 size={12} className="text-ai" strokeWidth={2.5} />
              <span className="text-[12px] font-semibold text-ai tracking-wide">Enterprise Platform</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08 }}
              className="text-[clamp(2.5rem,5.5vw,4.5rem)] font-black text-txt leading-[1.04] tracking-tighter mb-6"
            >
              The Mission OS for
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-ai to-ai-dark">
                enterprise outcomes.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.18 }}
              className="text-[1.1rem] text-txt-dim leading-relaxed max-w-[580px] mb-10"
            >
              A full-stack platform for workforce transformation, customer engagement,
              and measurable behavioural outcomes — governed, compliant, and built for scale.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.28 }}
              className="flex flex-wrap gap-3"
            >
              <Link
                href="/enterprise/sign-up"
                className="flex items-center gap-2 h-13 px-7 bg-ai text-[#050816] rounded-xl text-[15px] font-bold shadow-[0_0_28px_rgba(109,93,253,0.3)] hover:shadow-[0_0_40px_rgba(109,93,253,0.45)] transition-all"
              >
                Create Enterprise Account
                <ArrowRight size={16} strokeWidth={2.8} />
              </Link>
              <Link
                href="/enterprise/sign-in"
                className="flex items-center gap-2 h-13 px-6 bg-[rgba(34,255,170,0.06)] border border-[rgba(34,255,170,0.15)] text-accent rounded-xl text-[15px] font-semibold hover:bg-[rgba(34,255,170,0.1)] transition-all"
              >
                Enterprise Sign In
                <ChevronRight size={15} strokeWidth={2.5} />
              </Link>
              <Link
                href="/use-cases"
                className="flex items-center gap-2 h-13 px-6 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] text-txt rounded-xl text-[15px] font-semibold hover:bg-[rgba(255,255,255,0.08)] transition-all"
              >
                View Use Cases
                <ChevronRight size={15} strokeWidth={2.5} />
              </Link>
            </motion.div>
          </div>

          {/* Enterprise stat strip */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.4 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 lg:mt-20"
          >
            {[
              { n: '500+', label: 'Enterprise clients', sub: 'Across 42 countries' },
              { n: '94%', label: 'Outcome attainment', sub: 'Average across deployments' },
              { n: '4.7×', label: 'Average ROI', sub: 'On mission programmes' },
              { n: '40%', label: 'Faster onboarding', sub: 'vs traditional methods' },
            ].map((s) => (
              <div key={s.n} className="bg-card border border-[rgba(255,255,255,0.07)] rounded-xl p-5">
                <p className="text-[2rem] font-black text-txt tracking-tighter tabular-nums">{s.n}</p>
                <p className="text-[13px] font-semibold text-txt mt-0.5">{s.label}</p>
                <p className="text-[11px] text-txt-faint mt-0.5">{s.sub}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── PLATFORM MODULES ── */}
      <Sec className="py-24 lg:py-32 bg-[#050816] border-y border-[rgba(255,255,255,0.05)]">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <motion.p variants={fadeUp} className="text-[12px] font-bold text-ai uppercase tracking-widest mb-3">
              Platform Architecture
            </motion.p>
            <motion.h2 variants={fadeUp} custom={0.06} className="text-[clamp(1.9rem,3.8vw,3rem)] font-black text-txt leading-tight tracking-tight">
              Everything you need to run
              <br />
              mission programs at scale.
            </motion.h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {MODULES.map((mod, i) => (
              <motion.div
                key={mod.title}
                variants={fadeUp}
                custom={i * 0.07}
                className="bg-card border border-[rgba(255,255,255,0.07)] rounded-2xl p-6 hover:border-[rgba(255,255,255,0.12)] transition-all duration-300"
              >
                <div className={cn(
                  'w-11 h-11 rounded-xl flex items-center justify-center mb-4',
                  mod.color === 'accent' ? 'bg-accent/10' : 'bg-ai/10',
                )}>
                  <mod.icon size={22} strokeWidth={1.8} className={mod.color === 'accent' ? 'text-accent' : 'text-ai'} />
                </div>
                <p className="text-[15px] font-bold text-txt mb-2">{mod.title}</p>
                <p className="text-[13px] text-txt-dim leading-relaxed mb-5">{mod.desc}</p>
                <div className="flex flex-wrap gap-1.5">
                  {mod.caps.map((c) => (
                    <span key={c} className={cn(
                      'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                      mod.color === 'accent' ? 'bg-accent/8 text-accent/80' : 'bg-ai/8 text-ai/80',
                    )}>
                      {c}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </Sec>

      {/* ── USE CASES ── */}
      <Sec className="py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <motion.p variants={fadeUp} className="text-[12px] font-bold text-accent uppercase tracking-widest mb-3">
              Use Cases
            </motion.p>
            <motion.h2 variants={fadeUp} custom={0.06} className="text-[clamp(1.9rem,3.8vw,3rem)] font-black text-txt leading-tight tracking-tight">
              Proven outcomes across
              <br />
              every enterprise function.
            </motion.h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {USE_CASES.map((uc, i) => (
              <motion.div
                key={uc.title}
                variants={fadeUp}
                custom={i * 0.08}
                className="bg-card border border-[rgba(255,255,255,0.07)] rounded-2xl p-6 hover:border-accent/15 transition-all duration-300"
              >
                <span className="text-3xl mb-4 block">{uc.icon}</span>
                <p className="text-[14px] font-bold text-txt mb-1">{uc.title}</p>
                <span className="inline-block text-[10px] font-bold text-accent bg-accent/8 px-2 py-0.5 rounded-full mb-3">
                  {uc.metric}
                </span>
                <p className="text-[12px] text-txt-dim leading-relaxed">{uc.desc}</p>
              </motion.div>
            ))}
          </div>

          <motion.div variants={fadeUp} custom={0.5} className="flex justify-center mt-10">
            <Link
              href="/use-cases"
              className="flex items-center gap-2 text-[13px] font-semibold text-ai hover:text-ai-dark transition-colors"
            >
              Explore all use cases
              <ChevronRight size={15} strokeWidth={2.5} />
            </Link>
          </motion.div>
        </div>
      </Sec>

      {/* ── SECURITY ── */}
      <Sec className="py-20 lg:py-28 bg-[#050816] border-y border-[rgba(255,255,255,0.05)]">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <motion.p variants={fadeUp} className="text-[12px] font-bold text-txt-faint uppercase tracking-widest mb-3">
              Enterprise Grade
            </motion.p>
            <motion.h2 variants={fadeUp} custom={0.06} className="text-[clamp(1.8rem,3.5vw,2.8rem)] font-black text-txt leading-tight tracking-tight">
              Security and compliance
              <br />
              built for enterprise.
            </motion.h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {TRUST_SIGNALS.map((t, i) => (
              <motion.div
                key={t.label}
                variants={fadeUp}
                custom={i * 0.06}
                className="bg-card border border-[rgba(255,255,255,0.07)] rounded-2xl p-5 flex flex-col items-center text-center"
              >
                <div className="w-10 h-10 bg-accent/8 rounded-xl flex items-center justify-center mb-3">
                  <t.icon size={18} strokeWidth={1.8} className="text-accent" />
                </div>
                <p className="text-[13px] font-bold text-txt">{t.label}</p>
                <p className="text-[11px] text-txt-faint mt-0.5">{t.sub}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </Sec>

      {/* ── CTA ── */}
      <Sec className="py-24 lg:py-32">
        <div className="max-w-3xl mx-auto px-5 sm:px-6 lg:px-8 text-center">
          <motion.h2
            variants={fadeUp}
            className="text-[clamp(2rem,4.5vw,3.5rem)] font-black text-txt leading-[1.05] tracking-tighter mb-6"
          >
            Ready to deploy the
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-ai to-ai-dark">
              Mission OS?
            </span>
          </motion.h2>
          <motion.p variants={fadeUp} custom={0.08} className="text-[1rem] text-txt-dim mb-10 max-w-[420px] mx-auto">
            Our enterprise team will design a deployment strategy tailored to your outcomes and
            organisation. No generic demos — just your use case.
          </motion.p>
          <motion.div variants={fadeUp} custom={0.16} className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/enterprise/sign-up"
              className="flex items-center justify-center gap-2 h-13 px-8 bg-ai text-[#050816] rounded-xl text-[15px] font-bold shadow-[0_0_28px_rgba(109,93,253,0.3)] hover:shadow-[0_0_40px_rgba(109,93,253,0.45)] transition-all"
            >
              Create Enterprise Account
              <ArrowRight size={16} strokeWidth={2.8} />
            </Link>
            <Link
              href="/pricing"
              className="flex items-center justify-center gap-2 h-13 px-7 bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] text-txt rounded-xl text-[15px] font-semibold hover:bg-[rgba(255,255,255,0.08)] transition-all"
            >
              View Enterprise Pricing
              <ChevronRight size={15} strokeWidth={2.5} />
            </Link>
          </motion.div>
        </div>
      </Sec>
    </div>
  );
}
