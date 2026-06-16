'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ChevronDown, ArrowRight, Sun, Moon } from 'lucide-react';
import { Show, SignInButton, UserButton } from '@clerk/nextjs';
import { cn } from '@/lib/cn';
import Logo from '@/components/Logo';

function ThemeToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('xhunt-theme');
    const isLight = saved === 'light';
    setLight(isLight);
    document.documentElement.setAttribute('data-theme', isLight ? 'light' : 'dark');
  }, []);

  function toggle() {
    const next = !light;
    setLight(next);
    document.documentElement.setAttribute('data-theme', next ? 'light' : 'dark');
    localStorage.setItem('xhunt-theme', next ? 'light' : 'dark');
  }

  return (
    <button
      onClick={toggle}
      aria-label={light ? 'Switch to dark mode' : 'Switch to light mode'}
      className="w-9 h-9 flex items-center justify-center rounded-lg text-txt-dim hover:text-txt hover:bg-[rgba(255,255,255,0.06)] transition-colors"
    >
      {light ? <Sun size={16} strokeWidth={2} /> : <Moon size={16} strokeWidth={2} />}
    </button>
  );
}

const PRODUCT_ITEMS = [
  { label: 'Consumer Platform', href: '/consumer', desc: 'Personal AI mission experiences', emoji: '🎯' },
  { label: 'Enterprise Platform', href: '/enterprise', desc: 'Workforce & engagement OS', emoji: '🏢' },
  { label: 'Mission Control', href: '/mission-control', desc: 'AI orchestration engine', emoji: '⚡' },
  { label: 'Marketplace', href: '/marketplace', desc: 'Mission ecosystem & creators', emoji: '🌐' },
];

const NAV_ITEMS = [
  { label: 'Use Cases', href: '/use-cases' },
  { label: 'Developers', href: '/developers' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'About', href: '/about' },
];

