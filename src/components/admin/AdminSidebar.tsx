'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import {
  LayoutDashboard, Users, Settings, Building2, ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/cn';

// Admin is platform-level only. All product features live in /workspace.
const NAV_GROUPS = [
  {
    label: 'Platform',
    items: [
      { href: '/admin',          icon: LayoutDashboard, label: 'Overview',  exact: true },
      { href: '/admin/users',    icon: Users,           label: 'Users',     exact: false },
    ],
  },
  {
    label: 'Configure',
    items: [
      { href: '/admin/missions', icon: Building2,    label: 'Tenants',  exact: false },
      { href: '/admin/settings', icon: Settings,     label: 'Settings', exact: false },
    ],
  },
];

interface Props {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function AdminSidebar({ isOpen = false, onClose }: Props) {
  const pathname = usePathname();
  const { signOut } = useAuth();

  return (
    <>
      {isOpen && (
        <div className="portal-overlay md:hidden" onClick={onClose} aria-hidden="true" />
      )}
      <aside
        className="portal-sidebar portal-shell--admin bg-[#0a1020] border-r border-[#1c2a3a] flex flex-col"
        data-open={isOpen ? 'true' : 'false'}
      >
        {/* Logo */}
        <div className="px-5 py-5 border-b border-[#1c2a3a]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#6D5DFD]/15 border border-[#6D5DFD]/25 flex items-center justify-center">
              <ShieldCheck size={15} className="text-[#A99FFE]" strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-[14px] font-bold text-[#e8f0fe] leading-none">X-Hunt</p>
              <p className="text-[10px] font-semibold text-[#3d5068] uppercase tracking-wider mt-0.5">Platform Admin</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 flex flex-col gap-4 overflow-y-auto">
          {NAV_GROUPS.map(({ label: groupLabel, items }) => (
            <div key={groupLabel}>
              <p className="px-3 mb-1 text-[10px] font-bold text-[#3d5068] uppercase tracking-widest">{groupLabel}</p>
              <div className="flex flex-col gap-0.5">
                {items.map(({ href, icon: Icon, label, exact }) => {
                  const active = exact ? pathname === href : pathname.startsWith(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150',
                        active
                          ? 'bg-[#6D5DFD]/10 text-[#A99FFE] border border-[#6D5DFD]/20'
                          : 'text-[#7a8fa8] hover:text-[#e8f0fe] hover:bg-[#111927]'
                      )}
                    >
                      <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
                      {label}
                      {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#6D5DFD]" />}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="px-3 py-4 border-t border-[#1c2a3a]">
          <Link href="/workspace" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[12px] font-medium text-[#3d5068] hover:text-[#22FFAA] hover:bg-[#0D1530] transition-all mb-1">
            <Building2 size={14} strokeWidth={1.8} />
            Switch to Workspace
          </Link>
          <button
            onClick={() => signOut({ redirectUrl: '/' })}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-[13px] font-medium text-[#7a8fa8] hover:text-[#ff5252] hover:bg-[#2a0a0a] transition-all duration-150"
          >
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
