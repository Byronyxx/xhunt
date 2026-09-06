'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Target, Pencil, Trash2, Filter, Sparkles, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { DbMission } from '@/lib/supabase/types';
import { cn } from '@/lib/cn';

const STATUS_FILTERS = ['All', 'Active', 'Draft', 'Archived'];

const DIFFICULTY_BADGE: Record<string, string> = {
  easy: 'text-[#00e676] bg-[#002918]',
  medium: 'text-[#fbbf24] bg-[#2a1a00]',
  hard: 'text-[#ff5252] bg-[#2a0a0a]',
};

const STATUS_BADGE: Record<string, string> = {
  active: 'text-[#00e676] bg-[#002918]',
  draft: 'text-[#fbbf24] bg-[#2a1a00]',
  archived: 'text-[#7a8fa8] bg-[#162030]',
};

export default function AdminMissionsPage() {
  const [missions, setMissions] = useState<DbMission[]>([]);
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  async function loadMissions() {
    try {
      const res = await fetch('/api/admin/missions');
      const json = await res.json();
      if (!res.ok) {
        setLoading(false);
        return;
      }
      setMissions(json.missions ?? []);
    } catch {
      // leave missions as-is on network failure
    }
    setLoading(false);
  }

  useEffect(() => { void loadMissions(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function seedMissions() {
    if (!confirm('Seed 6 starter missions from the X-hunt template library? This only works once (skipped if missions already exist).')) return;
    setSeeding(true);
    try {
      const res = await fetch('/api/admin/seed-missions', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) {
        alert(json.error ?? 'Seed failed');
      } else {
        await loadMissions();
      }
    } catch {
      alert('Seed request failed — is the server running?');
    }
    setSeeding(false);
  }

  async function deleteMission(id: string) {
    if (!confirm('Delete this mission? This cannot be undone.')) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/missions/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error ?? 'Delete failed');
        setDeleting(null);
        return;
      }
      setMissions((prev) => prev.filter((m) => m.id !== id));
    } catch {
      alert('Delete request failed — is the server running?');
    }
    setDeleting(null);
  }

  const filtered = missions.filter((m) => {
    const matchFilter = filter === 'All' || m.status === filter.toLowerCase();
    const matchSearch = !search || m.title.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[28px] font-bold text-[#e8f0fe]">Missions</h1>
          <p className="text-[#7a8fa8] text-sm mt-0.5">{missions.length} total</p>
        </div>
        <div className="flex items-center gap-3">
          {missions.length === 0 && !loading && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={seedMissions}
              disabled={seeding}
              className="flex items-center gap-2 h-10 px-5 bg-[#111927] border border-[#1c2a3a] text-[#e8f0fe] rounded-xl font-semibold text-sm hover:border-accent/40 transition-colors disabled:opacity-50"
            >
              {seeding ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} strokeWidth={2} />}
              Seed starter missions
            </motion.button>
          )}
          <Link href="/admin/missions/new">
            <motion.button
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 h-10 px-5 bg-accent text-[#060a0e] rounded-xl font-semibold text-sm shadow-[0_4px_16px_rgba(0,230,118,0.35)]"
            >
              <Plus size={16} strokeWidth={2.5} />
              New Mission
            </motion.button>
          </Link>
        </div>
      </div>

      {/* Filters + Search */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-[320px]">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#3d5068]" strokeWidth={2} />
          <input
            placeholder="Search missions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 bg-[#111927] border border-[#1c2a3a] rounded-xl pl-10 pr-4 text-[#e8f0fe] placeholder-[#3d5068] text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={14} className="text-[#3d5068]" strokeWidth={2} />
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3.5 h-9 rounded-xl text-[13px] font-semibold transition-all duration-150',
                filter === f
                  ? 'bg-accent text-[#060a0e]'
                  : 'bg-[#111927] text-[#7a8fa8] border border-[#1c2a3a] hover:border-[#2a3f58]'
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#111927] border border-[#1c2a3a] rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[1fr_100px_90px_80px_80px_80px] gap-4 px-5 py-3 border-b border-[#1c2a3a]">
          {['Mission', 'Time', 'Steps', 'Difficulty', 'Status', ''].map((h) => (
            <span key={h} className="text-[11px] font-bold text-[#3d5068] uppercase tracking-wider">{h}</span>
          ))}
        </div>

        {loading ? (
          <div className="py-16 flex justify-center">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Target size={32} className="text-[#3d5068] mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-[#7a8fa8] font-medium mb-1">
              {search ? 'No missions match your search' : 'No missions yet'}
            </p>
            {!search && (
              <p className="text-[#3d5068] text-sm">
                Create one manually or use{' '}
                <button onClick={seedMissions} disabled={seeding} className="text-accent underline underline-offset-2 hover:no-underline disabled:opacity-50">
                  Seed starter missions
                </button>{' '}
                to populate 6 ready-to-go missions.
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-[#1c2a3a]">
            {filtered.map((m, i) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                className="grid grid-cols-[1fr_100px_90px_80px_80px_80px] gap-4 items-center px-5 py-4 hover:bg-[#162030] transition-colors group"
              >
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-[#e8f0fe] truncate">{m.title}</p>
                  <div className="flex gap-1.5 mt-1 flex-wrap">
                    {m.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="text-[10px] text-[#3d5068] bg-[#162030] px-2 py-0.5 rounded-full">{tag}</span>
                    ))}
                  </div>
                </div>
                <span className="text-[13px] text-[#7a8fa8]">{m.estimated_time ?? '—'}</span>
                <span className="text-[13px] text-[#7a8fa8]">{(m.steps as unknown[]).length} steps</span>
                <span className={cn('text-[11px] font-bold px-2.5 py-1 rounded-full self-start', DIFFICULTY_BADGE[m.difficulty])}>
                  {m.difficulty.charAt(0).toUpperCase() + m.difficulty.slice(1)}
                </span>
                <span className={cn('text-[11px] font-semibold px-2.5 py-1 rounded-full self-start', STATUS_BADGE[m.status])}>
                  {m.status.charAt(0).toUpperCase() + m.status.slice(1)}
                </span>
                <div className="flex items-center gap-1.5">
                  <Link href={`/admin/missions/${m.id}`}>
                    <button className="w-8 h-8 rounded-lg bg-[#162030] flex items-center justify-center text-[#7a8fa8] hover:text-accent hover:bg-[#001a0d] transition-colors">
                      <Pencil size={14} strokeWidth={2} />
                    </button>
                  </Link>
                  <button
                    onClick={() => deleteMission(m.id)}
                    disabled={deleting === m.id}
                    className="w-8 h-8 rounded-lg bg-[#162030] flex items-center justify-center text-[#7a8fa8] hover:text-[#ff5252] hover:bg-[#2a0a0a] transition-colors disabled:opacity-40"
                  >
                    <Trash2 size={14} strokeWidth={2} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
