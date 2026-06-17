'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import {
  Home, Compass, Target, MessageSquare, User,
  LogOut, Sun, Moon,
} from 'lucide-react';
import { useTotalUnread } from '@/hooks/useMessages';
import { useState, useEffect } from 'react';
import { t } from '@/theme/colors';

const PRIMARY_NAV = [
  { href: '/home',     icon: Home,          label: 'Home'     },
  { href: '/explore',  icon: Compass,       label: 'Explore'  },
  { href: '/missions', icon: Target,        label: 'Missions', accent: true },
  { href: '/messages', icon: MessageSquare, label: 'Messages', badge: true },
  { href: '/profile',  icon: User,          label: 'Profile'  },
];

// People → consolidated into /explore; Rewards → consolidated into /profile

function ThemeToggleBtn() {
  const [light, setLight] = useState(false);
  useEffect(() => {
    setLight(localStorage.getItem('xhunt-theme') === 'light');
  }, []);
  function toggle() {
    const next = !light;
    setLight(next);
    document.documentElement.setAttribute('data-theme', next ? 'light' : 'dark');
    localStorage.setItem('xhunt-theme', next ? 'light' : 'dark');
  }
  return (
    <button onClick={toggle} title={light ? 'Dark mode' : 'Light mode'}
      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 10, color: t.txtFaint, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {light ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
    </button>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const totalUnread = useTotalUnread(user?.id ?? null);

  return (
    <>
      {/* ─── Mobile bottom bar ─── */}
      <nav className="md:hidden liquid-nav" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        borderTop: '1px solid rgba(255,255,255,0.07)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        <div style={{ maxWidth: 500, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '10px 8px 10px' }}>
          {PRIMARY_NAV.map(({ href, icon: Icon, label, accent, badge }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            const unread = badge && totalUnread > 0 ? totalUnread : 0;
            if (accent) return (
              <Link key={href} href={href} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: '50%',
                  background: active ? t.accent : t.card,
                  border: active ? 'none' : `1px solid ${t.accent}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: active ? `0 0 28px ${t.accent}72` : `0 0 14px ${t.accent}1F`,
                  marginTop: -18, transition: 'all .2s',
                }}>
                  <Icon size={22} strokeWidth={active ? 2.5 : 1.8} style={{ color: active ? t.bg : t.accent }} />
                </div>
                <span style={{ fontSize: 9.5, fontWeight: 600, color: active ? t.accent : t.txtFaint, letterSpacing: '.02em' }}>{label}</span>
              </Link>
            );
            return (
              <Link key={href} href={href} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '2px 10px', borderRadius: 14, position: 'relative' }}>
                {active && <div style={{ position: 'absolute', top: -4, left: '50%', transform: 'translateX(-50%)', width: 24, height: 2, borderRadius: 2, background: t.accent, boxShadow: `0 0 8px ${t.accent}B3` }} />}
                <div style={{ position: 'relative' }}>
                  <Icon size={20} strokeWidth={active ? 2.2 : 1.7} style={{ color: active ? t.accent : t.txtFaint, transition: 'color .15s' }} />
                  {unread > 0 && (
                    <div style={{ position: 'absolute', top: -5, right: -6, width: 15, height: 15, borderRadius: '50%', background: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, color: t.bg, border: `2px solid ${t.bg}` }}>
                      {unread > 9 ? '9+' : unread}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 9.5, fontWeight: 600, color: active ? t.accent : t.txtFaint, letterSpacing: '.02em' }}>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ─── Desktop full sidebar (260px) ─── */}
      <aside className="hidden md:flex liquid-nav" style={{
        position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 50,
        width: 260, flexDirection: 'column',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        boxShadow: '4px 0 24px rgba(0,0,0,0.3)',
      }}>
        {/* Logo */}
        <Link href="/home" style={{ display: 'flex', alignItems: 'center', gap: 10, height: 64, padding: '0 20px', borderBottom: '1px solid rgba(255,255,255,.06)', textDecoration: 'none', flexShrink: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.png" alt="" style={{ width: 28, height: 28, objectFit: 'contain' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <span style={{ fontSize: 17, fontWeight: 900, color: t.txt, letterSpacing: '-0.02em' }}>X-hunt</span>
        </Link>

        {/* Primary nav */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 10px' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: t.txtFaint, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '4px 10px 8px' }}>Main</p>
          {PRIMARY_NAV.map(({ href, icon: Icon, label, accent, badge }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            const unread = badge && totalUnread > 0 ? totalUnread : 0;
            return (
              <Link key={href} href={href} style={{
                textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 12, marginBottom: 2,
                background: active
                  ? (accent ? `${t.accent}1F` : `${t.accent}14`)
                  : 'transparent',
                border: active ? `1px solid ${t.accent}2E` : '1px solid transparent',
                transition: 'all .15s',
              }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <Icon size={18} strokeWidth={active ? 2.3 : 1.7}
                    style={{ color: active ? t.accent : t.txtFaint, transition: 'color .15s', display: 'block' }} />
                  {unread > 0 && (
                    <div style={{ position: 'absolute', top: -4, right: -6, minWidth: 14, height: 14, borderRadius: 7, background: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7.5, fontWeight: 800, color: t.bg, padding: '0 2px', border: `1.5px solid ${t.bg}` }}>
                      {unread > 9 ? '9+' : unread}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 14, fontWeight: active ? 700 : 500, color: active ? t.txt : t.txtDim, transition: 'color .15s' }}>{label}</span>
                {active && <div style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: t.accent, boxShadow: `0 0 8px ${t.accent}B3`, flexShrink: 0 }} />}
              </Link>
            );
          })}

        </div>

        {/* User + controls */}
        <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', marginBottom: 8, borderRadius: 12, background: 'rgba(255,255,255,0.04)' }}>
              {user.avatarUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={user.avatarUrl} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: `${t.accent}26`, border: `1px solid ${t.accent}4D`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: t.accent }}>
                    {(user.displayName?.[0] ?? user.email?.[0] ?? 'U').toUpperCase()}
                  </span>
                </div>
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: t.txt, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.displayName ?? user.email?.split('@')[0] ?? 'Explorer'}
                </p>
                <p style={{ fontSize: 11, color: t.txtFaint, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {user.email ?? ''}
                </p>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
            <ThemeToggleBtn />
            <button
              onClick={() => signOut({ redirectUrl: '/' })}
              title="Sign out"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, borderRadius: 10, color: t.txtFaint, display: 'flex', alignItems: 'center' }}
            >
              <LogOut size={16} strokeWidth={2} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
