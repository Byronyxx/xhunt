'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Layers, Plus, Search, Filter, Target, Clock, Users, BarChart3,
  ChevronRight, Copy, Archive, Play, Pause, MoreHorizontal, Sparkles,
  ArrowUpRight, Star, TrendingUp
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import type { DbMission } from '@/lib/supabase/types';

interface MissionWithStats extends DbMission {
  completions: number;
  participants: number;
  mei: number | null;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('bg-[#0D1530] animate-pulse rounded-lg', className)} />;
}

const DIFF_COLOR = {
  easy:   { text: 'text-[#22FFAA]', bg: 'bg-[#22FFAA]/10' },
  medium: { text: 'text-[#FFB84D]', bg: 'bg-[#FFB84D]/10' },
  hard:   { text: 'text-[#FF5C7A]', bg: 'bg-[#FF5C7A]/10' },
};

const STATUS_COLOR = {
  active:   { text: 'text-[#22FFAA]', bg: 'bg-[#22FFAA]/10' },
  draft:    { text: 'text-[#FFB84D]', bg: 'bg-[#FFB84D]/10' },
  paused:   { text: 'text-[#8B9CC0]', bg: 'bg-[#8B9CC0]/10' },
  archived: { text: 'text-[#4A5578]', bg: 'bg-[#4A5578]/10' },
  published:{ text: 'text-[#22FFAA]', bg: 'bg-[#22FFAA]/10' },
};

type ViewMode = 'grid' | 'list';

