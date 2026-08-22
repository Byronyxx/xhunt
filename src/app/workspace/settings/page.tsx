'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Settings, Building2, Users, Shield, Palette, Bell,
  Save, Check, AlertCircle, Key, Loader2,
  Trash2, UserPlus, Mail, ShieldCheck, RefreshCw,
  Server, Lock, Unlock, ChevronRight, Sliders,
  Sun, Moon, Upload, Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import ThemeToggle from '@/components/ThemeToggle';
import type { DbTenant, DbUserProfile } from '@/lib/supabase/types';
import type { TenantFeatureConfig, MaturityTier, NavFlags, FeatureToggles } from '@/lib/features';
import { MATURITY_DEFAULTS, getDefaultConfig, mergeFeatureConfig } from '@/lib/features';

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('bg-[#0D1530] animate-pulse rounded-lg', className)} />;
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        'relative w-9 h-5 rounded-full transition-all flex-shrink-0',
        on ? 'bg-accent' : 'bg-[#0D1530] border border-[#162440]'
      )}
    >
      <span className={cn(
        'absolute top-0.5 w-4 h-4 rounded-full transition-all',
        on ? 'right-0.5 bg-[#060a0e]' : 'left-0.5 bg-[#4A5578]'
      )} />
    </button>
  );
}

interface SsoConfig {
  id: string;
  tenant_id: string;
  provider_type: string;
  display_name: string;
  is_enabled: boolean;
  is_default: boolean;
  config: Record<string, string>;
  last_tested_at: string | null;
  login_count: number;
}

const SSO_PROVIDERS = [
  { id: 'microsoft_entra', label: 'Microsoft Entra ID', icon: '🔷', protocol: 'oidc' },
  { id: 'google_workspace', label: 'Google Workspace',  icon: '🔵', protocol: 'oidc' },
  { id: 'okta',            label: 'Okta',               icon: '🔶', protocol: 'saml' },
  { id: 'saml',            label: 'Generic SAML 2.0',   icon: '🔒', protocol: 'saml' },
  { id: 'oidc',            label: 'Generic OIDC',       icon: '🔑', protocol: 'oidc' },
] as const;

const TABS = [
  { id: 'organization',   label: 'Organization',  icon: Building2 },
  { id: 'features',       label: 'Features',      icon: Sliders   },
  { id: 'users',          label: 'Users & Roles', icon: Users     },
  { id: 'security',       label: 'Security',      icon: Shield    },
  { id: 'branding',       label: 'Branding',      icon: Palette   },
  { id: 'notifications',  label: 'Notifications', icon: Bell      },
] as const;

type Tab = (typeof TABS)[number]['id'];

const ROLE_OPTIONS = [
  { value: 'tenant_admin',    label: 'Admin',       desc: 'Full workspace access' },
  { value: 'mission_creator', label: 'Creator',     desc: 'Create and manage missions' },
  { value: 'analyst',         label: 'Analyst',     desc: 'View analytics and reports' },
  { value: 'participant',     label: 'Participant', desc: 'Access and complete missions' },
];

const MATURITY_OPTIONS: { value: MaturityTier; label: string; desc: string; color: string }[] = [
  { value: 'starter',    label: 'Starter',    desc: 'Core mission tools. Best for new teams getting started.', color: '#8B9CC0' },
  { value: 'growth',     label: 'Growth',     desc: 'Analytics, AI agents, audience engagement + marketplace.', color: '#22FFAA' },
  { value: 'enterprise', label: 'Enterprise', desc: 'Full platform: XIL, Economy Protocol, governance + API access.', color: '#6D5DFD' },
];

const NAV_FEATURE_LABELS: Record<keyof NavFlags, string> = {
  outcomes:      'Outcomes',
  analytics:     'Analytics',
  agents:        'AI Agents',
  knowledgeGraph:'Knowledge Graph',
  xilHub:        'XIL Hub',
  economy:       'Economy Protocol',
  audience:      'Audience',
  rewards:       'Rewards',
  marketplace:   'Marketplace',
  governance:    'Governance',
  developers:    'Developer Portal',
};

