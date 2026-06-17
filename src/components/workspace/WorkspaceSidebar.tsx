'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import {
  LayoutDashboard, Layers, Radar, TrendingUp,
  BarChart3, Bot, Cpu,
  Coins, Globe,
  ShieldCheck, Plug,
  CreditCard, Settings,
  ChevronDown, Plus, Sparkles, Zap, Building2,
  Lock, Sun, Moon,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { getDefaultConfig, mergeFeatureConfig } from '@/lib/features';
import type { TenantFeatureConfig, NavFlags } from '@/lib/features';

type NavFlag = keyof NavFlags | null;

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
  flag: NavFlag;
  minTier?: 'growth' | 'enterprise';
}

// Consolidated: 12 items max (starter sees 5, growth 8, enterprise 12)
const NAV_GROUPS: { group: string; items: NavItem[] }[] = [
  {
    group: 'MISSIONS',
    items: [
      { href: '/workspace',                label: 'Dashboard',      icon: LayoutDashboard, exact: true, flag: null },
      { href: '/workspace/missions',        label: 'Mission Studio', icon: Layers,          flag: null },
      { href: '/workspace/mission-control', label: 'Mission Control',icon: Radar,           flag: null },
      { href: '/workspace/outcomes',        label: 'Outcomes',       icon: TrendingUp,      flag: 'outcomes' },
    ],
  },
  {
    group: 'INTELLIGENCE',
    items: [
      { href: '/workspace/analytics',    label: 'Analytics',  icon: BarChart3, flag: 'analytics',    minTier: 'growth' },
      { href: '/workspace/agents',       label: 'AI Agents',  icon: Bot,       flag: 'agents',       minTier: 'growth' },
      { href: '/workspace/intelligence', label: 'XIL Hub',    icon: Cpu,       flag: 'xilHub',       minTier: 'enterprise' },
    ],
  },
  {
    group: 'ECONOMY',
    items: [
      { href: '/workspace/economy',      label: 'Economy',     icon: Coins,  flag: 'economy',      minTier: 'enterprise' },
      { href: '/workspace/marketplace',  label: 'Marketplace', icon: Globe,  flag: 'marketplace',  minTier: 'growth' },
    ],
  },
  {
    group: 'PLATFORM',
    items: [
      { href: '/workspace/governance',   label: 'Governance',  icon: ShieldCheck, flag: 'governance',  minTier: 'enterprise' },
      { href: '/workspace/integrations', label: 'Integrations',icon: Plug,        flag: null },
    ],
  },
  {
    group: 'WORKSPACE',
    items: [
      { href: '/workspace/billing',  label: 'Billing',  icon: CreditCard, flag: null },
      { href: '/workspace/settings', label: 'Settings', icon: Settings,   flag: null },
    ],
  },
];

const PLAN_BADGE: Record<string, { label: string; cls: string }> = {
  enterprise: { label: 'Enterprise', cls: 'bg-[#6D5DFD]/15 text-[#A99FFE] border-[#6D5DFD]/30' },
  growth:     { label: 'Growth',     cls: 'bg-accent/10 text-accent border-accent/20' },
  starter:    { label: 'Starter',    cls: 'bg-[#0F1D35] text-[#8B9CC0] border-[#162440]' },
};

