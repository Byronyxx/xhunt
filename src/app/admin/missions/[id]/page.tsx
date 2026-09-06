'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Save, Loader2, AlertCircle, Plus, Trash2,
  ChevronDown, CheckCircle2, Clock, BarChart3, Sparkles,
  Brain, Users, Gift, ChevronRight, ShieldCheck, Play, Pause, Archive,
} from 'lucide-react';
import Link from 'next/link';
import type { DbMission, DbStep, DbAudienceSegment, DbRewardConfig, DbMissionApproval, MissionStatus } from '@/lib/supabase/types';
import { cn } from '@/lib/cn';

const STEP_TYPES: DbStep['type'][] = ['action', 'reflection', 'discovery'];
const STEP_TYPE_COLORS: Record<string, string> = {
  action: 'text-[#fb923c] bg-[#1a0f00] border-[#2a1800]',
  reflection: 'text-[#818cf8] bg-[#0f0f2a] border-[#1a1a3a]',
  discovery: 'text-[#2dd4bf] bg-[#001a1a] border-[#002a2a]',
};

type AgentPanel = 'behavioral' | 'designer' | null;

const STATUS_CONFIG: Record<MissionStatus, { color: string; bg: string; border: string; description: string }> = {
  draft:     { color: 'text-[#fbbf24]', bg: 'bg-[#2a1a00]',  border: 'border-[#3a2800]',   description: 'Work in progress — not visible to participants' },
  active:    { color: 'text-accent',    bg: 'bg-accent/10',  border: 'border-accent/20',   description: 'Live — accessible to linked audience segments' },
  published: { color: 'text-[#6D5DFD]', bg: 'bg-[#001a22]',  border: 'border-[#003040]',   description: 'Publicly available to all eligible participants' },
  paused:    { color: 'text-[#7a8fa8]', bg: 'bg-[#162030]',  border: 'border-[#1c2a3a]',   description: 'Temporarily paused — no new participants admitted' },
  archived:  { color: 'text-[#3d5068]', bg: 'bg-[#0f1824]',  border: 'border-[#1c2a3a]',   description: 'Archived — read only, no longer active' },
};

