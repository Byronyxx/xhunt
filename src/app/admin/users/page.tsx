'use client';

import { useState, useEffect } from 'react';
import { Users, ChevronDown, Shield } from 'lucide-react';
import type { DbUserProfile } from '@/lib/supabase/types';
import { cn } from '@/lib/cn';

const ROLE_BADGE: Record<string, string> = {
  platform_admin: 'text-[#fbbf24] bg-[#2a1a00]',
  tenant_admin: 'text-accent bg-accent-light',
  mission_creator: 'text-[#6D5DFD] bg-ai-light',
  analyst: 'text-[#818cf8] bg-[#0f0f2a]',
  participant: 'text-[#7a8fa8] bg-[#162030]',
};

const ROLE_OPTIONS = ['participant', 'analyst', 'mission_creator', 'tenant_admin'];

export default function AdminUsersPage() {
  const [users, setUsers] = useState<DbUserProfile[]>([]);
  const [completedCounts, setCompletedCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/admin/users');
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const { users, completedCounts } = await res.json();
      setUsers(users ?? []);
      setCompletedCounts(completedCounts ?? {});
      setLoading(false);
    }
    load();
  }, []);

  async function updateRole(userId: string, role: string) {
    setUpdating(userId);
    await fetch(`/api/workspace/settings/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: role as DbUserProfile['role'] } : u));
    setUpdating(null);
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-[28px] font-bold text-[#e8f0fe]">Users</h1>
          <p className="text-[#7a8fa8] text-sm mt-0.5">{users.length} members in your workspace</p>
        </div>
      </div>

      <div className="bg-[#111927] border border-[#1c2a3a] rounded-2xl overflow-hidden">
        <div className="grid grid-cols-[1fr_140px_120px_80px] gap-4 px-6 py-3 border-b border-[#1c2a3a]">
          {['User', 'Role', 'Joined', 'Missions'].map((h) => (
            <span key={h} className="text-[11px] font-bold text-[#3d5068] uppercase tracking-wider">{h}</span>
          ))}
        </div>

        {loading ? (
          <div className="py-16 flex justify-center">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center">
            <Users size={32} className="text-[#3d5068] mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-[#7a8fa8]">No users yet</p>
          </div>
        ) : (
          <div className="divide-y divide-[#1c2a3a]">
            {users.map((u) => (
              <div key={u.id} className="grid grid-cols-[1fr_140px_120px_80px] gap-4 items-center px-6 py-4 hover:bg-[#162030] transition-colors">
                {/* User */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 bg-gradient-to-br from-accent to-accent-dark rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-[#060a0e] font-bold text-[11px]">
                      {(u.display_name ?? 'U').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-[#e8f0fe] truncate">{u.display_name ?? 'Unknown'}</p>
                  </div>
                </div>

                {/* Role selector */}
                <div className="relative">
                  <select
                    value={u.role}
                    onChange={(e) => updateRole(u.id, e.target.value)}
                    disabled={updating === u.id}
                    className={cn(
                      'w-full h-8 rounded-lg pl-3 pr-7 text-[11px] font-bold focus:outline-none appearance-none transition-colors',
                      ROLE_BADGE[u.role] ?? 'text-[#7a8fa8] bg-[#162030]'
                    )}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r} value={r} className="bg-[#111927] text-[#e8f0fe]">
                        {r.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" strokeWidth={2} />
                </div>

                <span className="text-[13px] text-[#7a8fa8]">
                  {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>

                <span className="text-[13px] text-[#7a8fa8]">{completedCounts[u.id] ?? 0}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* RBAC legend */}
      <div className="mt-6 bg-[#111927] border border-[#1c2a3a] rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield size={15} className="text-[#7a8fa8]" strokeWidth={2} />
          <h2 className="text-[13px] font-bold text-[#7a8fa8] uppercase tracking-wider">Role Permissions</h2>
        </div>
        <div className="grid grid-cols-2 gap-3 text-[12px]">
          {[
            { role: 'Tenant Admin', desc: 'Full workspace access — manage users, missions, settings' },
            { role: 'Mission Creator', desc: 'Create and edit missions; view analytics' },
            { role: 'Analyst', desc: 'View-only access to analytics and mission data' },
            { role: 'Participant', desc: 'Can participate in missions (consumer app only)' },
          ].map(({ role, desc }) => (
            <div key={role} className="bg-[#0f1824] rounded-xl p-3">
              <p className="font-semibold text-[#e8f0fe] mb-0.5">{role}</p>
              <p className="text-[#7a8fa8]">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