interface Props {
  orgName: string;
  plan: string;
  userName: string | null;
  userRole: string;
  avatarUrl: string | null;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function WorkspaceSidebar({ orgName, plan, userName, userRole, avatarUrl, isOpen = false, onClose }: Props) {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const badge = PLAN_BADGE[plan] ?? PLAN_BADGE.starter;
  const [config, setConfig] = useState<TenantFeatureConfig>(getDefaultConfig(plan));
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const saved = localStorage.getItem('xhunt-theme') as 'dark' | 'light' | null;
    setTheme(saved ?? 'dark');
  }, []);

  useEffect(() => {
    fetch('/api/workspace/features')
      .then((r) => r.json())
      .then((data: TenantFeatureConfig) => { if (data?.maturity) setConfig(data); })
      .catch(() => { setConfig(mergeFeatureConfig(getDefaultConfig(plan), {})); });
  }, [plan]);

  function isNavEnabled(flag: NavFlag): boolean {
    if (flag === null) return true;
    return config.nav[flag] === true;
  }

  function toggleTheme() {
    const next: 'dark' | 'light' = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('xhunt-theme', next);
  }

  const initials = (userName ?? orgName ?? 'U').slice(0, 2).toUpperCase();
  const agentCount = config.maturity === 'enterprise' ? '12' : config.maturity === 'growth' ? '6' : '2';

  return (
    <>
      {isOpen && (
        <div className="portal-overlay md:hidden" onClick={onClose} aria-hidden="true" />
      )}
      <aside
        className="portal-sidebar liquid-nav bg-[#07101F] border-r border-[#0F1D35] flex flex-col"
        data-open={isOpen ? 'true' : 'false'}
      >
        {/* Org Header */}
        <div className="px-4 py-4 border-b border-[#0F1D35]">
          <div className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-[#0A1226] cursor-pointer transition-colors group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent/20 to-[#6D5DFD]/20 border border-accent/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
              {config.branding.logoUrl
                ? <img src={config.branding.logoUrl} alt="" className="w-full h-full object-cover" />
                : <Building2 size={15} className="text-accent" strokeWidth={1.8} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[#F0F4FF] truncate leading-tight">
                {config.branding.appName ?? orgName}
              </p>
              <p className="text-[10px] text-[#4A5578] mt-0.5 capitalize">{config.maturity} tier</p>
            </div>
            <ChevronDown size={13} className="text-[#4A5578] group-hover:text-[#8B9CC0] flex-shrink-0" />
          </div>
          <div className={cn('mt-2 mx-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-bold tracking-wide', badge.cls)}>
            <Sparkles size={9} strokeWidth={2.5} />
            {badge.label}
          </div>
        </div>

        {/* New Mission CTA */}
        <div className="px-4 py-3 border-b border-[#0F1D35]">
          <Link href="/workspace/missions/new">
            <button
              className="flex items-center gap-2 w-full h-9 px-3 bg-accent text-[#060a0e] rounded-xl font-semibold text-[12px] hover:bg-accent-dark transition-colors shadow-[0_4px_16px_rgba(34,255,170,0.25)]"
              style={config.branding.primaryColor ? { backgroundColor: config.branding.primaryColor } : {}}
            >
              <Plus size={14} strokeWidth={2.5} />
              New Mission
            </button>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3 overflow-y-auto flex flex-col gap-4">
          {NAV_GROUPS.map(({ group, items }) => {
            const enabled = items.filter((i) => isNavEnabled(i.flag));
            const locked  = items.filter((i) => !isNavEnabled(i.flag) && i.flag !== null);
            if (enabled.length === 0 && locked.length === 0) return null;

            return (
              <div key={group}>
                <p className="px-2 mb-1 text-[9px] font-bold text-[#4A5578] uppercase tracking-[0.1em]">{group}</p>
                <div className="flex flex-col gap-0.5">
                  {enabled.map(({ href, label, icon: Icon, exact }) => {
                    const active = exact ? pathname === href : pathname.startsWith(href);
                    return (
                      <Link key={href} href={href}
                        className={cn(
                          'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all duration-100',
                          active ? 'bg-accent/10 text-accent' : 'text-[#8B9CC0] hover:text-[#F0F4FF] hover:bg-[#0A1226]'
                        )}
                        style={active && config.branding.primaryColor
                          ? { backgroundColor: `${config.branding.primaryColor}18`, color: config.branding.primaryColor } : {}}
                      >
                        <Icon size={15} strokeWidth={active ? 2.2 : 1.8}
                          className={active ? 'text-accent' : 'text-[#4A5578]'}
                          style={active && config.branding.primaryColor ? { color: config.branding.primaryColor } : {}} />
                        {label}
                        {active && <div className="ml-auto w-1 h-1 rounded-full bg-accent flex-shrink-0"
                          style={config.branding.primaryColor ? { backgroundColor: config.branding.primaryColor } : {}} />}
                      </Link>
                    );
                  })}
                  {locked.map(({ label, icon: Icon, minTier }) => (
                    <div key={label}
                      title={`Upgrade to ${minTier ?? 'higher'} tier to unlock`}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] font-medium opacity-35 cursor-not-allowed select-none">
                      <Icon size={15} strokeWidth={1.8} className="text-[#4A5578]" />
                      {label}
                      <Lock size={10} className="ml-auto text-[#4A5578] flex-shrink-0" strokeWidth={2} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        {/* AI Status + Theme */}
        <div className="px-4 py-3 border-t border-[#0F1D35]">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-[#6D5DFD]/8 border border-[#6D5DFD]/15 flex-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#22FFAA] breathe flex-shrink-0" />
              <Zap size={12} className="text-[#A99FFE]" strokeWidth={1.8} />
              <span className="text-[11px] font-medium text-[#A99FFE]">{agentCount} Agents Active</span>
            </div>
            <button onClick={toggleTheme} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#4A5578] hover:text-[#8B9CC0] hover:bg-[#0A1226] transition-colors flex-shrink-0">
              {theme === 'dark' ? <Sun size={13} strokeWidth={1.8} /> : <Moon size={13} strokeWidth={1.8} />}
            </button>
          </div>
        </div>

        {/* User Profile */}
        <div className="px-3 py-3 border-t border-[#0F1D35]">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-[#0A1226] transition-colors group">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#6D5DFD] to-accent flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-[#060a0e] overflow-hidden">
              {avatarUrl
                ? <img src={avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                : initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-[#F0F4FF] truncate leading-tight">{userName ?? 'Admin'}</p>
              <p className="text-[10px] text-[#4A5578] capitalize">{userRole.replace('_', ' ')}</p>
            </div>
            <button onClick={() => signOut({ redirectUrl: '/' })} title="Sign out"
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-[#2a0a0a] hover:text-[#FF5C7A] text-[#4A5578]">
              <Settings size={13} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