export default function MissionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const missionId = params?.id as string;

  const [mission, setMission] = useState<DbMission | null>(null);
  const [steps, setSteps] = useState<DbStep[]>([]);
  const [completions, setCompletions] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Agent panels
  const [activePanel, setActivePanel] = useState<AgentPanel>(null);
  const [agentLoading, setAgentLoading] = useState(false);
  const [behavioralResult, setBehavioralResult] = useState<Record<string, unknown> | null>(null);
  const [designerResult, setDesignerResult] = useState<Record<string, unknown> | null>(null);

  // Audience + Reward linking
  const [segments, setSegments] = useState<DbAudienceSegment[]>([]);
  const [rewards, setRewards] = useState<DbRewardConfig[]>([]);
  const [linkedSegments, setLinkedSegments] = useState<Set<string>>(new Set());
  const [linkedRewards, setLinkedRewards] = useState<Set<string>>(new Set());
  const [linkSaving, setLinkSaving] = useState(false);
  const [pendingApproval, setPendingApproval] = useState<DbMissionApproval | null>(null);
  const [govLoading, setGovLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/missions/${missionId}`);
      if (!res.ok) { setLoading(false); return; }
      const json = await res.json();

      setMission(json.mission ?? null);
      setSteps((json.mission?.steps as DbStep[]) ?? []);
      setCompletions(json.completions ?? 0);
      setSegments((json.segments as DbAudienceSegment[]) ?? []);
      setRewards((json.rewards as DbRewardConfig[]) ?? []);
      setLinkedSegments(new Set((json.linkedSegmentIds ?? []) as string[]));
      setLinkedRewards(new Set((json.linkedRewardIds ?? []) as string[]));
      setPendingApproval(json.pendingApproval ?? null);
    } catch {
      // leave state as-is on network failure
    }
    setLoading(false);
  }, [missionId]);

  useEffect(() => { load(); }, [load]);

  function updateField<K extends keyof DbMission>(field: K, value: DbMission[K]) {
    setMission((prev) => prev ? { ...prev, [field]: value } : prev);
    setSaved(false);
  }

  function updateStep(id: number, field: keyof DbStep, value: string) {
    setSteps((prev) => prev.map((s) => s.id === id ? { ...s, [field]: value } : s));
    setSaved(false);
  }

  function addStep() {
    setSteps((prev) => [...prev, { id: Date.now(), type: 'action', instruction: '', success_criteria: '' }]);
  }

  function removeStep(id: number) {
    setSteps((prev) => prev.filter((s) => s.id !== id));
  }

  async function handleSave() {
    if (!mission) return;
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/admin/missions/${missionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: mission.title,
          story_context: mission.story_context,
          difficulty: mission.difficulty,
          estimated_time: mission.estimated_time,
          tags: mission.tags,
          reward: mission.reward,
          status: mission.status,
          is_public: mission.is_public,
          steps,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Save failed');
      } else {
        setMission(json.mission ?? mission);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } catch {
      setError('Save request failed — is the server running?');
    }
    setSaving(false);
  }

  async function runBehavioralAnalyst() {
    setAgentLoading(true);
    try {
      const analyticsRes = await fetch(`/api/admin/missions/${missionId}/analytics`);
      const analyticsJson = await analyticsRes.json();
      const res = await fetch('/api/agents/behavioral-analyst', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          missionId,
          progressData: analyticsJson.progressData ?? [],
          stepDropoffs: analyticsJson.stepDropoffs ?? [],
        }),
      });
      if (!res.ok) throw new Error('API error');
      setBehavioralResult(await res.json() as Record<string, unknown>);
    } catch { /* silent */ }
    setAgentLoading(false);
  }

  async function runExperienceDesigner() {
    if (!mission) return;
    setAgentLoading(true);
    try {
      const res = await fetch('/api/agents/experience-designer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mission: { ...mission, steps } }),
      });
      if (!res.ok) throw new Error('API error');
      setDesignerResult(await res.json() as Record<string, unknown>);
    } catch { /* silent */ }
    setAgentLoading(false);
  }

  function applyDesignerSteps() {
    if (!designerResult) return;
    const redesigned = designerResult.redesigned_steps as { type: string; instruction: string; success_criteria: string }[];
    if (Array.isArray(redesigned)) {
      setSteps(redesigned.map((s, i) => ({ id: i + 1, type: s.type as DbStep['type'], instruction: s.instruction, success_criteria: s.success_criteria })));
      setSaved(false);
      setDesignerResult(null);
      setActivePanel(null);
    }
  }

  async function saveLinks() {
    setLinkSaving(true);
    try {
      const res = await fetch(`/api/admin/missions/${missionId}/links`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segmentIds: [...linkedSegments],
          rewardIds: [...linkedRewards],
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json.error ?? 'Failed to save links');
      }
    } catch {
      alert('Save links request failed — is the server running?');
    }
    setLinkSaving(false);
  }

  function toggleSegment(id: string) {
    setLinkedSegments((prev) => { const n = new Set(prev); if (n.has(id)) { n.delete(id); } else { n.add(id); } return n; });
  }

  function toggleReward(id: string) {
    setLinkedRewards((prev) => { const n = new Set(prev); if (n.has(id)) { n.delete(id); } else { n.add(id); } return n; });
  }

  async function submitForReview() {
    if (!mission) return;
    setGovLoading(true);
    try {
      const res = await fetch(`/api/admin/missions/${missionId}/review`, { method: 'POST' });
      const json = await res.json();
      if (res.ok) setPendingApproval(json.pendingApproval ?? null);
    } catch {
      // silent — banner just won't update
    }
    setGovLoading(false);
  }

  async function changeStatus(newStatus: MissionStatus) {
    if (!mission) return;
    setGovLoading(true);
    const goPublic = newStatus === 'active' || newStatus === 'published';
    try {
      const res = await fetch(`/api/admin/missions/${missionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: newStatus,
          ...(goPublic ? { is_public: true } : {}),
        }),
      });
      if (res.ok) {
        setMission((prev) => prev ? { ...prev, status: newStatus, ...(goPublic ? { is_public: true } : {}) } : prev);
        setSaved(false);
      }
    } catch {
      // silent
    }
    setGovLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!mission) return <div className="p-8 text-[#7a8fa8]">Mission not found.</div>;

  return (
    <div className="p-8 max-w-[860px]">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => router.back()} className="w-9 h-9 bg-[#111927] border border-[#1c2a3a] rounded-xl flex items-center justify-center text-[#7a8fa8] hover:text-[#e8f0fe] transition-colors">
          <ArrowLeft size={17} strokeWidth={2} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[22px] font-bold text-[#e8f0fe] truncate">{mission.title}</h1>
          <p className="text-[#7a8fa8] text-sm mt-0.5">Created {new Date(mission.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
        </div>
        <motion.button whileTap={{ scale: 0.97 }} onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 h-10 px-5 bg-accent text-[#060a0e] rounded-xl font-semibold text-sm shadow-[0_4px_16px_rgba(0,230,118,0.35)] disabled:opacity-60">
          {saved ? (<><CheckCircle2 size={15} strokeWidth={2.5} /> Saved</>) : saving ? (<Loader2 size={15} strokeWidth={2} className="animate-spin" />) : (<><Save size={15} strokeWidth={2} /> Save changes</>)}
        </motion.button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Completions', value: completions, icon: CheckCircle2, color: 'text-accent' },
          { label: 'Steps', value: steps.length, icon: BarChart3, color: 'text-[#6D5DFD]' },
          { label: 'Duration', value: mission.estimated_time ?? '—', icon: Clock, color: 'text-[#fbbf24]' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-[#111927] border border-[#1c2a3a] rounded-2xl p-4 flex items-center gap-3">
            <Icon size={20} className={color} strokeWidth={2} />
            <div>
              <p className={cn('text-[20px] font-bold', color)}>{value}</p>
              <p className="text-[11px] text-[#7a8fa8] font-medium">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-[#2a0a0a] border border-[#ff5252]/30 rounded-xl px-4 py-3 mb-5">
          <AlertCircle size={15} className="text-[#ff5252]" strokeWidth={2} />
          <p className="text-[13px] text-[#ff5252]">{error}</p>
        </div>
      )}

      {/* Details */}
      <div className="bg-[#111927] border border-[#1c2a3a] rounded-2xl p-6 mb-5">
        <h2 className="text-[15px] font-bold text-[#e8f0fe] mb-5">Mission Details</h2>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-[12px] font-semibold text-[#7a8fa8] uppercase tracking-wider mb-1.5 block">Title</label>
            <input value={mission.title} onChange={(e) => updateField('title', e.target.value)}
              className="w-full h-11 bg-[#0f1824] border border-[#1c2a3a] rounded-xl px-4 text-[#e8f0fe] text-sm focus:outline-none focus:border-accent transition-colors" />
          </div>
          <div>
            <label className="text-[12px] font-semibold text-[#7a8fa8] uppercase tracking-wider mb-1.5 block">Story / Description</label>
            <textarea value={mission.story_context ?? ''} onChange={(e) => updateField('story_context', e.target.value)} rows={3}
              className="w-full bg-[#0f1824] border border-[#1c2a3a] rounded-xl px-4 py-3 text-[#e8f0fe] text-sm focus:outline-none focus:border-accent transition-colors resize-none" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-[12px] font-semibold text-[#7a8fa8] uppercase tracking-wider mb-1.5 block">Difficulty</label>
              <div className="relative">
                <select value={mission.difficulty} onChange={(e) => updateField('difficulty', e.target.value as DbMission['difficulty'])}
                  className="w-full h-11 bg-[#0f1824] border border-[#1c2a3a] rounded-xl px-4 text-[#e8f0fe] text-sm focus:outline-none focus:border-accent appearance-none">
                  {['easy','medium','hard'].map((d) => <option key={d} value={d}>{d.charAt(0).toUpperCase()+d.slice(1)}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#3d5068] pointer-events-none" strokeWidth={2} />
              </div>
            </div>
            <div>
              <label className="text-[12px] font-semibold text-[#7a8fa8] uppercase tracking-wider mb-1.5 block">Est. Time</label>
              <input value={mission.estimated_time ?? ''} onChange={(e) => updateField('estimated_time', e.target.value)}
                className="w-full h-11 bg-[#0f1824] border border-[#1c2a3a] rounded-xl px-4 text-[#e8f0fe] text-sm focus:outline-none focus:border-accent transition-colors" />
            </div>
            <div>
              <label className="text-[12px] font-semibold text-[#7a8fa8] uppercase tracking-wider mb-1.5 block">Reward</label>
              <input value={mission.reward} onChange={(e) => updateField('reward', e.target.value)}
                className="w-full h-11 bg-[#0f1824] border border-[#1c2a3a] rounded-xl px-4 text-[#e8f0fe] text-sm focus:outline-none focus:border-accent transition-colors" />
            </div>
          </div>
          <div>
            <label className="text-[12px] font-semibold text-[#7a8fa8] uppercase tracking-wider mb-1.5 block">Tags (comma-separated)</label>
            <input value={mission.tags.join(', ')} onChange={(e) => updateField('tags', e.target.value.split(',').map((t) => t.trim()).filter(Boolean))}
              className="w-full h-11 bg-[#0f1824] border border-[#1c2a3a] rounded-xl px-4 text-[#e8f0fe] text-sm focus:outline-none focus:border-accent transition-colors" />
          </div>
          <div className="flex items-center justify-between bg-[#0f1824] border border-[#1c2a3a] rounded-xl px-4 py-3">
            <div>
              <p className="text-[13px] font-semibold text-[#e8f0fe]">Visible in consumer app</p>
              <p className="text-[11px] text-[#3d5068] mt-0.5">When on, this mission appears in participants&apos; home feed</p>
            </div>
            <button
              onClick={() => updateField('is_public', !mission.is_public)}
              className={cn(
                'relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0',
                mission.is_public ? 'bg-accent' : 'bg-[#1c2a3a]'
              )}
            >
              <span className={cn(
                'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200',
                mission.is_public ? 'translate-x-5' : 'translate-x-0'
              )} />
            </button>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="bg-[#111927] border border-[#1c2a3a] rounded-2xl p-6 mb-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[15px] font-bold text-[#e8f0fe]">Steps ({steps.length})</h2>
          <button onClick={addStep}
            className="flex items-center gap-1.5 h-8 px-3 bg-[#162030] border border-[#1c2a3a] rounded-lg text-[#7a8fa8] hover:text-accent hover:border-accent/30 text-sm font-medium transition-colors">
            <Plus size={14} strokeWidth={2.5} /> Add step
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {steps.map((step, i) => (
            <div key={step.id} className="bg-[#0f1824] border border-[#1c2a3a] rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[12px] font-bold text-[#3d5068] w-5">#{i + 1}</span>
                <div className="flex gap-1.5">
                  {STEP_TYPES.map((t) => (
                    <button key={t} onClick={() => updateStep(step.id, 'type', t)}
                      className={cn('px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all',
                        step.type === t ? STEP_TYPE_COLORS[t] : 'text-[#3d5068] bg-transparent border-[#1c2a3a]')}>
                      {t}
                    </button>
                  ))}
                </div>
                <button onClick={() => removeStep(step.id)} disabled={steps.length === 1}
                  className="ml-auto text-[#3d5068] hover:text-[#ff5252] transition-colors disabled:opacity-30">
                  <Trash2 size={14} strokeWidth={2} />
                </button>
              </div>
              <div className="flex flex-col gap-2 pl-8">
                <textarea value={step.instruction} onChange={(e) => updateStep(step.id, 'instruction', e.target.value)}
                  placeholder="Instruction" rows={2}
                  className="w-full bg-[#111927] border border-[#1c2a3a] rounded-lg px-3 py-2.5 text-[#e8f0fe] placeholder-[#3d5068] text-[13px] focus:outline-none focus:border-accent transition-colors resize-none" />
                <input value={step.success_criteria} onChange={(e) => updateStep(step.id, 'success_criteria', e.target.value)}
                  placeholder="Success criteria"
                  className="w-full h-9 bg-[#111927] border border-[#1c2a3a] rounded-lg px-3 text-[#e8f0fe] placeholder-[#3d5068] text-[12px] focus:outline-none focus:border-accent transition-colors" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Governance */}
      <div className="bg-[#111927] border border-[#1c2a3a] rounded-2xl p-6 mb-5">
        <h2 className="text-[15px] font-bold text-[#e8f0fe] mb-5 flex items-center gap-2">
          <ShieldCheck size={15} className="text-[#818cf8]" strokeWidth={2} /> Mission Governance
        </h2>

        {/* Status badge */}
        <div className="flex items-center gap-3 mb-5">
          <span className={cn('px-3 py-1.5 rounded-xl font-bold text-sm border', STATUS_CONFIG[mission.status].color, STATUS_CONFIG[mission.status].bg, STATUS_CONFIG[mission.status].border)}>
            {mission.status.charAt(0).toUpperCase() + mission.status.slice(1)}
          </span>
          <p className="text-[13px] text-[#7a8fa8]">{STATUS_CONFIG[mission.status].description}</p>
        </div>

        {/* Pending approval banner */}
        {pendingApproval?.status === 'pending' && (
          <div className="flex items-center justify-between bg-[#2a1a00] border border-[#fbbf24]/20 rounded-xl px-4 py-3 mb-4">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-[#fbbf24]" strokeWidth={2} />
              <p className="text-[13px] font-semibold text-[#fbbf24]">Review pending</p>
              <p className="text-[12px] text-[#7a8fa8]">— awaiting admin approval</p>
            </div>
            <Link href="/admin/governance" className="text-[12px] font-semibold text-[#fbbf24] hover:underline">
              View in Governance →
            </Link>
          </div>
        )}

        {pendingApproval?.status === 'approved' && mission.status === 'draft' && (
          <div className="flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-xl px-4 py-3 mb-4">
            <CheckCircle2 size={14} className="text-accent" strokeWidth={2} />
            <p className="text-[13px] font-semibold text-accent">Approved — ready to publish</p>
          </div>
        )}

        {/* Workflow actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {mission.status === 'draft' && pendingApproval?.status !== 'pending' && (
            <button onClick={submitForReview} disabled={govLoading}
              className="flex items-center gap-2 h-9 px-4 bg-[#818cf8]/10 border border-[#818cf8]/20 rounded-xl text-[#818cf8] text-sm font-semibold hover:bg-[#818cf8]/20 transition-colors disabled:opacity-60">
              {govLoading ? <Loader2 size={14} className="animate-spin" strokeWidth={2} /> : <ShieldCheck size={14} strokeWidth={2} />}
              Submit for Review
            </button>
          )}
          {(mission.status === 'draft' && pendingApproval?.status === 'approved') && (
            <button onClick={() => changeStatus('active')} disabled={govLoading}
              className="flex items-center gap-2 h-9 px-4 bg-accent text-[#060a0e] rounded-xl text-sm font-bold shadow-[0_2px_12px_rgba(0,230,118,0.3)] disabled:opacity-60">
              {govLoading ? <Loader2 size={14} className="animate-spin" strokeWidth={2} /> : <Play size={14} strokeWidth={2.5} />}
              Publish Mission
            </button>
          )}
          {(mission.status === 'active' || mission.status === 'published') && (
            <>
              <button onClick={() => changeStatus('paused')} disabled={govLoading}
                className="flex items-center gap-2 h-9 px-4 bg-[#162030] border border-[#1c2a3a] rounded-xl text-[#7a8fa8] text-sm font-semibold hover:text-[#e8f0fe] transition-colors disabled:opacity-60">
                {govLoading ? <Loader2 size={14} className="animate-spin" strokeWidth={2} /> : <Pause size={14} strokeWidth={2} />}
                Pause
              </button>
              <button onClick={() => changeStatus('archived')} disabled={govLoading}
                className="flex items-center gap-2 h-9 px-4 bg-[#162030] border border-[#1c2a3a] rounded-xl text-[#7a8fa8] text-sm font-semibold hover:text-[#ff5252] hover:border-[#ff5252]/30 transition-colors disabled:opacity-60">
                <Archive size={14} strokeWidth={2} /> Archive
              </button>
            </>
          )}
          {mission.status === 'paused' && (
            <>
              <button onClick={() => changeStatus('active')} disabled={govLoading}
                className="flex items-center gap-2 h-9 px-4 bg-accent text-[#060a0e] rounded-xl text-sm font-bold shadow-[0_2px_12px_rgba(0,230,118,0.3)] disabled:opacity-60">
                {govLoading ? <Loader2 size={14} className="animate-spin" strokeWidth={2} /> : <Play size={14} strokeWidth={2.5} />}
                Reactivate
              </button>
              <button onClick={() => changeStatus('archived')} disabled={govLoading}
                className="flex items-center gap-2 h-9 px-4 bg-[#162030] border border-[#1c2a3a] rounded-xl text-[#7a8fa8] text-sm font-semibold hover:text-[#ff5252] hover:border-[#ff5252]/30 transition-colors disabled:opacity-60">
                <Archive size={14} strokeWidth={2} /> Archive
              </button>
            </>
          )}
          {mission.status === 'archived' && (
            <p className="text-[12px] text-[#3d5068] italic">This mission is archived. No actions available.</p>
          )}
        </div>
      </div>

      {/* AI Insights */}
      <div className="bg-[#111927] border border-[#1c2a3a] rounded-2xl p-6 mb-5">
        <h2 className="text-[15px] font-bold text-[#e8f0fe] mb-4 flex items-center gap-2">
          <Sparkles size={15} className="text-ai" strokeWidth={2} /> AI Insights
        </h2>

        <div className="flex flex-col gap-2">
          {/* Behavioral Analyst */}
          <div className="border border-[#1c2a3a] rounded-xl overflow-hidden">
            <button
              onClick={() => setActivePanel(activePanel === 'behavioral' ? null : 'behavioral')}
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[#0f1824] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#0a1a2a] rounded-lg flex items-center justify-center">
                  <Brain size={15} className="text-ai" strokeWidth={2} />
                </div>
                <div className="text-left">
                  <p className="text-[13px] font-semibold text-[#e8f0fe]">Behavioral Analyst</p>
                  <p className="text-[11px] text-[#3d5068]">Identify drop-off patterns and bottlenecks</p>
                </div>
              </div>
              <ChevronRight size={16} className={cn('text-[#3d5068] transition-transform', activePanel === 'behavioral' && 'rotate-90')} strokeWidth={2} />
            </button>

            <AnimatePresence>
              {activePanel === 'behavioral' && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }} className="overflow-hidden border-t border-[#1c2a3a]">
                  <div className="px-4 pb-4 pt-3">
                    <button onClick={runBehavioralAnalyst} disabled={agentLoading}
                      className="flex items-center gap-2 h-9 px-4 bg-ai/10 border border-ai/20 rounded-lg text-ai text-sm font-semibold hover:bg-ai/20 transition-colors disabled:opacity-60 mb-4">
                      {agentLoading ? <Loader2 size={14} className="animate-spin" strokeWidth={2} /> : <Brain size={14} strokeWidth={2} />}
                      Run analysis
                    </button>

                    {behavioralResult !== null && (
                      <div className="space-y-4">
                        {Array.isArray(behavioralResult.bottlenecks) && behavioralResult.bottlenecks.length > 0 && (
                          <div>
                            <p className="text-[11px] font-bold text-[#7a8fa8] uppercase tracking-wider mb-2">Bottlenecks</p>
                            <div className="flex flex-col gap-1.5">
                              {(behavioralResult.bottlenecks as { step_id: number; issue: string; severity: string }[]).map((b, i) => (
                                <div key={i} className="flex items-start gap-2 bg-[#0f1824] rounded-lg px-3 py-2">
                                  <span className="text-[11px] font-bold text-[#3d5068] mt-0.5">Step {b.step_id}</span>
                                  <p className="text-[12px] text-[#7a8fa8] flex-1">{b.issue}</p>
                                  <span className={cn('text-[10px] font-bold uppercase px-1.5 py-0.5 rounded',
                                    b.severity === 'high' ? 'bg-red-900/40 text-red-400' : 'bg-yellow-900/40 text-yellow-400')}>
                                    {b.severity}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {Array.isArray(behavioralResult.recommendations) && behavioralResult.recommendations.length > 0 && (
                          <div>
                            <p className="text-[11px] font-bold text-[#7a8fa8] uppercase tracking-wider mb-2">Recommendations</p>
                            <div className="flex flex-col gap-1.5">
                              {(behavioralResult.recommendations as { action: string; priority: string }[]).map((r, i) => (
                                <div key={i} className="flex items-start gap-2 bg-[#0f1824] rounded-lg px-3 py-2">
                                  <span className="text-[11px] font-bold text-ai mt-0.5">{i + 1}.</span>
                                  <p className="text-[12px] text-[#e8f0fe]">{r.action}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Experience Designer */}
          <div className="border border-[#1c2a3a] rounded-xl overflow-hidden">
            <button
              onClick={() => setActivePanel(activePanel === 'designer' ? null : 'designer')}
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-[#0f1824] transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[#001a1a] rounded-lg flex items-center justify-center">
                  <Sparkles size={15} className="text-[#2dd4bf]" strokeWidth={2} />
                </div>
                <div className="text-left">
                  <p className="text-[13px] font-semibold text-[#e8f0fe]">Experience Designer</p>
                  <p className="text-[11px] text-[#3d5068]">Redesign steps for better engagement</p>
                </div>
              </div>
              <ChevronRight size={16} className={cn('text-[#3d5068] transition-transform', activePanel === 'designer' && 'rotate-90')} strokeWidth={2} />
            </button>

            <AnimatePresence>
              {activePanel === 'designer' && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }} className="overflow-hidden border-t border-[#1c2a3a]">
                  <div className="px-4 pb-4 pt-3">
                    <button onClick={runExperienceDesigner} disabled={agentLoading}
                      className="flex items-center gap-2 h-9 px-4 bg-[#001a1a] border border-[#2dd4bf]/20 rounded-lg text-[#2dd4bf] text-sm font-semibold hover:bg-[#002a2a] transition-colors disabled:opacity-60 mb-4">
                      {agentLoading ? <Loader2 size={14} className="animate-spin" strokeWidth={2} /> : <Sparkles size={14} strokeWidth={2} />}
                      Redesign experience
                    </button>

                    {designerResult !== null && (
                      <div className="space-y-4">
                        {designerResult.narrative != null && (
                          <div className="bg-[#001a1a] border border-[#2dd4bf]/20 rounded-lg px-3 py-2.5">
                            <p className="text-[12px] text-[#2dd4bf] leading-relaxed">{String(designerResult.narrative)}</p>
                          </div>
                        )}
                        {Array.isArray(designerResult.redesigned_steps) && (
                          <div>
                            <p className="text-[11px] font-bold text-[#7a8fa8] uppercase tracking-wider mb-2">
                              Redesigned Steps ({(designerResult.redesigned_steps as unknown[]).length})
                            </p>
                            <div className="flex flex-col gap-1.5 mb-3">
                              {(designerResult.redesigned_steps as { instruction: string; success_criteria: string }[]).map((s, i) => (
                                <div key={i} className="bg-[#0f1824] rounded-lg px-3 py-2.5">
                                  <p className="text-[12px] font-semibold text-[#e8f0fe] mb-1">{i + 1}. {s.instruction}</p>
                                  <p className="text-[11px] text-[#3d5068]">{s.success_criteria}</p>
                                </div>
                              ))}
                            </div>
                            <button onClick={applyDesignerSteps}
                              className="flex items-center gap-2 h-9 px-4 bg-accent text-[#060a0e] rounded-lg text-sm font-bold shadow-[0_2px_12px_rgba(0,230,118,0.3)]">
                              <CheckCircle2 size={14} strokeWidth={2.5} /> Apply redesigned steps
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Audience + Reward Linking */}
      <div className="bg-[#111927] border border-[#1c2a3a] rounded-2xl p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15px] font-bold text-[#e8f0fe]">Audience & Rewards</h2>
          <button onClick={saveLinks} disabled={linkSaving}
            className="flex items-center gap-1.5 h-8 px-4 bg-[#162030] border border-[#1c2a3a] rounded-lg text-[#7a8fa8] hover:text-accent hover:border-accent/30 text-sm font-medium transition-colors disabled:opacity-60">
            {linkSaving ? <Loader2 size={13} className="animate-spin" strokeWidth={2} /> : <Save size={13} strokeWidth={2} />}
            Save links
          </button>
        </div>

        <div className="grid grid-cols-2 gap-5">
          {/* Audience segments */}
          <div>
            <p className="text-[12px] font-bold text-[#7a8fa8] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Users size={12} strokeWidth={2} /> Audience Segments
            </p>
            {segments.length === 0 ? (
              <p className="text-[12px] text-[#3d5068]">No segments defined yet.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {segments.map((seg) => (
                  <label key={seg.id} className="flex items-center gap-2.5 cursor-pointer group">
                    <div className={cn('w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0',
                      linkedSegments.has(seg.id) ? 'bg-accent border-accent' : 'border-[#1c2a3a] group-hover:border-[#3d5068]')}>
                      {linkedSegments.has(seg.id) && <CheckCircle2 size={10} strokeWidth={3} className="text-[#060a0e]" />}
                    </div>
                    <input type="checkbox" className="hidden" checked={linkedSegments.has(seg.id)} onChange={() => toggleSegment(seg.id)} />
                    <span className="text-[13px] text-[#e8f0fe]">{seg.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Rewards */}
          <div>
            <p className="text-[12px] font-bold text-[#7a8fa8] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Gift size={12} strokeWidth={2} /> Reward Configs
            </p>
            {rewards.length === 0 ? (
              <p className="text-[12px] text-[#3d5068]">No rewards defined yet.</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {rewards.map((rew) => (
                  <label key={rew.id} className="flex items-center gap-2.5 cursor-pointer group">
                    <div className={cn('w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0',
                      linkedRewards.has(rew.id) ? 'bg-accent border-accent' : 'border-[#1c2a3a] group-hover:border-[#3d5068]')}>
                      {linkedRewards.has(rew.id) && <CheckCircle2 size={10} strokeWidth={3} className="text-[#060a0e]" />}
                    </div>
                    <input type="checkbox" className="hidden" checked={linkedRewards.has(rew.id)} onChange={() => toggleReward(rew.id)} />
                    <span className="text-[13px] text-[#e8f0fe]">{rew.name}</span>
                    <span className="text-[11px] text-[#3d5068] capitalize">{rew.type}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