export default function MissionsPage() {
  const [missions, setMissions] = useState<MissionWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [view, setView] = useState<ViewMode>('grid');
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/workspace/missions');
        if (!res.ok) { setLoading(false); return; }
        const data = await res.json();
        setMissions(data.missions ?? []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/missions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setMissions((prev) => prev.map((m) => m.id === id ? { ...m, status: status as DbMission['status'] } : m));
    }
    setOpenMenu(null);
  }

  const filtered = missions.filter((m) => {
    if (statusFilter !== 'all' && m.status !== statusFilter) return false;
    if (search && !m.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stats = {
    total: missions.length,
    active: missions.filter((m) => m.status === 'active').length,
    draft: missions.filter((m) => m.status === 'draft').length,
    avgMei: missions.length ? Math.round(missions.filter((m) => m.mei).reduce((s, m) => s + (m.mei ?? 0), 0) / Math.max(missions.filter((m) => m.mei).length, 1)) : 0,
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32 rounded-xl" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6" onClick={() => setOpenMenu(null)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#6D5DFD]/10 border border-[#6D5DFD]/20 flex items-center justify-center">
            <Layers size={18} className="text-[#6D5DFD]" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="text-[22px] font-bold text-[#F0F4FF]">Mission Studio</h1>
            <p className="text-[#4A5578] text-[12px]">Create, manage, and optimize missions</p>
          </div>
        </div>
        <Link href="/workspace/missions/new">
          <button className="flex items-center gap-2 h-9 px-4 bg-accent text-[#060a0e] rounded-xl font-semibold text-[13px] shadow-[0_4px_16px_rgba(34,255,170,0.25)]">
            <Plus size={14} strokeWidth={2.5} />
            Create Mission
          </button>
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Missions', value: stats.total, icon: Target, color: 'text-[#F0F4FF]', bg: 'bg-[#0D1530]' },
          { label: 'Active', value: stats.active, icon: Play, color: 'text-[#22FFAA]', bg: 'bg-[#22FFAA]/8' },
          { label: 'Drafts', value: stats.draft, icon: Layers, color: 'text-[#FFB84D]', bg: 'bg-[#FFB84D]/8' },
          { label: 'Avg MEI', value: stats.avgMei, icon: BarChart3, color: 'text-[#6D5DFD]', bg: 'bg-[#6D5DFD]/10' },
        ].map(({ label, value, icon: Icon, color, bg }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-[#0A1226] border border-[#0F1D35] rounded-xl p-4 flex items-center gap-3"
          >
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0', bg)}>
              <Icon size={16} className={color} strokeWidth={1.8} />
            </div>
            <div>
              <p className={cn('text-[22px] font-bold leading-none tabular-nums', color)}>{value}</p>
              <p className="text-[#4A5578] text-[11px] mt-0.5 font-medium">{label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A5578]" strokeWidth={2} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search missions…"
            className="w-full h-9 pl-8 pr-3 bg-[#0A1226] border border-[#0F1D35] rounded-xl text-[13px] text-[#F0F4FF] placeholder:text-[#4A5578] focus:outline-none focus:border-[#162440]"
          />
        </div>
        <div className="flex items-center gap-1.5 bg-[#0A1226] border border-[#0F1D35] rounded-xl p-1">
          {['all', 'active', 'draft', 'paused', 'archived'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 h-7 rounded-lg text-[11px] font-semibold transition-all capitalize',
                statusFilter === s ? 'bg-[#0D1530] text-[#F0F4FF]' : 'text-[#4A5578] hover:text-[#8B9CC0]'
              )}
            >{s}</button>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-[#0A1226] border border-[#0F1D35] rounded-xl p-1">
          <button onClick={() => setView('grid')} className={cn('w-7 h-7 flex items-center justify-center rounded-lg transition-all', view === 'grid' ? 'bg-[#0D1530] text-[#F0F4FF]' : 'text-[#4A5578]')}>
            <span className="grid grid-cols-2 gap-0.5 w-3 h-3">
              {[0,1,2,3].map(i => <span key={i} className={cn('rounded-[1px]', view === 'grid' ? 'bg-[#F0F4FF]' : 'bg-[#4A5578]')} />)}
            </span>
          </button>
          <button onClick={() => setView('list')} className={cn('w-7 h-7 flex items-center justify-center rounded-lg transition-all', view === 'list' ? 'bg-[#0D1530] text-[#F0F4FF]' : 'text-[#4A5578]')}>
            <span className="flex flex-col gap-0.5 w-3 h-3 justify-center">
              {[0,1,2].map(i => <span key={i} className={cn('h-px w-full rounded', view === 'list' ? 'bg-[#F0F4FF]' : 'bg-[#4A5578]')} />)}
            </span>
          </button>
        </div>
      </div>

      {/* Grid / List */}
      {filtered.length === 0 ? (
        <div className="bg-[#0A1226] border border-[#0F1D35] rounded-2xl py-20 text-center">
          <Target size={32} className="text-[#4A5578] mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-[#8B9CC0] font-semibold mb-1">No missions found</p>
          <p className="text-[#4A5578] text-sm mb-5">
            {search ? `No missions matching "${search}"` : 'Create your first mission to get started.'}
          </p>
          <Link href="/workspace/missions/new">
            <button className="inline-flex items-center gap-2 px-5 h-9 bg-accent text-[#060a0e] rounded-xl font-semibold text-sm">
              <Plus size={14} strokeWidth={2.5} /> Create Mission
            </button>
          </Link>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-3 gap-4">
          {filtered.map((m, i) => {
            const dc = DIFF_COLOR[m.difficulty];
            const sc = STATUS_COLOR[m.status as keyof typeof STATUS_COLOR] ?? STATUS_COLOR.draft;
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-[#0A1226] border border-[#0F1D35] rounded-2xl overflow-hidden hover:border-[#162440] transition-colors group"
              >
                <div className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', sc.text, sc.bg)}>
                        {m.status.charAt(0).toUpperCase() + m.status.slice(1)}
                      </span>
                      <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', dc.text, dc.bg)}>
                        {m.difficulty.charAt(0).toUpperCase() + m.difficulty.slice(1)}
                      </span>
                    </div>
                    <div className="relative">
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenMenu(openMenu === m.id ? null : m.id); }}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-[#0D1530] text-[#4A5578] hover:text-[#8B9CC0] transition-all"
                      >
                        <MoreHorizontal size={14} strokeWidth={2} />
                      </button>
                      {openMenu === m.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-8 w-44 bg-[#0D1530] border border-[#162440] rounded-xl shadow-xl z-10 overflow-hidden"
                        >
                          {[
                            { label: 'Set Active',   action: () => updateStatus(m.id, 'active'),   icon: Play },
                            { label: 'Set Paused',   action: () => updateStatus(m.id, 'paused'),   icon: Pause },
                            { label: 'Set Archived', action: () => updateStatus(m.id, 'archived'), icon: Archive },
                          ].map(({ label, action, icon: Icon }) => (
                            <button key={label} onClick={action} className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-[#8B9CC0] hover:text-[#F0F4FF] hover:bg-[#162440] transition-colors">
                              <Icon size={12} strokeWidth={2} />{label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <h3 className="text-[14px] font-semibold text-[#F0F4FF] mb-1 line-clamp-2 group-hover:text-accent transition-colors">{m.title}</h3>
                  {m.story_context && (
                    <p className="text-[12px] text-[#4A5578] line-clamp-2 mb-3">{m.story_context}</p>
                  )}

                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#0F1D35]">
                    <div className="flex items-center gap-1.5 text-[11px] text-[#8B9CC0]">
                      <Layers size={11} strokeWidth={2} />
                      {(m.steps as unknown[]).length} steps
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-[#8B9CC0]">
                      <Users size={11} strokeWidth={2} />
                      {m.participants}
                    </div>
                    {m.estimated_time && (
                      <div className="flex items-center gap-1.5 text-[11px] text-[#8B9CC0]">
                        <Clock size={11} strokeWidth={2} />
                        {m.estimated_time}
                      </div>
                    )}
                    {m.mei !== null && (
                      <div className="ml-auto flex items-center gap-1 text-[11px] font-bold text-[#22FFAA]">
                        <TrendingUp size={11} strokeWidth={2} />
                        {m.mei}
                      </div>
                    )}
                  </div>
                </div>
                <Link href={`/workspace/missions/${m.id}`} className="flex items-center justify-between px-5 py-3 bg-[#07101F] border-t border-[#0F1D35] hover:bg-[#0D1530] transition-colors">
                  <span className="text-[12px] font-semibold text-[#8B9CC0]">Open in Studio</span>
                  <ChevronRight size={13} className="text-[#4A5578]" strokeWidth={2} />
                </Link>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="bg-[#0A1226] border border-[#0F1D35] rounded-2xl overflow-hidden">
          <div className="grid px-5 py-3 border-b border-[#0F1D35] bg-[#07101F]"
            style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px' }}>
            {['Mission', 'Status', 'Difficulty', 'Participants', 'MEI', ''].map((h) => (
              <p key={h} className="text-[10px] font-bold text-[#4A5578] uppercase tracking-wider">{h}</p>
            ))}
          </div>
          <div className="divide-y divide-[#0F1D35]">
            {filtered.map((m) => {
              const dc = DIFF_COLOR[m.difficulty];
              const sc = STATUS_COLOR[m.status as keyof typeof STATUS_COLOR] ?? STATUS_COLOR.draft;
              return (
                <Link key={m.id} href={`/workspace/missions/${m.id}`}
                  className="grid px-5 py-4 items-center hover:bg-[#0D1530] transition-colors group"
                  style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px' }}>
                  <div>
                    <p className="text-[13px] font-semibold text-[#F0F4FF] group-hover:text-accent transition-colors truncate">{m.title}</p>
                    <p className="text-[11px] text-[#4A5578] mt-0.5">{(m.steps as unknown[]).length} steps · {m.estimated_time ?? '—'}</p>
                  </div>
                  <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full w-fit', sc.text, sc.bg)}>
                    {m.status.charAt(0).toUpperCase() + m.status.slice(1)}
                  </span>
                  <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full w-fit', dc.text, dc.bg)}>
                    {m.difficulty.charAt(0).toUpperCase() + m.difficulty.slice(1)}
                  </span>
                  <p className="text-[13px] font-semibold text-[#F0F4FF] tabular-nums">{m.participants}</p>
                  <p className={cn('text-[13px] font-bold tabular-nums', m.mei ? 'text-[#22FFAA]' : 'text-[#4A5578]')}>{m.mei ?? '—'}</p>
                  <ChevronRight size={14} className="text-[#4A5578] group-hover:text-accent transition-colors" strokeWidth={2} />
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
