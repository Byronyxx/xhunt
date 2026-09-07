'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  UserSquare2, Plus, Search, Users, Tag, Filter, ChevronRight,
  MoreHorizontal, Edit2, Trash2, Check, AlertCircle, Activity,
  Target, TrendingUp, Shield
} from 'lucide-react';
import { cn } from '@/lib/cn';
import type { DbAudienceSegment, DbUserProfile } from '@/lib/supabase/types';

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('bg-[#0D1530] animate-pulse rounded-lg', className)} />;
}

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  platform_admin: { label: 'Platform Admin', color: 'text-[#FF5C7A]', bg: 'bg-[#FF5C7A]/10' },
  tenant_admin:   { label: 'Admin',          color: 'text-[#6D5DFD]', bg: 'bg-[#6D5DFD]/10' },
  mission_creator:{ label: 'Creator',        color: 'text-[#FFB84D]', bg: 'bg-[#FFB84D]/10' },
  analyst:        { label: 'Analyst',        color: 'text-[#22FFAA]', bg: 'bg-[#22FFAA]/10' },
  participant:    { label: 'Participant',    color: 'text-[#8B9CC0]', bg: 'bg-[#8B9CC0]/10' },
};

export default function AudiencePage() {
  const [segments, setSegments] = useState<DbAudienceSegment[]>([]);
  const [users, setUsers] = useState<DbUserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'segments' | 'users'>('segments');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/workspace/audience');
        if (!res.ok) return;
        const data = await res.json();
        setTenantId(data.tenantId ?? null);
        setSegments(data.segments ?? []);
        setUsers(data.users ?? []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function createSegment() {
    if (!newName.trim() || !tenantId) return;
    setSaving(true);
    try {
      const res = await fetch('/api/workspace/audience', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || undefined }),
      });
      if (res.ok) {
        const { segment } = await res.json();
        setSegments((prev) => [segment, ...prev]);
      }
    } finally {
      setNewName('');
      setNewDesc('');
      setCreating(false);
      setSaving(false);
    }
  }

  const filteredSegments = segments.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredUsers = users.filter((u) =>
    !search || (u.display_name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const roleCounts: Record<string, number> = {};
  users.forEach((u) => { roleCounts[u.role] = (roleCounts[u.role] ?? 0) + 1; });

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
        <Skeleton className="h-[400px] rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#6D5DFD]/10 border border-[#6D5DFD]/20 flex items-center justify-center">
            <UserSquare2 size={18} className="text-[#6D5DFD]" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="text-[22px] font-bold text-[#F0F4FF]">Audience Center</h1>
            <p className="text-[#4A5578] text-[12px]">{users.length} participants · {segments.length} segments</p>
          </div>
        </div>
        <button
          onClick={() => setCreating(!creating)}
          className="flex items-center gap-2 h-9 px-4 bg-accent text-[#060a0e] rounded-xl font-semibold text-[13px] shadow-[0_4px_16px_rgba(34,255,170,0.25)]"
        >
          <Plus size={14} strokeWidth={2.5} />
          New Segment
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-3">
        {Object.entries(ROLE_LABELS).map(([role, cfg]) => (
          <div key={role} className="bg-[#0A1226] border border-[#0F1D35] rounded-xl p-4 flex items-center gap-3">
            <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center', cfg.bg)}>
              <Shield size={14} className={cfg.color} strokeWidth={1.8} />
            </div>
            <div>
              <p className={cn('text-[20px] font-bold tabular-nums', cfg.color)}>{roleCounts[role] ?? 0}</p>
              <p className="text-[#4A5578] text-[10px] font-medium">{cfg.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Create Segment */}
      {creating && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#0A1226] border border-accent/20 rounded-2xl p-5"
        >
          <p className="text-[13px] font-bold text-[#F0F4FF] mb-4">Create Audience Segment</p>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-[10px] font-bold text-[#4A5578] uppercase tracking-wider mb-1.5 block">Segment Name *</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Power Users"
                className="w-full h-9 px-3 bg-[#07101F] border border-[#0F1D35] rounded-xl text-[13px] text-[#F0F4FF] placeholder:text-[#4A5578] focus:outline-none focus:border-[#162440]"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#4A5578] uppercase tracking-wider mb-1.5 block">Description</label>
              <input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Optional description"
                className="w-full h-9 px-3 bg-[#07101F] border border-[#0F1D35] rounded-xl text-[13px] text-[#F0F4FF] placeholder:text-[#4A5578] focus:outline-none focus:border-[#162440]"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={createSegment} disabled={saving || !newName.trim()} className="flex items-center gap-2 h-8 px-4 bg-accent text-[#060a0e] rounded-xl text-[12px] font-semibold disabled:opacity-50">
              <Check size={12} strokeWidth={2.5} />{saving ? 'Creating…' : 'Create Segment'}
            </button>
            <button onClick={() => setCreating(false)} className="h-8 px-3 bg-[#07101F] border border-[#0F1D35] rounded-xl text-[12px] text-[#8B9CC0]">Cancel</button>
          </div>
        </motion.div>
      )}

      {/* Tabs + Search */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 bg-[#0A1226] border border-[#0F1D35] rounded-xl p-1">
          {([['segments', 'Segments'], ['users', 'Users']] as const).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn('h-7 px-4 rounded-lg text-[12px] font-semibold transition-all', activeTab === tab ? 'bg-[#0D1530] text-[#F0F4FF]' : 'text-[#4A5578] hover:text-[#8B9CC0]')}
            >{label} <span className={cn('ml-1 text-[10px]', activeTab === tab ? 'text-accent' : 'text-[#4A5578]')}>{tab === 'segments' ? segments.length : users.length}</span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A5578]" strokeWidth={2} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={activeTab === 'segments' ? 'Search segments…' : 'Search users…'}
            className="w-64 h-9 pl-8 pr-3 bg-[#0A1226] border border-[#0F1D35] rounded-xl text-[13px] text-[#F0F4FF] placeholder:text-[#4A5578] focus:outline-none focus:border-[#162440]"
          />
        </div>
      </div>

      {/* Content */}
      {activeTab === 'segments' ? (
        <div className="grid grid-cols-3 gap-4">
          {filteredSegments.length === 0 ? (
            <div className="col-span-3 bg-[#0A1226] border border-[#0F1D35] rounded-2xl py-16 text-center">
              <UserSquare2 size={28} className="text-[#4A5578] mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-[#8B9CC0] font-medium">No segments yet</p>
              <p className="text-[#4A5578] text-sm mt-1">Create audience segments to target specific user groups.</p>
            </div>
          ) : (
            filteredSegments.map((seg, i) => (
              <motion.div
                key={seg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-[#0A1226] border border-[#0F1D35] rounded-2xl p-5 hover:border-[#162440] transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-xl bg-[#6D5DFD]/10 border border-[#6D5DFD]/15 flex items-center justify-center">
                    <Users size={16} className="text-[#6D5DFD]" strokeWidth={1.8} />
                  </div>
                </div>
                <h3 className="text-[14px] font-bold text-[#F0F4FF] mb-1">{seg.name}</h3>
                {seg.description && <p className="text-[12px] text-[#4A5578] mb-3">{seg.description}</p>}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {Object.entries(seg.filters ?? {}).slice(0, 3).map(([k, v]) => (
                    <span key={k} className="text-[10px] font-semibold px-2 py-0.5 bg-[#6D5DFD]/10 border border-[#6D5DFD]/20 text-[#A99FFE] rounded-full capitalize">
                      {k}: {Array.isArray(v) ? v.join(', ') : String(v)}
                    </span>
                  ))}
                  {Object.keys(seg.filters ?? {}).length === 0 && (
                    <span className="text-[10px] text-[#4A5578]">No filters defined</span>
                  )}
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-[#0F1D35]">
                  <p className="text-[10px] text-[#4A5578]">
                    {new Date(seg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                  <button className="text-[11px] font-semibold text-[#8B9CC0] hover:text-accent transition-colors flex items-center gap-1">
                    Configure <ChevronRight size={11} strokeWidth={2} />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      ) : (
        <div className="bg-[#0A1226] border border-[#0F1D35] rounded-2xl overflow-hidden">
          {filteredUsers.length === 0 ? (
            <div className="py-16 text-center">
              <Users size={28} className="text-[#4A5578] mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-[#8B9CC0] font-medium">No users found</p>
            </div>
          ) : (
            <>
              <div className="grid px-5 py-3 border-b border-[#0F1D35] bg-[#07101F]"
                style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
                {['User', 'Role', 'Tier', 'Joined'].map((h) => (
                  <p key={h} className="text-[10px] font-bold text-[#4A5578] uppercase tracking-wider">{h}</p>
                ))}
              </div>
              <div className="divide-y divide-[#0F1D35]">
                {filteredUsers.map((u) => {
                  const rc = ROLE_LABELS[u.role] ?? ROLE_LABELS.participant;
                  const initials = (u.display_name ?? 'U').slice(0, 2).toUpperCase();
                  return (
                    <div key={u.id} className="grid px-5 py-3.5 items-center hover:bg-[#0D1530] transition-colors"
                      style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6D5DFD] to-accent flex items-center justify-center text-[10px] font-bold text-[#060a0e] flex-shrink-0">
                          {initials}
                        </div>
                        <div>
                          <p className="text-[13px] font-medium text-[#F0F4FF]">{u.display_name ?? 'Anonymous'}</p>
                          <p className="text-[10px] text-[#4A5578]">{u.interests?.slice(0, 2).join(', ') || '—'}</p>
                        </div>
                      </div>
                      <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full w-fit', rc.color, rc.bg)}>{rc.label}</span>
                      <span className={cn(
                        'text-[11px] font-bold px-2 py-0.5 rounded-full w-fit capitalize',
                        u.subscription_tier === 'pro' ? 'text-[#22FFAA] bg-[#22FFAA]/10'
                        : u.subscription_tier === 'trial' ? 'text-[#FFB84D] bg-[#FFB84D]/10'
                        : 'text-[#4A5578] bg-[#4A5578]/10'
                      )}>{u.subscription_tier}</span>
                      <p className="text-[11px] text-[#4A5578]">
                        {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