const FEATURE_LABELS: Record<keyof FeatureToggles, { label: string; desc: string; tier: MaturityTier }> = {
  advancedAnalytics: { label: 'Advanced Analytics',    desc: 'Cohort analysis, funnels and custom reports',            tier: 'growth' },
  customAgents:      { label: 'Custom AI Agents',      desc: 'Build and configure domain-specific agents',             tier: 'growth' },
  marketplace:       { label: 'Marketplace Access',    desc: 'List and discover missions in the marketplace',          tier: 'growth' },
  knowledgeGraph:    { label: 'Knowledge Graph',        desc: 'AI-powered knowledge network and discovery',             tier: 'enterprise' },
  xilIntelligence:   { label: 'XIL Intelligence',      desc: 'Full XIL orchestration and constitutional AI',           tier: 'enterprise' },
  economyProtocol:   { label: 'Economy Protocol',      desc: 'Token-based rewards, trust scores and value exchange',   tier: 'enterprise' },
  governance:        { label: 'Governance Module',     desc: 'Constitutional AI oversight and audit trail',            tier: 'enterprise' },
  apiAccess:         { label: 'API Access',            desc: 'Programmatic access via REST API and webhooks',          tier: 'enterprise' },
  whiteLabel:        { label: 'White Label',           desc: 'Custom branding, logo, colors and domain',               tier: 'enterprise' },
  sso:               { label: 'Single Sign-On',        desc: 'SAML 2.0 / OIDC enterprise identity provider',          tier: 'enterprise' },
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('organization');
  const [tenant, setTenant] = useState<DbTenant | null>(null);
  const [users, setUsers] = useState<DbUserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [orgName, setOrgName] = useState('');
  const [orgSlug, setOrgSlug] = useState('');
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('participant');
  const [currentUserId, setCurrentUserId] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [ssoConfigs, setSsoConfigs] = useState<SsoConfig[]>([]);
  const [ssoSaving, setSsoSaving] = useState(false);
  const [ssoTesting, setSsoTesting] = useState<string | null>(null);
  const [activeSsoProvider, setActiveSsoProvider] = useState<string>('microsoft_entra');
  const [ssoForm, setSsoForm] = useState({ displayName: '', entityId: '', ssoUrl: '', certificate: '', clientId: '', issuerUrl: '' });

  // Feature config
  const [featureConfig, setFeatureConfig] = useState<TenantFeatureConfig | null>(null);
  const [featureSaving, setFeatureSaving] = useState(false);
  const [featureSaved, setFeatureSaved] = useState(false);

  // Branding
  const [logoUploading, setLogoUploading] = useState(false);
  const [primaryColor, setPrimaryColor] = useState('#22FFAA');
  const [accentColor, setAccentColor] = useState('#6D5DFD');
  const [appName, setAppName] = useState('');
  const [brandSaved, setBrandSaved] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/workspace/settings');
        if (!res.ok) return;
        const data = await res.json();

        setCurrentUserId(data.currentUserId ?? '');
        setTenantId(data.tenantId ?? '');

        if (data.tenant) {
          setTenant(data.tenant);
          setOrgName(data.tenant.name);
          setOrgSlug(data.tenant.slug);
        }
        setUsers(data.users ?? []);
        if (data.ssoConfigs?.length > 0) {
          setSsoConfigs(data.ssoConfigs as SsoConfig[]);
          setSsoEnabled(data.ssoConfigs.some((c: SsoConfig) => c.is_enabled));
        }

        // Load feature config
        const featRes = await fetch('/api/workspace/features');
        if (featRes.ok) {
          const cfg = await featRes.json() as TenantFeatureConfig;
          setFeatureConfig(cfg);
          if (cfg.branding.primaryColor) setPrimaryColor(cfg.branding.primaryColor);
          if (cfg.branding.accentColor) setAccentColor(cfg.branding.accentColor);
          if (cfg.branding.appName) setAppName(cfg.branding.appName);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveOrg() {
    if (!tenant) return;
    setSaving(true);
    try {
      const res = await fetch('/api/workspace/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: orgName.trim(), slug: orgSlug.trim() }),
      });
      if (res.ok) {
        setTenant((prev) => prev ? { ...prev, name: orgName, slug: orgSlug } : prev);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveFeatureConfig() {
    if (!featureConfig) return;
    setFeatureSaving(true);
    try {
      await fetch('/api/workspace/features', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(featureConfig),
      });
      setFeatureSaved(true);
      setTimeout(() => setFeatureSaved(false), 2500);
    } finally {
      setFeatureSaving(false);
    }
  }

  function applyMaturityPreset(tier: MaturityTier) {
    const base = getDefaultConfig(tenant?.plan ?? 'starter');
    const preset = MATURITY_DEFAULTS[tier];
    setFeatureConfig((prev) => mergeFeatureConfig(prev ?? base, { maturity: tier, nav: preset.nav, features: preset.features }));
  }

  function toggleNavFlag(flag: keyof NavFlags) {
    setFeatureConfig((prev) => {
      if (!prev) return prev;
      return { ...prev, nav: { ...prev.nav, [flag]: !prev.nav[flag] } };
    });
  }

  function toggleFeatureFlag(flag: keyof FeatureToggles) {
    setFeatureConfig((prev) => {
      if (!prev) return prev;
      return { ...prev, features: { ...prev.features, [flag]: !prev.features[flag] } };
    });
  }

  async function saveBranding() {
    if (!featureConfig) return;
    setLogoUploading(true);
    try {
      const updated: TenantFeatureConfig = {
        ...featureConfig,
        branding: {
          ...featureConfig.branding,
          primaryColor: primaryColor || null,
          accentColor: accentColor || null,
          appName: appName.trim() || null,
        },
      };
      await fetch('/api/workspace/features', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branding: updated.branding }),
      });
      setFeatureConfig(updated);
      // Apply colors immediately
      document.documentElement.style.setProperty('--color-accent', primaryColor);
      document.documentElement.style.setProperty('--color-ai', accentColor);
      setBrandSaved(true);
      setTimeout(() => setBrandSaved(false), 2500);
    } finally {
      setLogoUploading(false);
    }
  }

  async function handleLogoUpload(e: { target: { files: FileList | null } }) {
    const file = e.target.files?.[0];
    if (!file || !tenantId) return;
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/workspace/settings/branding/logo', { method: 'POST', body: formData });
      if (res.ok) {
        const { url } = await res.json();
        await fetch('/api/workspace/features', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ branding: { ...featureConfig?.branding, logoUrl: url } }),
        });
        setFeatureConfig((prev) => prev ? { ...prev, branding: { ...prev.branding, logoUrl: url } } : prev);
      }
    } finally {
      setLogoUploading(false);
    }
  }

  async function saveSsoConfig() {
    if (!tenantId) return;
    setSsoSaving(true);
    try {
      const isSaml = ['saml', 'microsoft_entra', 'okta'].includes(activeSsoProvider);
      const config = isSaml
        ? { entity_id: ssoForm.entityId, sso_url: ssoForm.ssoUrl, certificate: ssoForm.certificate }
        : { client_id: ssoForm.clientId, issuer_url: ssoForm.issuerUrl };
      const res = await fetch('/api/workspace/settings/sso', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ providerType: activeSsoProvider, displayName: ssoForm.displayName, config }),
      });
      if (res.ok) {
        const { config: saved } = await res.json();
        if (saved) {
          setSsoConfigs((prev) => [...prev.filter((c) => c.provider_type !== activeSsoProvider), saved as SsoConfig]);
          setSsoEnabled(true);
        }
      }
    } finally {
      setSsoSaving(false);
    }
  }

  async function testSsoConfig(configId: string) {
    setSsoTesting(configId);
    await new Promise((r) => setTimeout(r, 1500));
    setSsoTesting(null);
  }

  async function toggleSsoConfig(configId: string, enabled: boolean) {
    const res = await fetch(`/api/workspace/settings/sso/${configId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    if (res.ok) {
      setSsoConfigs((prev) => prev.map((c) => c.id === configId ? { ...c, is_enabled: enabled } : c));
    }
  }

  async function updateUserRole(userId: string, role: string) {
    const res = await fetch(`/api/workspace/settings/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    if (res.ok) {
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: role as DbUserProfile['role'] } : u));
    }
  }

  const ROLE_LABEL: Record<string, string> = { platform_admin: 'Platform Admin', tenant_admin: 'Admin', mission_creator: 'Creator', analyst: 'Analyst', participant: 'Participant' };
  const ROLE_COLOR: Record<string, string> = { platform_admin: 'text-[#FF5C7A]', tenant_admin: 'text-[#6D5DFD]', mission_creator: 'text-[#FFB84D]', analyst: 'text-[#22FFAA]', participant: 'text-[#8B9CC0]' };

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-6 gap-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 rounded-xl" />)}
        </div>
        <Skeleton className="h-[400px] rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[#8B9CC0]/10 border border-[#8B9CC0]/20 flex items-center justify-center">
          <Settings size={18} className="text-[#8B9CC0]" strokeWidth={1.8} />
        </div>
        <div>
          <h1 className="text-[22px] font-bold text-[#F0F4FF]">Organization Settings</h1>
          <p className="text-[#4A5578] text-[12px]">{tenant?.name} · {tenant?.plan} plan</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 bg-[#0A1226] border border-[#0F1D35] rounded-xl p-1 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold whitespace-nowrap transition-all',
              activeTab === id ? 'bg-[#0D1530] text-[#F0F4FF]' : 'text-[#4A5578] hover:text-[#8B9CC0]'
            )}
          >
            <Icon size={13} strokeWidth={activeTab === id ? 2.2 : 1.8} />
            {label}
          </button>
        ))}
      </div>

      {/* Organization */}
      {activeTab === 'organization' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="bg-[#0A1226] border border-[#0F1D35] rounded-2xl p-6 space-y-5">
            <p className="text-[13px] font-bold text-[#F0F4FF]">Organization Profile</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-[#4A5578] uppercase tracking-wider mb-1.5 block">Organization Name</label>
                <input value={orgName} onChange={(e: { target: { value: string } }) => setOrgName(e.target.value)}
                  className="w-full h-9 px-3 bg-[#07101F] border border-[#0F1D35] rounded-xl text-[13px] text-[#F0F4FF] focus:outline-none focus:border-[#162440]" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#4A5578] uppercase tracking-wider mb-1.5 block">Workspace Slug</label>
                <input value={orgSlug} onChange={(e: { target: { value: string } }) => setOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="w-full h-9 px-3 bg-[#07101F] border border-[#0F1D35] rounded-xl text-[13px] text-[#F0F4FF] focus:outline-none focus:border-[#162440]" />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#4A5578] uppercase tracking-wider mb-1.5 block">Plan</label>
              <div className="flex items-center gap-2">
                <span className="h-9 px-3 bg-[#07101F] border border-[#0F1D35] rounded-xl text-[13px] text-[#8B9CC0] flex items-center capitalize">{tenant?.plan}</span>
                <span className="text-[11px] text-[#4A5578]">→ Upgrade in Billing</span>
              </div>
            </div>
            <div className="flex justify-end">
              <button onClick={saveOrg} disabled={saving}
                className="flex items-center gap-2 h-9 px-4 bg-accent text-[#060a0e] rounded-xl font-semibold text-[13px] disabled:opacity-50">
                {saved ? <><Check size={14} strokeWidth={2.5} />Saved</> : <><Save size={13} strokeWidth={2} />{saving ? 'Saving…' : 'Save Changes'}</>}
              </button>
            </div>
          </div>
          <div className="bg-[#0A1226] border border-[#FF5C7A]/20 rounded-2xl p-5">
            <p className="text-[13px] font-bold text-[#FF5C7A] mb-2">Danger Zone</p>
            <p className="text-[12px] text-[#4A5578] mb-3">Permanently delete your organization and all data. This cannot be undone.</p>
            <button className="flex items-center gap-2 h-8 px-3 bg-[#FF5C7A]/10 border border-[#FF5C7A]/20 text-[#FF5C7A] rounded-xl text-[12px] font-semibold hover:bg-[#FF5C7A]/15 transition-colors">
              <Trash2 size={12} strokeWidth={2} />Delete Organization
            </button>
          </div>
        </motion.div>
      )}

      {/* Features & Adaptive UI */}
      {activeTab === 'features' && featureConfig && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
          {/* Maturity Tier */}
          <div className="bg-[#0A1226] border border-[#0F1D35] rounded-2xl p-5 space-y-4">
            <div>
              <p className="text-[13px] font-bold text-[#F0F4FF]">Workspace Maturity</p>
              <p className="text-[11px] text-[#4A5578] mt-0.5">Controls which features and nav items are shown. Lower tiers hide advanced features to reduce complexity.</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {MATURITY_OPTIONS.map(({ value, label, desc, color }) => (
                <button
                  key={value}
                  onClick={() => applyMaturityPreset(value)}
                  className={cn(
                    'text-left p-4 rounded-xl border transition-all',
                    featureConfig.maturity === value
                      ? 'border-current bg-current/8'
                      : 'border-[#162440] bg-[#07101F] hover:border-[#1c2e4a]'
                  )}
                  style={featureConfig.maturity === value ? { borderColor: color, color } : {}}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={12} strokeWidth={2.5} style={{ color: featureConfig.maturity === value ? color : '#4A5578' }} />
                    <span className="text-[12px] font-bold" style={{ color: featureConfig.maturity === value ? color : '#F0F4FF' }}>{label}</span>
                    {featureConfig.maturity === value && <Check size={11} className="ml-auto" strokeWidth={2.5} style={{ color }} />}
                  </div>
                  <p className="text-[10px] leading-relaxed" style={{ color: '#4A5578' }}>{desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Appearance */}
          <div className="bg-[#0A1226] border border-[#0F1D35] rounded-2xl p-5">
            <p className="text-[13px] font-bold text-[#F0F4FF] mb-4">Appearance</p>
            <div className="flex items-center justify-between py-2 border-b border-[#0F1D35]">
              <div>
                <p className="text-[13px] font-medium text-[#F0F4FF]">Color Theme</p>
                <p className="text-[11px] text-[#4A5578] mt-0.5">Switch between dark and light interface mode</p>
              </div>
              <ThemeToggle onChange={(t) => setFeatureConfig((prev) => prev ? { ...prev, theme: t } : prev)} />
            </div>
          </div>

          {/* Nav Visibility */}
          <div className="bg-[#0A1226] border border-[#0F1D35] rounded-2xl p-5 space-y-3">
            <div>
              <p className="text-[13px] font-bold text-[#F0F4FF]">Navigation Visibility</p>
              <p className="text-[11px] text-[#4A5578] mt-0.5">Show or hide sections in the sidebar. Core sections (Dashboard, Mission Control, Studio) are always visible.</p>
            </div>
            <div className="space-y-1">
              {(Object.keys(NAV_FEATURE_LABELS) as (keyof NavFlags)[]).map((flag) => {
                const on = featureConfig.nav[flag];
                return (
                  <div key={flag} className="flex items-center justify-between py-2 border-b border-[#0F1D35] last:border-0">
                    <span className="text-[13px] text-[#F0F4FF]">{NAV_FEATURE_LABELS[flag]}</span>
                    <Toggle on={on} onToggle={() => toggleNavFlag(flag)} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Feature Toggles */}
          <div className="bg-[#0A1226] border border-[#0F1D35] rounded-2xl p-5 space-y-3">
            <div>
              <p className="text-[13px] font-bold text-[#F0F4FF]">Feature Configuration</p>
              <p className="text-[11px] text-[#4A5578] mt-0.5">Activate or deactivate platform capabilities. Features above your plan tier are locked.</p>
            </div>
            {(Object.keys(FEATURE_LABELS) as (keyof FeatureToggles)[]).map((flag) => {
              const { label, desc, tier } = FEATURE_LABELS[flag];
              const planOrder: MaturityTier[] = ['starter', 'growth', 'enterprise'];
              const currentPlan = (tenant?.plan ?? 'starter') as MaturityTier;
              const isLocked = planOrder.indexOf(tier) > planOrder.indexOf(currentPlan);
              const on = featureConfig.features[flag];
              return (
                <div key={flag} className={cn('flex items-center justify-between py-2.5 border-b border-[#0F1D35] last:border-0', isLocked && 'opacity-50')}>
                  <div className="flex-1 mr-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium text-[#F0F4FF]">{label}</span>
                      <span className={cn(
                        'text-[9px] font-bold px-1.5 py-0.5 rounded-full border uppercase tracking-wide',
                        tier === 'enterprise'
                          ? 'text-[#A99FFE] bg-[#6D5DFD]/10 border-[#6D5DFD]/20'
                          : 'text-[#22FFAA] bg-[#22FFAA]/10 border-[#22FFAA]/20'
                      )}>{tier}</span>
                      {isLocked && <Lock size={10} className="text-[#4A5578]" strokeWidth={2} />}
                    </div>
                    <p className="text-[11px] text-[#4A5578] mt-0.5">{desc}</p>
                  </div>
                  <Toggle on={on && !isLocked} onToggle={() => !isLocked && toggleFeatureFlag(flag)} />
                </div>
              );
            })}
          </div>

          <div className="flex justify-end">
            <button onClick={saveFeatureConfig} disabled={featureSaving}
              className="flex items-center gap-2 h-9 px-5 bg-accent text-[#060a0e] rounded-xl font-semibold text-[13px] disabled:opacity-50">
              {featureSaved ? <><Check size={14} strokeWidth={2.5} />Saved</> : <>{featureSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} strokeWidth={2} />}{featureSaving ? 'Saving…' : 'Save Configuration'}</>}
            </button>
          </div>
        </motion.div>
      )}

      {/* Users & Roles */}
      {activeTab === 'users' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="bg-[#0A1226] border border-[#0F1D35] rounded-2xl p-5">
            <p className="text-[13px] font-bold text-[#F0F4FF] mb-4">Invite Team Member</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="text-[10px] font-bold text-[#4A5578] uppercase tracking-wider mb-1.5 block">Email Address</label>
                <div className="relative">
                  <Mail size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A5578]" strokeWidth={2} />
                  <input value={inviteEmail} onChange={(e: { target: { value: string } }) => setInviteEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    className="w-full h-9 pl-8 pr-3 bg-[#07101F] border border-[#0F1D35] rounded-xl text-[13px] text-[#F0F4FF] placeholder:text-[#4A5578] focus:outline-none focus:border-[#162440]" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#4A5578] uppercase tracking-wider mb-1.5 block">Role</label>
                <select value={inviteRole} onChange={(e: { target: { value: string } }) => setInviteRole(e.target.value)}
                  className="w-full h-9 px-3 bg-[#07101F] border border-[#0F1D35] rounded-xl text-[13px] text-[#F0F4FF] focus:outline-none">
                  {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
            </div>
            <button className="mt-3 flex items-center gap-2 h-8 px-4 bg-accent/10 border border-accent/20 text-accent rounded-xl text-[12px] font-semibold hover:bg-accent/15 transition-colors">
              <UserPlus size={12} strokeWidth={2.5} />Send Invitation
            </button>
          </div>
          <div className="bg-[#0A1226] border border-[#0F1D35] rounded-2xl overflow-hidden">
            <div className="grid px-5 py-3 border-b border-[#0F1D35] bg-[#07101F]" style={{ gridTemplateColumns: '2fr 1fr 1fr 80px' }}>
              {['Member', 'Role', 'Status', 'Actions'].map((h) => (
                <p key={h} className="text-[10px] font-bold text-[#4A5578] uppercase tracking-wider">{h}</p>
              ))}
            </div>
            <div className="divide-y divide-[#0F1D35]">
              {users.map((u) => {
                const ini = (u.display_name ?? 'U').slice(0, 2).toUpperCase();
                return (
                  <div key={u.id} className="grid px-5 py-3.5 items-center" style={{ gridTemplateColumns: '2fr 1fr 1fr 80px' }}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6D5DFD] to-accent flex items-center justify-center text-[10px] font-bold text-[#060a0e] flex-shrink-0">
                        {ini}
                      </div>
                      <div>
                        <p className="text-[13px] font-medium text-[#F0F4FF]">{u.display_name ?? 'Anonymous'}</p>
                        <p className="text-[10px] text-[#4A5578]">{u.id === currentUserId ? 'You' : 'Member'}</p>
                      </div>
                    </div>
                    <select value={u.role} onChange={(e: { target: { value: string } }) => updateUserRole(u.id, e.target.value)}
                      disabled={u.id === currentUserId}
                      className={cn('h-7 px-2 rounded-lg text-[11px] font-bold bg-transparent border border-transparent hover:border-[#162440] focus:outline-none transition-colors capitalize', ROLE_COLOR[u.role] ?? 'text-[#8B9CC0]')}>
                      {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full w-fit capitalize',
                      u.subscription_tier === 'pro' ? 'text-[#22FFAA] bg-[#22FFAA]/10' : 'text-[#4A5578] bg-[#4A5578]/10'
                    )}>{u.subscription_tier}</span>
                    <button disabled={u.id === currentUserId} className="text-[#4A5578] hover:text-[#FF5C7A] disabled:opacity-30 transition-colors p-1">
                      <Trash2 size={13} strokeWidth={1.8} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* Security */}
      {activeTab === 'security' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="bg-[#0A1226] border border-[#0F1D35] rounded-2xl p-5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <ShieldCheck size={14} className="text-[#22FFAA]" strokeWidth={2} />
                <p className="text-[13px] font-bold text-[#F0F4FF]">Multi-Factor Authentication</p>
                <span className="text-[9px] font-bold px-2 py-0.5 bg-[#22FFAA]/10 border border-[#22FFAA]/20 text-[#22FFAA] rounded-full">Recommended</span>
              </div>
              <p className="text-[12px] text-[#4A5578]">Require MFA for all workspace members on next login.</p>
            </div>
            <button onClick={() => setMfaEnabled(!mfaEnabled)}
              className={cn('relative w-10 h-6 rounded-full transition-all flex-shrink-0',
                mfaEnabled ? 'bg-accent' : 'bg-[#0D1530] border border-[#162440]')}>
              <span className={cn('absolute top-1 w-4 h-4 rounded-full transition-all',
                mfaEnabled ? 'right-1 bg-[#060a0e]' : 'left-1 bg-[#4A5578]')} />
            </button>
          </div>
          <div className="bg-[#0A1226] border border-[#0F1D35] rounded-2xl overflow-hidden">
            <div className="p-5 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <Key size={14} className="text-[#6D5DFD]" strokeWidth={2} />
                  <p className="text-[13px] font-bold text-[#F0F4FF]">Single Sign-On (SSO)</p>
                  <span className="text-[9px] font-bold px-2 py-0.5 bg-[#6D5DFD]/10 border border-[#6D5DFD]/20 text-[#A99FFE] rounded-full">Enterprise</span>
                </div>
                <p className="text-[12px] text-[#4A5578]">Configure SAML 2.0 or OIDC for your identity provider.</p>
              </div>
              <button onClick={() => setSsoEnabled(!ssoEnabled)}
                className={cn('relative w-10 h-6 rounded-full transition-all flex-shrink-0',
                  ssoEnabled ? 'bg-[#6D5DFD]' : 'bg-[#0D1530] border border-[#162440]')}>
                <span className={cn('absolute top-1 w-4 h-4 rounded-full transition-all',
                  ssoEnabled ? 'right-1 bg-white' : 'left-1 bg-[#4A5578]')} />
              </button>
            </div>
            {ssoEnabled && (
              <div className="border-t border-[#0F1D35] p-5 space-y-5">
                {ssoConfigs.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold text-[#4A5578] uppercase tracking-wider">Configured Providers</p>
                    {ssoConfigs.map((cfg) => {
                      const meta = SSO_PROVIDERS.find((p) => p.id === cfg.provider_type);
                      return (
                        <div key={cfg.id} className="flex items-center justify-between p-3 rounded-xl"
                          style={{ background: '#07101F', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <div className="flex items-center gap-3">
                            <span className="text-base">{meta?.icon ?? '🔒'}</span>
                            <div>
                              <p className="text-[13px] font-semibold text-[#F0F4FF]">{cfg.display_name}</p>
                              <p className="text-[10px] text-[#4A5578]">
                                {cfg.login_count} logins · {cfg.last_tested_at ? `Tested ${new Date(cfg.last_tested_at).toLocaleDateString()}` : 'Not tested'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => testSsoConfig(cfg.id)} disabled={ssoTesting === cfg.id}
                              className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-semibold"
                              style={{ background: 'rgba(109,93,253,0.1)', color: '#6D5DFD', border: '1px solid rgba(109,93,253,0.2)' }}>
                              {ssoTesting === cfg.id ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} strokeWidth={2} />}
                              Test
                            </button>
                            <button onClick={() => toggleSsoConfig(cfg.id, !cfg.is_enabled)}
                              className={cn('relative w-8 h-5 rounded-full transition-all',
                                cfg.is_enabled ? 'bg-[#6D5DFD]' : 'bg-[#0D1530] border border-[#162440]')}>
                              <span className={cn('absolute top-0.5 w-3.5 h-3.5 rounded-full transition-all',
                                cfg.is_enabled ? 'right-0.5 bg-white' : 'left-0.5 bg-[#4A5578]')} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="space-y-4">
                  <p className="text-[11px] font-bold text-[#4A5578] uppercase tracking-wider">Add Identity Provider</p>
                  <div className="grid grid-cols-5 gap-2">
                    {SSO_PROVIDERS.map((p) => (
                      <button key={p.id} onClick={() => setActiveSsoProvider(p.id)}
                        className={cn('flex flex-col items-center gap-1.5 p-3 rounded-xl text-center transition-all border',
                          activeSsoProvider === p.id
                            ? 'bg-[#6D5DFD]/10 border-[#6D5DFD]/30'
                            : 'bg-[#07101F] border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)]')}>
                        <span className="text-xl">{p.icon}</span>
                        <span className="text-[10px] font-semibold leading-tight" style={{ color: activeSsoProvider === p.id ? '#A99FFE' : '#8B9CC0' }}>
                          {p.label}
                        </span>
                      </button>
                    ))}
                  </div>
                  {['saml', 'microsoft_entra', 'okta'].includes(activeSsoProvider) ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="text-[10px] font-bold text-[#4A5578] uppercase tracking-wider mb-1.5 block">Display Name</label>
                        <input value={ssoForm.displayName} onChange={(e: { target: { value: string } }) => setSsoForm((f) => ({ ...f, displayName: e.target.value }))}
                          placeholder="e.g. Acme Corp Entra ID"
                          className="w-full h-9 px-3 bg-[#07101F] border border-[#0F1D35] rounded-xl text-[13px] text-[#F0F4FF] placeholder:text-[#4A5578] focus:outline-none focus:border-[#162440]" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-[#4A5578] uppercase tracking-wider mb-1.5 block">Entity ID / Issuer</label>
                        <input value={ssoForm.entityId} onChange={(e: { target: { value: string } }) => setSsoForm((f) => ({ ...f, entityId: e.target.value }))}
                          placeholder="https://sts.windows.net/..."
                          className="w-full h-9 px-3 bg-[#07101F] border border-[#0F1D35] rounded-xl text-[13px] text-[#F0F4FF] placeholder:text-[#4A5578] focus:outline-none focus:border-[#162440]" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-[#4A5578] uppercase tracking-wider mb-1.5 block">SSO URL</label>
                        <input value={ssoForm.ssoUrl} onChange={(e: { target: { value: string } }) => setSsoForm((f) => ({ ...f, ssoUrl: e.target.value }))}
                          placeholder="https://login.microsoftonline.com/..."
                          className="w-full h-9 px-3 bg-[#07101F] border border-[#0F1D35] rounded-xl text-[13px] text-[#F0F4FF] placeholder:text-[#4A5578] focus:outline-none focus:border-[#162440]" />
                      </div>
                      <div className="col-span-2">
                        <label className="text-[10px] font-bold text-[#4A5578] uppercase tracking-wider mb-1.5 block">X.509 Certificate</label>
                        <textarea value={ssoForm.certificate} onChange={(e: { target: { value: string } }) => setSsoForm((f) => ({ ...f, certificate: e.target.value }))}
                          placeholder="-----BEGIN CERTIFICATE-----&#10;MII...&#10;-----END CERTIFICATE-----"
                          rows={3}
                          className="w-full px-3 py-2 bg-[#07101F] border border-[#0F1D35] rounded-xl text-[12px] font-mono text-[#F0F4FF] placeholder:text-[#4A5578] focus:outline-none focus:border-[#162440] resize-none" />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="text-[10px] font-bold text-[#4A5578] uppercase tracking-wider mb-1.5 block">Display Name</label>
                        <input value={ssoForm.displayName} onChange={(e: { target: { value: string } }) => setSsoForm((f) => ({ ...f, displayName: e.target.value }))}
                          placeholder="e.g. Acme Google Workspace"
                          className="w-full h-9 px-3 bg-[#07101F] border border-[#0F1D35] rounded-xl text-[13px] text-[#F0F4FF] placeholder:text-[#4A5578] focus:outline-none focus:border-[#162440]" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-[#4A5578] uppercase tracking-wider mb-1.5 block">Client ID</label>
                        <input value={ssoForm.clientId} onChange={(e: { target: { value: string } }) => setSsoForm((f) => ({ ...f, clientId: e.target.value }))}
                          placeholder="your-app-client-id"
                          className="w-full h-9 px-3 bg-[#07101F] border border-[#0F1D35] rounded-xl text-[13px] text-[#F0F4FF] placeholder:text-[#4A5578] focus:outline-none focus:border-[#162440]" />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-[#4A5578] uppercase tracking-wider mb-1.5 block">Issuer URL</label>
                        <input value={ssoForm.issuerUrl} onChange={(e: { target: { value: string } }) => setSsoForm((f) => ({ ...f, issuerUrl: e.target.value }))}
                          placeholder="https://accounts.google.com"
                          className="w-full h-9 px-3 bg-[#07101F] border border-[#0F1D35] rounded-xl text-[13px] text-[#F0F4FF] placeholder:text-[#4A5578] focus:outline-none focus:border-[#162440]" />
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3 pt-1">
                    <button onClick={saveSsoConfig} disabled={ssoSaving}
                      className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-semibold disabled:opacity-50"
                      style={{ background: 'rgba(109,93,253,0.12)', color: '#A99FFE', border: '1px solid rgba(109,93,253,0.25)' }}>
                      {ssoSaving ? <Loader2 size={13} className="animate-spin" /> : <Server size={13} strokeWidth={2} />}
                      {ssoSaving ? 'Saving…' : 'Save Provider'}
                    </button>
                    <p className="text-[11px] text-[#4A5578]">
                      ACS URL: <span className="font-mono text-[#8B9CC0]">{typeof window !== 'undefined' ? window.location.origin : ''}/api/auth/sso/callback</span>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="bg-[#0A1226] border border-[#0F1D35] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-1">
              <Key size={14} className="text-[#6D5DFD]" strokeWidth={2} />
              <p className="text-[13px] font-bold text-[#F0F4FF]">Session Controls</p>
            </div>
            <p className="text-[12px] text-[#4A5578] mb-3">Configure session timeout and maximum concurrent sessions.</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-[#4A5578] uppercase tracking-wider mb-1.5 block">Session Timeout</label>
                <select className="w-full h-9 px-3 bg-[#07101F] border border-[#0F1D35] rounded-xl text-[12px] text-[#F0F4FF] focus:outline-none">
                  <option>24 hours</option><option>8 hours</option><option>1 hour</option><option>30 minutes</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#4A5578] uppercase tracking-wider mb-1.5 block">Max Concurrent Sessions</label>
                <select className="w-full h-9 px-3 bg-[#07101F] border border-[#0F1D35] rounded-xl text-[12px] text-[#F0F4FF] focus:outline-none">
                  <option>Unlimited</option><option>5</option><option>3</option><option>1</option>
                </select>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Branding — White Label */}
      {activeTab === 'branding' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {featureConfig && !featureConfig.features.whiteLabel && (
            <div className="flex items-center gap-3 p-4 bg-[#6D5DFD]/8 border border-[#6D5DFD]/20 rounded-xl">
              <Lock size={14} className="text-[#A99FFE]" strokeWidth={2} />
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-[#A99FFE]">White Label requires Enterprise plan</p>
                <p className="text-[11px] text-[#4A5578] mt-0.5">Upgrade to customise logo, colors and workspace name.</p>
              </div>
              <button className="text-[11px] font-bold text-[#A99FFE] bg-[#6D5DFD]/10 border border-[#6D5DFD]/20 px-3 py-1.5 rounded-lg hover:bg-[#6D5DFD]/15 transition-colors">
                Upgrade →
              </button>
            </div>
          )}

          <div className={cn('bg-[#0A1226] border border-[#0F1D35] rounded-2xl p-5 space-y-5',
            featureConfig && !featureConfig.features.whiteLabel && 'opacity-60 pointer-events-none')}>
            <p className="text-[13px] font-bold text-[#F0F4FF]">White Label Branding</p>

            {/* Logo */}
            <div>
              <label className="text-[10px] font-bold text-[#4A5578] uppercase tracking-wider mb-2 block">Workspace Logo</label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-[#07101F] border-2 border-dashed border-[#162440] flex items-center justify-center overflow-hidden">
                  {featureConfig?.branding.logoUrl
                    ? <img src={featureConfig.branding.logoUrl} alt="" className="w-full h-full object-cover" />
                    : <Building2 size={20} className="text-[#4A5578]" strokeWidth={1.5} />}
                </div>
                <div>
                  <input
                    type="file"
                    ref={logoInputRef}
                    accept="image/png,image/svg+xml,image/jpeg"
                    className="hidden"
                    onChange={handleLogoUpload}
                  />
                  <button onClick={() => logoInputRef.current?.click()}
                    disabled={logoUploading}
                    className="flex items-center gap-2 h-8 px-3 bg-[#07101F] border border-[#0F1D35] rounded-xl text-[12px] font-semibold text-[#8B9CC0] hover:text-[#F0F4FF] hover:border-[#162440] transition-colors mb-1 disabled:opacity-50">
                    {logoUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} strokeWidth={2} />}
                    {logoUploading ? 'Uploading…' : 'Upload Logo'}
                  </button>
                  <p className="text-[10px] text-[#4A5578]">PNG, SVG or JPEG, max 2MB</p>
                </div>
              </div>
            </div>

            {/* App Name */}
            <div>
              <label className="text-[10px] font-bold text-[#4A5578] uppercase tracking-wider mb-1.5 block">Workspace Name</label>
              <input value={appName} onChange={(e: { target: { value: string } }) => setAppName(e.target.value)}
                placeholder="Your Brand Name"
                className="w-full h-9 px-3 bg-[#07101F] border border-[#0F1D35] rounded-xl text-[13px] text-[#F0F4FF] placeholder:text-[#4A5578] focus:outline-none focus:border-[#162440]" />
              <p className="text-[10px] text-[#4A5578] mt-1">Replaces &quot;X-hunt&quot; in the sidebar header</p>
            </div>

            {/* Colors */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-[#4A5578] uppercase tracking-wider mb-1.5 block">Primary Color</label>
                <div className="flex items-center gap-2 h-9 px-3 bg-[#07101F] border border-[#0F1D35] rounded-xl">
                  <input type="color" value={primaryColor}
                    onChange={(e: { target: { value: string } }) => setPrimaryColor(e.target.value)}
                    className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0" />
                  <span className="text-[13px] font-mono text-[#F0F4FF]">{primaryColor}</span>
                </div>
                <p className="text-[10px] text-[#4A5578] mt-1">Used for buttons, active states and accents</p>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#4A5578] uppercase tracking-wider mb-1.5 block">Accent Color</label>
                <div className="flex items-center gap-2 h-9 px-3 bg-[#07101F] border border-[#0F1D35] rounded-xl">
                  <input type="color" value={accentColor}
                    onChange={(e: { target: { value: string } }) => setAccentColor(e.target.value)}
                    className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent p-0" />
                  <span className="text-[13px] font-mono text-[#F0F4FF]">{accentColor}</span>
                </div>
                <p className="text-[10px] text-[#4A5578] mt-1">Used for AI indicators and secondary highlights</p>
              </div>
            </div>

            {/* Preview */}
            <div className="p-4 rounded-xl bg-[#07101F] border border-[#0F1D35]">
              <p className="text-[10px] font-bold text-[#4A5578] uppercase tracking-wider mb-3">Preview</p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${primaryColor}25`, border: `1px solid ${primaryColor}40` }}>
                  <Building2 size={14} style={{ color: primaryColor }} strokeWidth={1.8} />
                </div>
                <div>
                  <p className="text-[13px] font-bold" style={{ color: '#F0F4FF' }}>{appName || 'Your Brand'}</p>
                  <p className="text-[10px]" style={{ color: '#4A5578' }}>Mission Control</p>
                </div>
                <div className="ml-auto">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${primaryColor}18`, color: primaryColor, border: `1px solid ${primaryColor}30` }}>
                    Enterprise
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <button onClick={saveBranding} disabled={logoUploading}
                className="flex items-center gap-2 h-9 px-5 bg-accent text-[#060a0e] rounded-xl font-semibold text-[13px] disabled:opacity-50"
                style={featureConfig?.branding.primaryColor ? { backgroundColor: featureConfig.branding.primaryColor } : {}}>
                {brandSaved ? <><Check size={14} strokeWidth={2.5} />Applied</> : <><Save size={13} strokeWidth={2} />Save Branding</>}
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Notifications */}
      {activeTab === 'notifications' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="bg-[#0A1226] border border-[#0F1D35] rounded-2xl p-5 space-y-4">
            <p className="text-[13px] font-bold text-[#F0F4FF]">Notification Preferences</p>
            {[
              { label: 'Mission completions', desc: 'Get notified when participants complete missions' },
              { label: 'Outcome validations', desc: 'Notifications for pending validation reviews' },
              { label: 'AI Briefings',         desc: 'Daily intelligence briefings from Insight Analyst' },
              { label: 'Billing alerts',       desc: 'Usage limits and billing cycle notifications' },
              { label: 'Security events',      desc: 'Login attempts and suspicious activity' },
            ].map(({ label, desc }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-[#0F1D35] last:border-0">
                <div>
                  <p className="text-[13px] font-medium text-[#F0F4FF]">{label}</p>
                  <p className="text-[11px] text-[#4A5578] mt-0.5">{desc}</p>
                </div>
                <button className="relative w-9 h-5 rounded-full bg-accent">
                  <span className="absolute right-0.5 top-0.5 w-4 h-4 rounded-full bg-[#060a0e]" />
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
