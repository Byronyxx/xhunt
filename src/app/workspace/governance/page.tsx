'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck, FileCheck, Clock, CheckCircle2, XCircle, AlertTriangle,
  Eye, ChevronRight, Users, Activity, Lock, Filter, Search,
  ScrollText, MoreHorizontal
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import type { DbMissionApproval, DbAuditLog } from '@/lib/supabase/types';

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('bg-[#0D1530] animate-pulse rounded-lg', className)} />;
}

const APPROVAL_CONFIG = {
  pending:  { label: 'Pending',  color: 'text-[#FFB84D]', bg: 'bg-[#FFB84D]/10', icon: Clock },
  approved: { label: 'Approved', color: 'text-[#22FFAA]', bg: 'bg-[#22FFAA]/10', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'text-[#FF5C7A]', bg: 'bg-[#FF5C7A]/10', icon: XCircle },
};

export default function GovernancePage() {
  const [approvals, setApprovals] = useState<DbMissionApproval[]>([]);
  const [logs, setLogs] = useState<DbAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'approvals' | 'audit'>('approvals');
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function load() {
      const res = await fetch('/api/workspace/governance');
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const { approvals, logs } = await res.json();
      setApprovals(approvals ?? []);
      setLogs(logs ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function reviewApproval(id: string, status: 'approved' | 'rejected') {
    const res = await fetch('/api/workspace/governance', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) return;
    setApprovals((prev) => prev.map((a) => a.id === id ? { ...a, status } : a));
  }

  const pending = approvals.filter((a) => a.status === 'pending').length;
  const approved = approvals.filter((a) => a.status === 'approved').length;
  const rejected = approvals.filter((a) => a.status === 'rejected').length;

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
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
          <div className="w-9 h-9 rounded-xl bg-[#FF5C7A]/10 border border-[#FF5C7A]/20 flex items-center justify-center">
            <ShieldCheck size={18} className="text-[#FF5C7A]" strokeWidth={1.8} />
          </div>
          <div>
            <h1 className="text-[22px] font-bold text-[#F0F4FF]">Governance Center</h1>
            <p className="text-[#4A5578] text-[12px]">Approvals, audit logs, and compliance</p>
          </div>
        </div>
        {pending > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#FFB84D]/10 border border-[#FFB84D]/20 rounded-xl">
            <AlertTriangle size={13} className="text-[#FFB84D]" strokeWidth={2} />
            <span className="text-[12px] font-semibold text-[#FFB84D]">{pending} pending review</span>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pending Review', value: pending,  icon: Clock,        color: 'text-[#FFB84D]', bg: 'bg-[#FFB84D]/10' },
          { label: 'Approved',       value: approved, icon: CheckCircle2, color: 'text-[#22FFAA]', bg: 'bg-[#22FFAA]/8'  },
          { label: 'Rejected',       value: rejected, icon: XCircle,      color: 'text-[#FF5C7A]', bg: 'bg-[#FF5C7A]/10' },
        ].map(({ label, value, icon: Icon, color, bg }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-[#0A1226] border border-[#0F1D35] rounded-2xl p-5"
          >
            <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center mb-3', bg)}>
              <Icon size={16} className={color} strokeWidth={1.8} />
            </div>
            <p className={cn('text-2xl font-bold tabular-nums', color)}>{value}</p>
            <p className="text-[#4A5578] text-[11px] mt-0.5 font-medium">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-[#0A1226] border border-[#0F1D35] rounded-xl p-1 w-fit">
        {([['approvals', 'Mission Approvals', pending], ['audit', 'Audit Log', logs.length]] as [string, string, number][]).map(([tab, label, count]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as typeof activeTab)}
            className={cn('h-7 px-4 rounded-lg text-[12px] font-semibold transition-all', activeTab === tab ? 'bg-[#0D1530] text-[#F0F4FF]' : 'text-[#4A5578] hover:text-[#8B9CC0]')}
          >
            {label}
            <span className={cn('ml-1.5 text-[10px]', activeTab === tab ? 'text-accent' : 'text-[#4A5578]')}>{count}</span>
          </button>
        ))}
      </div>

      {/* Approvals */}
      {activeTab === 'approvals' && (
        <div className="bg-[#0A1226] border border-[#0F1D35] rounded-2xl overflow-hidden">
          {approvals.length === 0 ? (
            <div className="py-16 text-center">
              <FileCheck size={28} className="text-[#4A5578] mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-[#8B9CC0] font-medium">No mission approvals</p>
              <p className="text-[#4A5578] text-sm mt-1">Mission approval requests will appear here.</p>
            </div>
          ) : (
            <>
              <div className="grid px-5 py-3 border-b border-[#0F1D35] bg-[#07101F]"
                style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 120px' }}>
                {['Mission', 'Status', 'Reviewer', 'Submitted', 'Actions'].map((h) => (
                  <p key={h} className="text-[10px] font-bold text-[#4A5578] uppercase tracking-wider">{h}</p>
                ))}
              </div>
              <div className="divide-y divide-[#0F1D35]">
                {approvals.map((a) => {
                  const sc = APPROVAL_CONFIG[a.status];
                  return (
                    <div key={a.id} className="grid px-5 py-4 items-center hover:bg-[#0D1530] transition-colors"
                      style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 120px' }}>
                      <div>
                        <p className="text-[12px] font-semibold text-[#F0F4FF] truncate">Mission #{a.mission_id.slice(0, 8)}</p>
                        {a.notes && <p className="text-[11px] text-[#4A5578] truncate mt-0.5">{a.notes}</p>}
                      </div>
                      <span className={cn('flex items-center gap-1.5 text-[11px] font-bold w-fit px-2 py-0.5 rounded-full', sc.color, sc.bg)}>
                        <sc.icon size={10} strokeWidth={2.5} />
                        {sc.label}
                      </span>
                      <p className="text-[11px] text-[#4A5578]">{a.reviewer_id ? `#${a.reviewer_id.slice(0, 6)}` : '—'}</p>
                      <p className="text-[11px] text-[#4A5578]">
                        {new Date(a.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                      {a.status === 'pending' ? (
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => reviewApproval(a.id, 'approved')} className="flex items-center gap-1 h-7 px-2.5 bg-[#22FFAA]/10 border border-[#22FFAA]/20 text-[#22FFAA] rounded-lg text-[11px] font-bold hover:bg-[#22FFAA]/15 transition-colors">
                            <CheckCircle2 size={11} strokeWidth={2.5} />Approve
                          </button>
                          <button onClick={() => reviewApproval(a.id, 'rejected')} className="flex items-center gap-1 h-7 px-2 bg-[#FF5C7A]/10 border border-[#FF5C7A]/20 text-[#FF5C7A] rounded-lg text-[11px] font-bold">
                            <XCircle size={11} strokeWidth={2.5} />
                          </button>
                        </div>
                      ) : (
                        <p className="text-[11px] text-[#4A5578]">Reviewed</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* Audit Log */}
      {activeTab === 'audit' && (
        <div className="bg-[#0A1226] border border-[#0F1D35] rounded-2xl overflow-hidden">
          {logs.length === 0 ? (
            <div className="py-16 text-center">
              <ScrollText size={28} className="text-[#4A5578] mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-[#8B9CC0] font-medium">No audit logs yet</p>
              <p className="text-[#4A5578] text-sm mt-1">All platform actions will be logged here for compliance.</p>
            </div>
          ) : (
            <>
              <div className="grid px-5 py-3 border-b border-[#0F1D35] bg-[#07101F]"
                style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
                {['Action', 'Resource', 'User', 'Timestamp'].map((h) => (
                  <p key={h} className="text-[10px] font-bold text-[#4A5578] uppercase tracking-wider">{h}</p>
                ))}
              </div>
              <div className="divide-y divide-[#0F1D35] max-h-[500px] overflow-y-auto">
                {logs.map((log) => (
                  <div key={log.id} className="grid px-5 py-3 items-center hover:bg-[#0D1530] transition-colors"
                    style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-[#0D1530] flex items-center justify-center flex-shrink-0">
                        <Activity size={11} className="text-[#6D5DFD]" strokeWidth={2} />
                      </div>
                      <p className="text-[12px] text-[#F0F4FF] font-medium capitalize truncate">{log.action.replace('_', ' ')}</p>
                    </div>
                    <span className="text-[11px] text-[#8B9CC0] capitalize">{log.resource_type}</span>
                    <span className="text-[11px] text-[#4A5578]">{log.user_id ? `#${log.user_id.slice(0, 8)}` : 'System'}</span>
                    <span className="text-[11px] text-[#4A5578]">
                      {new Date(log.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