export default function Nav() {
  const [scrolled, setScrolled]     = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname    = usePathname();
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setProductOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMobileOpen(false); setProductOpen(false); }, [pathname]);
  useEffect(() => { document.body.style.overflow = mobileOpen ? 'hidden' : ''; return () => { document.body.style.overflow = ''; }; }, [mobileOpen]);

  return (
    <header className={cn(
      'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
      scrolled
        ? 'bg-[rgba(5,8,22,0.88)] backdrop-blur-2xl border-b border-[rgba(255,255,255,0.06)] shadow-[0_1px_24px_rgba(0,0,0,0.45)]'
        : 'bg-transparent',
    )}>
      <nav className="max-w-7xl mx-auto px-5 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
        {/* Logo */}
        <Logo size="sm" href="/" priority />

        {/* Desktop nav */}
        <div className="hidden lg:flex items-center gap-0.5">
          <div ref={dropdownRef} className="relative" onMouseEnter={() => setProductOpen(true)} onMouseLeave={() => setProductOpen(false)}>
            <button onClick={() => setProductOpen((o) => !o)}
              className={cn('flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
                productOpen ? 'text-txt bg-[rgba(255,255,255,0.06)]' : 'text-txt-dim hover:text-txt hover:bg-[rgba(255,255,255,0.04)]')}>
              Product
              <ChevronDown size={13} strokeWidth={2.5} className={cn('transition-transform duration-200', productOpen && 'rotate-180')} />
            </button>

            <AnimatePresence>
              {productOpen && (
                <motion.div initial={{ opacity: 0, y: 6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.97 }} transition={{ duration: 0.13, ease: 'easeOut' as const }}
                  className="absolute top-full left-0 mt-1 w-[290px] bg-[#07101F] border border-[rgba(255,255,255,0.09)] rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.55)] p-2 overflow-hidden">
                  {PRODUCT_ITEMS.map((item) => (
                    <Link key={item.href} href={item.href} className="flex items-center gap-3 p-3 rounded-xl hover:bg-[rgba(255,255,255,0.05)] transition-colors group/item">
                      <span className="text-xl flex-shrink-0 w-8 text-center">{item.emoji}</span>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-txt group-hover/item:text-accent transition-colors truncate">{item.label}</p>
                        <p className="text-[11px] text-txt-faint mt-0.5 truncate">{item.desc}</p>
                      </div>
                    </Link>
                  ))}
                  <div className="h-px bg-[rgba(255,255,255,0.06)] my-1.5 mx-1" />
                  <Link href="/home" className="flex items-center gap-3 p-3 rounded-xl bg-accent/5 hover:bg-accent/10 border border-accent/10 transition-colors group/app">
                    <span className="text-xl flex-shrink-0 w-8 text-center">🚀</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-accent truncate">Open App</p>
                      <p className="text-[11px] text-txt-faint mt-0.5 truncate">Go to your dashboard</p>
                    </div>
                    <ArrowRight size={13} strokeWidth={2.5} className="text-accent flex-shrink-0" />
                  </Link>
                  <Link href="/workspace" className="flex items-center gap-3 p-3 rounded-xl bg-[#6D5DFD]/5 hover:bg-[#6D5DFD]/10 border border-[#6D5DFD]/10 transition-colors group/ws mt-1">
                    <span className="text-xl flex-shrink-0 w-8 text-center">⚡</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-[#A99FFE] truncate">Mission Workspace</p>
                      <p className="text-[11px] text-txt-faint mt-0.5 truncate">Enterprise portal & control</p>
                    </div>
                    <ArrowRight size={13} strokeWidth={2.5} className="text-[#6D5DFD] flex-shrink-0 opacity-0 group-hover/ws:opacity-100 transition-opacity" />
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href}
              className={cn('px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150',
                pathname === item.href || pathname.startsWith(item.href + '/')
                  ? 'text-txt bg-[rgba(255,255,255,0.06)]'
                  : 'text-txt-dim hover:text-txt hover:bg-[rgba(255,255,255,0.04)]')}>
              {item.label}
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="hidden lg:flex items-center gap-2">
          <ThemeToggle />
          <Link href="/sign-in"
            className="px-4 py-2 text-sm font-medium text-txt-dim hover:text-txt transition-colors">
            Sign in
          </Link>
          <Link href="/home"
            className="flex items-center gap-1.5 px-4 py-2 bg-accent text-[#050816] rounded-lg text-sm font-bold shadow-[0_0_18px_rgba(34,255,170,0.28)] hover:shadow-[0_0_24px_rgba(34,255,170,0.45)] hover:bg-accent-dark transition-all duration-200">
            Start Exploring
            <ArrowRight size={13} strokeWidth={2.8} />
          </Link>
        </div>

        {/* Mobile controls */}
        <div className="lg:hidden flex items-center gap-1">
          <ThemeToggle />
          <button onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle menu"
            className="w-9 h-9 flex items-center justify-center rounded-lg text-txt-dim hover:text-txt hover:bg-[rgba(255,255,255,0.06)] transition-colors">
            {mobileOpen ? <X size={20} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22, ease: 'easeInOut' as const }}
            className="lg:hidden overflow-hidden bg-[rgba(5,8,22,0.96)] backdrop-blur-2xl border-b border-[rgba(255,255,255,0.06)]">
            <div className="px-5 pt-2 pb-7 flex flex-col gap-0.5">
              <p className="text-[10px] font-bold text-txt-faint uppercase tracking-widest px-3 py-2 mt-1">Platform</p>
              {PRODUCT_ITEMS.map((item) => (
                <Link key={item.href} href={item.href} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[rgba(255,255,255,0.05)] transition-colors">
                  <span className="text-lg w-6 text-center flex-shrink-0">{item.emoji}</span>
                  <span className="text-sm font-medium text-txt">{item.label}</span>
                </Link>
              ))}
              <div className="h-px bg-[rgba(255,255,255,0.06)] my-2" />
              {NAV_ITEMS.map((item) => (
                <Link key={item.href} href={item.href} className="px-3 py-2.5 rounded-xl text-sm font-medium text-txt-dim hover:text-txt hover:bg-[rgba(255,255,255,0.05)] transition-colors">
                  {item.label}
                </Link>
              ))}
              <div className="h-px bg-[rgba(255,255,255,0.06)] my-2" />
              <Link href="/home" className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-accent/5 border border-accent/10 transition-colors">
                <span className="text-lg w-6 text-center flex-shrink-0">🚀</span>
                <span className="text-sm font-semibold text-accent">Open App</span>
                <ArrowRight size={13} strokeWidth={2.5} className="text-accent ml-auto" />
              </Link>
              <Link href="/workspace" className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[#6D5DFD]/5 border border-[#6D5DFD]/10 transition-colors">
                <span className="text-lg w-6 text-center flex-shrink-0">⚡</span>
                <span className="text-sm font-semibold text-[#A99FFE]">Mission Workspace</span>
                <ArrowRight size={13} strokeWidth={2.5} className="text-[#6D5DFD] ml-auto" />
              </Link>
              <Link href="/sign-in" className="px-3 py-2.5 text-sm font-medium text-txt-dim">Sign in</Link>
              <Link href="/home" className="flex items-center justify-center gap-2 h-12 bg-accent text-[#050816] rounded-xl text-sm font-bold mt-1 shadow-[0_4px_20px_rgba(34,255,170,0.35)]">
                Start Exploring
                <ArrowRight size={14} strokeWidth={2.8} />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
