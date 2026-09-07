'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Sparkles, Plus, Trash2, GripVertical,
  Loader2, Check, AlertCircle, ChevronDown, Send
} from 'lucide-react';
import { cn } from '@/lib/cn';
import type { DbStep, MissionStatus } from '@/lib/supabase/types';
import type { MissionArchitectInput } from '@/lib/agents/types';

type Mode = 'ai' | 'manual';

const STEP_TYPES: DbStep['type'][] = ['action', 'reflection', 'discovery'];
const STEP_TYPE_COLORS: Record<string, string> = {
  action: 'text-[#fb923c] bg-[#1a0f00] border-[#2a1800]',
  reflection: 'text-[#818cf8] bg-[#0f0f2a] border-[#1a1a3a]',
  discovery: 'text-[#2dd4bf] bg-[#001a1a] border-[#002a2a]',
};

const DIFFICULTY_OPTIONS = ['easy', 'medium', 'hard'] as const;

function newStep(): DbStep {
  return { id: Date.now(), type: 'action', instruction: '', success_criteria: '' };
}

export default function NewMissionPage() {
  const router = useRouter();

  // Mode
  const [mode, setMode] = useState<Mode>('ai');

  // AI generation — Mission Architect agent
  const [aiInputs, setAiInputs] = useState<MissionArchitectInput>({
    goal: '',
    audience: '',
    industry: '',
    duration: '',
    success_metric: '',
  });
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState('');

  // Mission fields
  const [title, setTitle] = useState('');
  const [storyContext, setStoryContext] = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [estimatedTime, setEstimatedTime] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [reward, setReward] = useState('');
  const [steps, setSteps] = useState<DbStep[]>([newStep()]);
  const [status, setStatus] = useState<MissionStatus>('draft');

  // Saving
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);

  // Form populated state (shows the form section after AI generation or in manual mode)
  const [formVisible, setFormVisible] = useState(mode === 'manual');

  const aiReady = aiInputs.goal.trim() && aiInputs.audience.trim() && aiInputs.industry.trim() && aiInputs.duration.trim() && aiInputs.success_metric.trim();

  async function handleAiGenerate() {
    if (!aiReady) return;
    setAiGenerating(true);
    setAiError('');

    try {
      const res = await fetch('/api/agents/mission-architect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(aiInputs),
      });
      if (!res.ok) throw new Error(`Agent error ${res.status}`);
      const data = await res.json();

      setTitle(data.title ?? '');
      setStoryContext(data.story_context ?? '');
      setDifficulty(data.difficulty ?? 'medium');
      setEstimatedTime(data.estimated_time ?? '');
      setTagsInput((data.tags ?? []).join(', '));
      setReward(data.reward ?? '');
      setSteps((data.steps ?? []).map((s: Omit<DbStep, 'id'>, i: number) => ({ ...s, id: Date.now() + i })));
      setFormVisible(true);
    } catch {
      setAiError('Mission Architect failed — check your API key or try manual mode.');
    } finally {
      setAiGenerating(false);
    }
  }

  async function handleSubmitForReview() {
    if (!title || steps.length === 0) return;
    setSaving(true);
    setSaveError('');

    try {
      const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);

      const createRes = await fetch('/api/admin/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          story_context: storyContext || null,
          difficulty,
          estimated_time: estimatedTime || null,
          steps,
          reward: reward || '',
          tags,
          status: 'draft',
          is_public: false,
        }),
      });
      const createData = await createRes.json();
      if (!createRes.ok) throw new Error(createData.error || 'Failed to create mission');

      const reviewRes = await fetch(`/api/admin/missions/${createData.mission.id}/review`, {
        method: 'POST',
      });
      if (!reviewRes.ok) {
        const reviewData = await reviewRes.json().catch(() => ({}));
        throw new Error(reviewData.error || 'Failed to submit for review');
      }

      setSaved(true);
      setTimeout(() => router.push('/admin/governance'), 1000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Submit failed');
      setSaving(false);
    }
  }

  function addStep() {
    setSteps((prev) => [...prev, newStep()]);
  }

  function removeStep(id: number) {
    setSteps((prev) => prev.filter((s) => s.id !== id));
  }

  function updateStep(id: number, field: keyof DbStep, value: string) {
    setSteps((prev) => prev.map((s) => s.id === id ? { ...s, [field]: value } : s));
  }

  async function handleSave() {
    if (!title || steps.length === 0) return;
    setSaving(true);
    setSaveError('');

    try {
      const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);

      const res = await fetch('/api/admin/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          story_context: storyContext || null,
          difficulty,
          estimated_time: estimatedTime || null,
          steps,
          reward: reward || '',
          tags,
          status,
          is_public: false,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');

      setSaved(true);
      setTimeout(() => router.push('/admin/missions'), 1000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
      setSaving(false);
    }
  }

  return (
    <div className="p-8 max-w-[860px]">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 bg-[#111927] border border-[#1c2a3a] rounded-xl flex items-center justify-center text-[#7a8fa8] hover:text-[#e8f0fe] transition-colors"
        >
          <ArrowLeft size={17} strokeWidth={2} />
        </button>
        <div>
          <h1 className="text-[24px] font-bold text-[#e8f0fe]">Create Mission</h1>
          <p className="text-[#7a8fa8] text-sm mt-0.5">Build a new experience for your audience</p>
        </div>
      </div>

      {/* Mode selector */}
      <div className="flex gap-2 mb-8">
        {(['ai', 'manual'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setFormVisible(m === 'manual'); }}
            className={cn(
              'flex items-center gap-2 px-4 h-10 rounded-xl text-sm font-semibold transition-all duration-150',
              mode === m
                ? m === 'ai' ? 'bg-ai text-[#060a0e] shadow-[0_4px_16px_rgba(109,93,253,0.3)]' : 'bg-accent text-[#060a0e] shadow-[0_4px_16px_rgba(0,230,118,0.3)]'
                : 'bg-[#111927] text-[#7a8fa8] border border-[#1c2a3a]'
            )}
          >
            {m === 'ai' && <Sparkles size={14} strokeWidth={2} />}
            {m === 'ai' ? 'AI Generate' : 'Manual'}
          </button>
        ))}
      </div>

      {/* AI generation panel — Mission Architect */}
      {mode === 'ai' && (
        <div className="bg-[#111927] border border-[#1c2a3a] rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={16} className="text-ai" strokeWidth={2} />
            <h2 className="text-[15px] font-bold text-[#e8f0fe]">Mission Architect</h2>
          </div>
          <p className="text-[12px] text-[#7a8fa8] mb-5">Define your outcome — the AI will design the full mission structure.</p>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-[11px] font-bold text-[#7a8fa8] uppercase tracking-wider mb-1.5 block">Goal *</label>
              <input
                value={aiInputs.goal}
                onChange={(e) => setAiInputs((p) => ({ ...p, goal: e.target.value }))}
                placeholder="e.g. Increase customer activation"
                className="w-full h-10 bg-[#0f1824] border border-[#1c2a3a] rounded-xl px-3 text-[#e8f0fe] placeholder-[#3d5068] text-[13px] focus:outline-none focus:border-ai transition-colors"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#7a8fa8] uppercase tracking-wider mb-1.5 block">Audience *</label>
              <input
                value={aiInputs.audience}
                onChange={(e) => setAiInputs((p) => ({ ...p, audience: e.target.value }))}
                placeholder="e.g. New users, Employees"
                className="w-full h-10 bg-[#0f1824] border border-[#1c2a3a] rounded-xl px-3 text-[#e8f0fe] placeholder-[#3d5068] text-[13px] focus:outline-none focus:border-ai transition-colors"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#7a8fa8] uppercase tracking-wider mb-1.5 block">Industry *</label>
              <input
                value={aiInputs.industry}
                onChange={(e) => setAiInputs((p) => ({ ...p, industry: e.target.value }))}
                placeholder="e.g. Fintech, Healthcare"
                className="w-full h-10 bg-[#0f1824] border border-[#1c2a3a] rounded-xl px-3 text-[#e8f0fe] placeholder-[#3d5068] text-[13px] focus:outline-none focus:border-ai transition-colors"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-[#7a8fa8] uppercase tracking-wider mb-1.5 block">Duration *</label>
              <input
                value={aiInputs.duration}
                onChange={(e) => setAiInputs((p) => ({ ...p, duration: e.target.value }))}
                placeholder="e.g. 7 Days, 1 hour"
                className="w-full h-10 bg-[#0f1824] border border-[#1c2a3a] rounded-xl px-3 text-[#e8f0fe] placeholder-[#3d5068] text-[13px] focus:outline-none focus:border-ai transition-colors"
              />
            </div>
            <div className="col-span-2">
              <label className="text-[11px] font-bold text-[#7a8fa8] uppercase tracking-wider mb-1.5 block">Success Metric *</label>
              <input
                value={aiInputs.success_metric}
                onChange={(e) => setAiInputs((p) => ({ ...p, success_metric: e.target.value }))}
                placeholder="e.g. First transaction completed, Profile 100% filled"
                className="w-full h-10 bg-[#0f1824] border border-[#1c2a3a] rounded-xl px-3 text-[#e8f0fe] placeholder-[#3d5068] text-[13px] focus:outline-none focus:border-ai transition-colors"
              />
            </div>
          </div>

          {aiError && (
            <div className="flex items-center gap-2 bg-[#2a0a0a] border border-[#ff5252]/30 rounded-xl px-4 py-2.5 mb-4">
              <AlertCircle size={14} className="text-[#ff5252]" strokeWidth={2} />
              <p className="text-[12px] text-[#ff5252]">{aiError}</p>
            </div>
          )}

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleAiGenerate}
            disabled={aiGenerating || !aiReady}
            className="flex items-center gap-2 h-10 px-5 bg-ai text-[#060a0e] rounded-xl font-semibold text-sm shadow-[0_4px_16px_rgba(109,93,253,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {aiGenerating ? (
              <><Loader2 size={15} strokeWidth={2} className="animate-spin" /> Architecting…</>
            ) : (
              <><Sparkles size={15} strokeWidth={2} /> Generate Mission</>
            )}
          </motion.button>
        </div>
      )}

      {/* Mission form */}
      <AnimatePresence>
        {formVisible && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-6"
          >
            {/* Basic fields */}
            <div className="bg-[#111927] border border-[#1c2a3a] rounded-2xl p-6">
              <h2 className="text-[15px] font-bold text-[#e8f0fe] mb-5">Mission Details</h2>

              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-[12px] font-semibold text-[#7a8fa8] uppercase tracking-wider mb-1.5 block">Title *</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Mission title"
                    className="w-full h-11 bg-[#0f1824] border border-[#1c2a3a] rounded-xl px-4 text-[#e8f0fe] placeholder-[#3d5068] text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-[#7a8fa8] uppercase tracking-wider mb-1.5 block">Story / Description</label>
                  <textarea
                    value={storyContext}
                    onChange={(e) => setStoryContext(e.target.value)}
                    placeholder="Set the scene for participants"
                    rows={3}
                    className="w-full bg-[#0f1824] border border-[#1c2a3a] rounded-xl px-4 py-3 text-[#e8f0fe] placeholder-[#3d5068] text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-colors resize-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-[12px] font-semibold text-[#7a8fa8] uppercase tracking-wider mb-1.5 block">Difficulty</label>
                    <div className="relative">
                      <select
                        value={difficulty}
                        onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
                        className="w-full h-11 bg-[#0f1824] border border-[#1c2a3a] rounded-xl px-4 text-[#e8f0fe] text-sm focus:outline-none focus:border-accent appearance-none"
                      >
                        {DIFFICULTY_OPTIONS.map((d) => (
                          <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#3d5068] pointer-events-none" strokeWidth={2} />
                    </div>
                  </div>
                  <div>
                    <label className="text-[12px] font-semibold text-[#7a8fa8] uppercase tracking-wider mb-1.5 block">Est. Time</label>
                    <input
                      value={estimatedTime}
                      onChange={(e) => setEstimatedTime(e.target.value)}
                      placeholder="e.g. 45 min"
                      className="w-full h-11 bg-[#0f1824] border border-[#1c2a3a] rounded-xl px-4 text-[#e8f0fe] placeholder-[#3d5068] text-sm focus:outline-none focus:border-accent transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[12px] font-semibold text-[#7a8fa8] uppercase tracking-wider mb-1.5 block">Status</label>
                    <div className="relative">
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as 'draft' | 'active')}
                        className="w-full h-11 bg-[#0f1824] border border-[#1c2a3a] rounded-xl px-4 text-[#e8f0fe] text-sm focus:outline-none focus:border-accent appearance-none"
                      >
                        <option value="active">Active</option>
                        <option value="draft">Draft</option>
                      </select>
                      <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#3d5068] pointer-events-none" strokeWidth={2} />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-[#7a8fa8] uppercase tracking-wider mb-1.5 block">Tags (comma-separated)</label>
                  <input
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="adventure, city, history"
                    className="w-full h-11 bg-[#0f1824] border border-[#1c2a3a] rounded-xl px-4 text-[#e8f0fe] placeholder-[#3d5068] text-sm focus:outline-none focus:border-accent transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[12px] font-semibold text-[#7a8fa8] uppercase tracking-wider mb-1.5 block">Reward</label>
                  <input
                    value={reward}
                    onChange={(e) => setReward(e.target.value)}
                    placeholder="e.g. Urban Explorer Badge + 150 XP"
                    className="w-full h-11 bg-[#0f1824] border border-[#1c2a3a] rounded-xl px-4 text-[#e8f0fe] placeholder-[#3d5068] text-sm focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Steps editor */}
            <div className="bg-[#111927] border border-[#1c2a3a] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[15px] font-bold text-[#e8f0fe]">Steps ({steps.length})</h2>
                <button
                  onClick={addStep}
                  className="flex items-center gap-1.5 h-8 px-3 bg-[#162030] border border-[#1c2a3a] rounded-lg text-[#7a8fa8] hover:text-accent hover:border-accent/30 text-sm font-medium transition-colors"
                >
                  <Plus size={14} strokeWidth={2.5} /> Add step
                </button>
              </div>

              <div className="flex flex-col gap-3">
                {steps.map((step, i) => (
                  <div key={step.id} className="bg-[#0f1824] border border-[#1c2a3a] rounded-xl p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <GripVertical size={14} className="text-[#3d5068] flex-shrink-0" strokeWidth={2} />
                      <span className="text-[12px] font-bold text-[#3d5068] w-5">#{i + 1}</span>

                      {/* Type selector */}
                      <div className="flex gap-1.5">
                        {STEP_TYPES.map((t) => (
                          <button
                            key={t}
                            onClick={() => updateStep(step.id, 'type', t)}
                            className={cn(
                              'px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all',
                              step.type === t
                                ? STEP_TYPE_COLORS[t]
                                : 'text-[#3d5068] bg-transparent border-[#1c2a3a]'
                            )}
                          >
                            {t}
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={() => removeStep(step.id)}
                        disabled={steps.length === 1}
                        className="ml-auto text-[#3d5068] hover:text-[#ff5252] transition-colors disabled:opacity-30"
                      >
                        <Trash2 size={14} strokeWidth={2} />
                      </button>
                    </div>

                    <div className="flex flex-col gap-2 pl-[34px]">
                      <textarea
                        value={step.instruction}
                        onChange={(e) => updateStep(step.id, 'instruction', e.target.value)}
                        placeholder="What should the participant do?"
                        rows={2}
                        className="w-full bg-[#111927] border border-[#1c2a3a] rounded-lg px-3 py-2.5 text-[#e8f0fe] placeholder-[#3d5068] text-[13px] focus:outline-none focus:border-accent transition-colors resize-none"
                      />
                      <input
                        value={step.success_criteria}
                        onChange={(e) => updateStep(step.id, 'success_criteria', e.target.value)}
                        placeholder="Done when… (success criteria)"
                        className="w-full h-9 bg-[#111927] border border-[#1c2a3a] rounded-lg px-3 text-[#e8f0fe] placeholder-[#3d5068] text-[12px] focus:outline-none focus:border-accent transition-colors"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Save */}
            {saveError && (
              <div className="flex items-center gap-2 bg-[#2a0a0a] border border-[#ff5252]/30 rounded-xl px-4 py-3">
                <AlertCircle size={15} className="text-[#ff5252]" strokeWidth={2} />
                <p className="text-[13px] text-[#ff5252]">{saveError}</p>
              </div>
            )}

            <div className="flex gap-3 pb-8">
              <button
                onClick={() => router.back()}
                className="h-12 px-5 bg-[#111927] border border-[#1c2a3a] rounded-xl font-semibold text-[#e8f0fe] text-sm hover:border-[#2a3f58] transition-colors"
              >
                Cancel
              </button>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleSave}
                disabled={saving || !title || steps.length === 0 || saved}
                className="flex-1 h-12 bg-[#111927] border border-[#1c2a3a] text-[#e8f0fe] rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:border-[#2a3f58] disabled:opacity-50 transition-colors"
              >
                {saving ? (
                  <Loader2 size={16} strokeWidth={2} className="animate-spin" />
                ) : saved ? (
                  <><Check size={16} strokeWidth={2.5} /> Saved</>
                ) : (
                  'Save as Draft'
                )}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleSubmitForReview}
                disabled={saving || !title || steps.length === 0 || saved}
                className="flex-[2] h-12 bg-accent text-[#060a0e] rounded-xl font-bold text-sm shadow-[0_4px_20px_rgba(0,230,118,0.4)] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {saved ? (
                  <><Check size={18} strokeWidth={2.5} /> Submitted!</>
                ) : saving ? (
                  <Loader2 size={18} strokeWidth={2} className="animate-spin" />
                ) : (
                  <><Send size={15} strokeWidth={2} /> Submit for Review</>
                )}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
