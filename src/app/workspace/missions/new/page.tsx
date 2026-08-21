'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Wand2, Plus, Trash2, ChevronLeft, Zap, Save, Target,
  Clock, Tag, CheckCircle2, AlertCircle, Layers, ArrowUp, ArrowDown,
  Users, Settings2, Eye, Globe, Lock, Calendar, Loader2, ArrowRight,
  MapPin, Navigation,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/cn';
import { geocodeCity } from '@/lib/proximity';

interface Step {
  id: number;
  type: 'action' | 'reflection' | 'discovery';
  instruction: string;
  success_criteria: string;
  aiGenerating?: boolean;
}

interface Segment { id: string; name: string; member_count?: number; }

type StepType = 'action' | 'reflection' | 'discovery';
type Tab = 'overview' | 'steps' | 'audience' | 'settings' | 'preview';

const STEP_TYPES: { value: StepType; label: string; color: string; activeBg: string; activeBorder: string }[] = [
  { value: 'action',     label: 'Action',     color: 'text-[#22FFAA]', activeBg: 'bg-[#22FFAA]/10', activeBorder: 'border-[#22FFAA]/30' },
  { value: 'reflection', label: 'Reflection', color: 'text-[#6D5DFD]', activeBg: 'bg-[#6D5DFD]/10', activeBorder: 'border-[#6D5DFD]/30' },
  { value: 'discovery',  label: 'Discovery',  color: 'text-[#FFB84D]', activeBg: 'bg-[#FFB84D]/10', activeBorder: 'border-[#FFB84D]/30' },
];

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview',  label: 'Overview',  icon: Target },
  { id: 'steps',     label: 'Steps',     icon: Layers },
  { id: 'audience',  label: 'Audience',  icon: Users },
  { id: 'settings',  label: 'Settings',  icon: Settings2 },
  { id: 'preview',   label: 'Preview',   icon: Eye },
];

export default function NewMissionPage() {
  const router = useRouter();

  const [title, setTitle]           = useState('');
  const [story, setStory]           = useState('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [estimatedTime, setEst]     = useState('30 min');
  const [reward, setReward]         = useState('');
  const [tags, setTags]             = useState<string[]>([]);
  const [tagInput, setTagInput]     = useState('');

  const [steps, setSteps] = useState<Step[]>([
    { id: 1, type: 'action', instruction: '', success_criteria: '' },
  ]);

  const [segments, setSegments]    = useState<Segment[]>([]);
  const [selectedSegs, setSelSegs] = useState<string[]>([]);
  const [segLoading, setSegLoading]= useState(false);

  const [isPublic, setIsPublic] = useState(false);
  const [deadline, setDeadline] = useState('');
  const [maxParts, setMaxParts] = useState('');

  // Location / proximity
  const [locationType, setLocationType]     = useState<'remote' | 'local' | 'hybrid'>('remote');
  const [locationCity, setLocationCity]     = useState('');
  const [locationLat, setLocationLat]       = useState<number | null>(null);
  const [locationLng, setLocationLng]       = useState<number | null>(null);
  const [locationRadius, setLocationRadius] = useState(50);
  const [geoLoading, setGeoLoading]         = useState(false);
  const [geoError, setGeoError]             = useState('');

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [saving, setSaving]       = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError]         = useState('');
  const [saved, setSaved]         = useState(false);

  useEffect(() => {
    async function loadSegments() {
      setSegLoading(true);
      try {
        const res = await fetch('/api/workspace/segments');
        const data = await res.json();
        setSegments(res.ok ? (data.segments ?? []) : []);
      } finally {
        setSegLoading(false);
      }
    }
    loadSegments();
  }, []);

  function addStep() {
    setSteps((prev) => [...prev, { id: Date.now(), type: 'action', instruction: '', success_criteria: '' }]);
  }

  function removeStep(sid: number) {
    if (steps.length === 1) return;
    setSteps((prev) => prev.filter((s) => s.id !== sid));
  }

  function moveStep(sid: number, dir: 'up' | 'down') {
    setSteps((prev) => {
      const idx = prev.findIndex((s) => s.id === sid);
      if (dir === 'up' && idx === 0) return prev;
      if (dir === 'down' && idx === prev.length - 1) return prev;
      const next = [...prev];
      const swap = dir === 'up' ? idx - 1 : idx + 1;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }

  function updateStep(sid: number, field: keyof Step, value: string) {
    setSteps((prev) => prev.map((s) => s.id === sid ? { ...s, [field]: value } : s));
  }

  async function generateStepWithAI(step: Step) {
    if (!title.trim()) { setError('Add a mission title first.'); return; }
    setSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, aiGenerating: true } : s));
    try {
      const res = await fetch('/api/agents/mission-architect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: `For mission "${title}" (${difficulty}), write a ${step.type} step instruction (1-2 sentences, actionable and specific). Then on a new line write a short measurable success criteria.`,
        }),
      });
      const json = await res.json();
      const text: string = json.content ?? json.message ?? '';
      if (text) {
        const lines = text.split('\n').filter((l: string) => l.trim());
        updateStep(step.id, 'instruction', lines[0]?.slice(0, 200) ?? text.slice(0, 200));
        if (lines[1]) updateStep(step.id, 'success_criteria', lines[1].slice(0, 120));
      }
    } catch { /* silent */ } finally {
      setSteps((prev) => prev.map((s) => s.id === step.id ? { ...s, aiGenerating: false } : s));
    }
  }

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput('');
  }

  function toggleSegment(sid: string) {
    setSelSegs((prev) => prev.includes(sid) ? prev.filter((x) => x !== sid) : [...prev, sid]);
  }

  async function resolveLocationCoords() {
    if (!locationCity.trim()) return;
    setGeoLoading(true);
    setGeoError('');
    try {
      const result = await geocodeCity(locationCity.trim());
      if (result) {
        setLocationLat(result.lat);
        setLocationLng(result.lng);
        if (!locationCity.trim()) setLocationCity(result.city);
      } else {
        setGeoError('City not found — try a more specific name.');
      }
    } catch {
      setGeoError('Geocoding failed. Coords will be saved when available.');
    } finally {
      setGeoLoading(false);
    }
  }

  function detectMyLocation() {
    if (!navigator.geolocation) { setGeoError('Geolocation not supported.'); return; }
    setGeoLoading(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setLocationLat(pos.coords.latitude);
        setLocationLng(pos.coords.longitude);
        try {
          const { reverseGeocode } = await import('@/lib/proximity');
          const place = await reverseGeocode({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocationCity(place.city + (place.country ? `, ${place.country}` : ''));
        } catch { /* city will remain empty */ }
        setGeoLoading(false);
      },
      () => { setGeoError('Could not access your location.'); setGeoLoading(false); },
      { timeout: 8000 }
    );
  }

  async function generateWithAI() {
    if (!title.trim()) { setError('Enter a mission title first.'); return; }
    setError('');
    setAiLoading(true);
    try {
      const res = await fetch('/api/agents/mission-architect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: `Create a mission for: "${title}". Difficulty: ${difficulty}. Provide story context (2-3 sentences).` }),
      });
      const json = await res.json();
      const text: string = json.content ?? json.message ?? '';
      if (text) {
        setStory(text.slice(0, 400));
        setSteps([
          { id: 1, type: 'action',     instruction: `Research and outline the core challenge for: ${title}`,          success_criteria: 'Clear written outline submitted' },
          { id: 2, type: 'discovery',  instruction: `Identify 3 key stakeholders or resources relevant to: ${title}`, success_criteria: 'Stakeholder list with names and roles' },
          { id: 3, type: 'reflection', instruction: `Reflect on barriers and opportunities for: ${title}`,            success_criteria: 'Reflection document with action items' },
          { id: 4, type: 'action',     instruction: `Present your solution or outcome for: ${title}`,                 success_criteria: 'Presentation or artifact shared' },
        ]);
        setTags((prev) => [...new Set([...prev, 'ai-generated', difficulty])]);
        setEst('45 min');
        setActiveTab('steps');
      }
    } catch { /* silent */ } finally {
      setAiLoading(false);
    }
  }

  async function handleSave(status: 'draft' | 'active') {
    if (!title.trim()) { setError('Mission title is required.'); setActiveTab('overview'); return; }
    if (steps.some((s) => !s.instruction.trim())) { setError('All steps must have instructions.'); setActiveTab('steps'); return; }
    setError('');
    setSaving(true);

    const cleanSteps = steps.map(({ aiGenerating: _ai, ...s }) => s);
    const segTags = selectedSegs.map((sid) => `seg:${sid}`);

    const res = await fetch('/api/missions/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title:          title.trim(),
        story:          story.trim(),
        difficulty,
        estimatedTime,
        steps:          cleanSteps,
        reward:         reward.trim(),
        tags:           [...tags, ...segTags],
        status,
        isPublic,
        locationType,
        locationCity,
        locationLat,
        locationLng,
        locationRadius,
      }),
    });
    const data = await res.json();

    if (!res.ok) { setError(data.error ?? 'Failed to save mission.'); setSaving(false); return; }
    setSaved(true);
    setTimeout(() => router.push(`/workspace/missions/${data.id}`), 700);
  }

  const completeness = Math.round(
    ([!!title, !!story, steps.every((s) => !!s.instruction), steps.every((s) => !!s.success_criteria)].filter(Boolean).length / 4) * 100,
  );

  return (
    <div className="flex flex-col min-h-full">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-[#050816]/90 backdrop-blur-xl border-b border-[#0F1D35] px-8 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/workspace/missions" className="p-2 rounded-xl hover:bg-[#0A1226] text-[#4A5578] hover:text-[#8B9CC0] transition-colors">
              <ChevronLeft size={18} strokeWidth={2} />
            </Link>
            <div>
              <h1 className="text-[18px] font-bold text-[#F0F4FF] leading-none truncate max-w-[280px]">
                {title || 'Untitled Mission'}
              </h1>
              <p className="text-[11px] text-[#4A5578] mt-0.5">Mission Studio · New</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 mr-1">
              <div className="w-16 h-1 bg-[#0A1226] rounded-full overflow-hidden">
                <div className="h-full bg-accent/60 rounded-full transition-all duration-500" style={{ width: `${completeness}%` }} />
              </div>
              <span className="text-[10px] text-[#4A5578] font-medium tabular-nums">{completeness}%</span>
            </div>
            <button
              onClick={generateWithAI}
              disabled={aiLoading}
              className="flex items-center gap-2 h-9 px-4 bg-[#6D5DFD]/15 border border-[#6D5DFD]/30 text-[#A99FFE] rounded-xl font-semibold text-[13px] hover:bg-[#6D5DFD]/25 transition-colors disabled:opacity-50"
            >
              <Wand2 size={14} strokeWidth={2} className={aiLoading ? 'animate-spin' : ''} />
              {aiLoading ? 'Generating…' : 'AI Fill'}
            </button>
            <button
              onClick={() => handleSave('draft')}
              disabled={saving}
              className="flex items-center gap-2 h-9 px-4 bg-[#0A1226] border border-[#162440] text-[#F0F4FF] rounded-xl font-medium text-[13px] hover:border-[#6D5DFD]/40 transition-colors disabled:opacity-50"
            >
              <Save size={13} strokeWidth={2} />
              Draft
            </button>
            <button
              onClick={() => handleSave('active')}
              disabled={saving}
              className="flex items-center gap-2 h-9 px-4 bg-accent text-[#060a0e] rounded-xl font-semibold text-[13px] shadow-[0_4px_16px_rgba(34,255,170,0.25)] disabled:opacity-50"
            >
              {saved ? <CheckCircle2 size={14} strokeWidth={2.5} /> : <Zap size={14} strokeWidth={2.5} />}
              {saving ? 'Publishing…' : saved ? 'Published!' : 'Publish'}
            </button>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-[#0F1D35] px-8 bg-[#050816]">
        <div className="max-w-4xl mx-auto flex items-center gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-2 h-11 px-4 text-[13px] font-semibold border-b-2 transition-all',
                activeTab === id ? 'border-accent text-accent' : 'border-transparent text-[#4A5578] hover:text-[#8B9CC0]',
              )}
            >
              <Icon size={13} strokeWidth={2} />
              {label}
              {id === 'steps' && (
                <span className="text-[10px] font-bold bg-[#0D1530] text-[#4A5578] px-1.5 py-0.5 rounded-full">{steps.length}</span>
              )}
              {id === 'audience' && selectedSegs.length > 0 && (
                <span className="text-[10px] font-bold bg-accent/15 text-accent px-1.5 py-0.5 rounded-full">{selectedSegs.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">

          {error && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 px-4 py-3 bg-[#FF5C7A]/10 border border-[#FF5C7A]/20 rounded-xl mb-6">
              <AlertCircle size={14} className="text-[#FF5C7A] flex-shrink-0" strokeWidth={2} />
              <p className="text-[13px] text-[#FF5C7A] flex-1">{error}</p>
              <button onClick={() => setError('')} className="text-[#FF5C7A]/60 hover:text-[#FF5C7A] text-[12px]">✕</button>
            </motion.div>
          )}

          {/* ── OVERVIEW TAB ── */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <div className="bg-[#0A1226] border border-[#0F1D35] rounded-2xl p-6 space-y-5">
                <div className="flex items-center gap-2">
                  <Target size={14} className="text-accent" strokeWidth={2} />
                  <p className="text-[13px] font-bold text-[#F0F4FF]">Mission Identity</p>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#4A5578] uppercase tracking-wider mb-2 block">Title *</label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Launch Product Hunt Campaign"
                    className="w-full h-11 px-4 bg-[#07101F] border border-[#0F1D35] rounded-xl text-[15px] font-semibold text-[#F0F4FF] placeholder:text-[#4A5578] placeholder:font-normal focus:outline-none focus:border-[#162440] transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#4A5578] uppercase tracking-wider mb-2 block">Story Context</label>
                  <textarea
                    value={story}
                    onChange={(e) => setStory(e.target.value)}
                    placeholder="Describe the mission background, context, and why it matters…"
                    rows={4}
                    className="w-full px-4 py-3 bg-[#07101F] border border-[#0F1D35] rounded-xl text-[13px] text-[#F0F4FF] placeholder:text-[#4A5578] focus:outline-none focus:border-[#162440] resize-none transition-colors"
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-[11px] font-bold text-[#4A5578] uppercase tracking-wider mb-2 block">Difficulty</label>
                    <div className="flex gap-1.5">
                      {(['easy', 'medium', 'hard'] as const).map((d) => (
                        <button key={d} onClick={() => setDifficulty(d)}
                          className={cn('flex-1 h-9 rounded-xl text-[11px] font-bold border transition-all capitalize',
                            difficulty === d
                              ? d === 'easy'   ? 'bg-[#22FFAA]/10 border-[#22FFAA]/30 text-[#22FFAA]'
                                : d === 'medium' ? 'bg-[#FFB84D]/10 border-[#FFB84D]/30 text-[#FFB84D]'
                                : 'bg-[#FF5C7A]/10 border-[#FF5C7A]/30 text-[#FF5C7A]'
                              : 'bg-[#07101F] border-[#0F1D35] text-[#4A5578] hover:text-[#8B9CC0]'
                          )}>{d}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#4A5578] uppercase tracking-wider mb-2 block">Est. Time</label>
                    <div className="relative">
                      <Clock size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A5578]" strokeWidth={2} />
                      <input value={estimatedTime} onChange={(e) => setEst(e.target.value)} placeholder="30 min"
                        className="w-full h-9 pl-8 pr-3 bg-[#07101F] border border-[#0F1D35] rounded-xl text-[13px] text-[#F0F4FF] placeholder:text-[#4A5578] focus:outline-none focus:border-[#162440]" />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-[#4A5578] uppercase tracking-wider mb-2 block">Reward</label>
                    <input value={reward} onChange={(e) => setReward(e.target.value)} placeholder="Completion badge"
                      className="w-full h-9 px-3 bg-[#07101F] border border-[#0F1D35] rounded-xl text-[13px] text-[#F0F4FF] placeholder:text-[#4A5578] focus:outline-none focus:border-[#162440]" />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#4A5578] uppercase tracking-wider mb-2 block">Tags</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {tags.map((t) => (
                      <span key={t} className="flex items-center gap-1.5 px-2.5 py-1 bg-[#6D5DFD]/10 border border-[#6D5DFD]/20 text-[#A99FFE] text-[11px] font-semibold rounded-full">
                        {t}
                        <button onClick={() => setTags(tags.filter((x) => x !== t))} className="text-[#6D5DFD] hover:text-[#FF5C7A] leading-none">✕</button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A5578]" strokeWidth={2} />
                      <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                        placeholder="Add tag and press Enter"
                        className="w-full h-9 pl-8 pr-3 bg-[#07101F] border border-[#0F1D35] rounded-xl text-[12px] text-[#F0F4FF] placeholder:text-[#4A5578] focus:outline-none focus:border-[#162440]" />
                    </div>
                    <button onClick={addTag} className="h-9 px-3 bg-[#07101F] border border-[#0F1D35] rounded-xl text-[12px] font-semibold text-[#8B9CC0] hover:text-[#F0F4FF] hover:border-[#162440] transition-colors">
                      Add
                    </button>
                  </div>
                </div>
              </div>

              <button onClick={() => setActiveTab('steps')}
                className="w-full flex items-center justify-center gap-2 h-11 bg-[#0A1226] border border-[#0F1D35] rounded-xl text-[13px] font-semibold text-[#4A5578] hover:text-[#8B9CC0] hover:border-[#162440] transition-colors">
                Next: Configure Steps <ArrowRight size={13} strokeWidth={2.5} />
              </button>
            </div>
          )}

          {/* ── STEPS TAB ── */}
          {activeTab === 'steps' && (
            <div className="bg-[#0A1226] border border-[#0F1D35] rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-[#0F1D35]">
                <div className="flex items-center gap-2">
                  <Layers size={14} className="text-[#6D5DFD]" strokeWidth={2} />
                  <p className="text-[13px] font-bold text-[#F0F4FF]">Mission Steps</p>
                  <span className="text-[11px] font-bold text-[#4A5578] bg-[#0D1530] px-2 py-0.5 rounded-full">{steps.length}</span>
                </div>
                <button onClick={addStep}
                  className="flex items-center gap-1.5 h-8 px-3 bg-accent/10 border border-accent/20 text-accent rounded-xl text-[12px] font-semibold hover:bg-accent/15 transition-colors">
                  <Plus size={12} strokeWidth={2.5} /> Add Step
                </button>
              </div>

              <div className="p-4 space-y-3">
                <AnimatePresence>
                  {steps.map((step, idx) => (
                    <motion.div key={step.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                      className="bg-[#07101F] border border-[#0F1D35] rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-[#0D1530] border border-[#162440] flex items-center justify-center text-[10px] font-bold text-[#4A5578] flex-shrink-0">
                            {idx + 1}
                          </span>
                          <div className="flex items-center gap-1">
                            {STEP_TYPES.map(({ value, label, color, activeBg, activeBorder }) => (
                              <button key={value} onClick={() => updateStep(step.id, 'type', value)}
                                className={cn('h-6 px-2 rounded-lg text-[10px] font-bold border transition-all',
                                  step.type === value ? `${color} ${activeBg} ${activeBorder}` : 'text-[#4A5578] border-transparent hover:text-[#8B9CC0]'
                                )}>{label}</button>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => generateStepWithAI(step)} disabled={!!step.aiGenerating} title="Generate with AI"
                            className="p-1.5 rounded-lg text-[#6D5DFD] hover:bg-[#6D5DFD]/10 transition-colors disabled:opacity-50">
                            {step.aiGenerating ? <Loader2 size={12} strokeWidth={2} className="animate-spin" /> : <Sparkles size={12} strokeWidth={2} />}
                          </button>
                          <button onClick={() => moveStep(step.id, 'up')} disabled={idx === 0}
                            className="p-1.5 rounded-lg text-[#4A5578] hover:text-[#8B9CC0] transition-colors disabled:opacity-20">
                            <ArrowUp size={12} strokeWidth={2} />
                          </button>
                          <button onClick={() => moveStep(step.id, 'down')} disabled={idx === steps.length - 1}
                            className="p-1.5 rounded-lg text-[#4A5578] hover:text-[#8B9CC0] transition-colors disabled:opacity-20">
                            <ArrowDown size={12} strokeWidth={2} />
                          </button>
                          <button onClick={() => removeStep(step.id)} disabled={steps.length === 1}
                            className="p-1.5 rounded-lg text-[#4A5578] hover:text-[#FF5C7A] hover:bg-[#FF5C7A]/10 transition-colors disabled:opacity-30">
                            <Trash2 size={12} strokeWidth={2} />
                          </button>
                        </div>
                      </div>
                      <input value={step.instruction} onChange={(e) => updateStep(step.id, 'instruction', e.target.value)}
                        placeholder="What should the participant do?"
                        className="w-full h-9 px-3 bg-[#0A1226] border border-[#0F1D35] rounded-lg text-[13px] text-[#F0F4FF] placeholder:text-[#4A5578] focus:outline-none focus:border-[#162440]" />
                      <input value={step.success_criteria} onChange={(e) => updateStep(step.id, 'success_criteria', e.target.value)}
                        placeholder="How will success be measured? (optional)"
                        className="w-full h-9 px-3 bg-[#0A1226] border border-[#0F1D35] rounded-lg text-[12px] text-[#8B9CC0] placeholder:text-[#4A5578] focus:outline-none focus:border-[#162440]" />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* ── AUDIENCE TAB ── */}
          {activeTab === 'audience' && (
            <div className="bg-[#0A1226] border border-[#0F1D35] rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-1">
                <Users size={14} className="text-[#6D5DFD]" strokeWidth={2} />
                <p className="text-[13px] font-bold text-[#F0F4FF]">Audience Segments</p>
              </div>
              <p className="text-[12px] text-[#4A5578] mb-5">Choose which segments can participate. Leave empty to allow all users.</p>

              {segLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-[#0D1530] animate-pulse rounded-xl" />)}
                </div>
              ) : segments.length === 0 ? (
                <div className="flex flex-col items-center py-10 gap-3">
                  <Users size={28} className="text-[#4A5578]" strokeWidth={1.5} />
                  <p className="text-[13px] text-[#4A5578]">No audience segments found</p>
                  <Link href="/workspace/audience" className="text-[12px] text-accent font-semibold hover:underline">
                    Create segments in Audience Center →
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {segments.map((seg) => (
                    <button key={seg.id} onClick={() => toggleSegment(seg.id)}
                      className={cn('w-full flex items-center gap-3 p-4 rounded-xl border transition-all text-left',
                        selectedSegs.includes(seg.id)
                          ? 'bg-[#22FFAA]/5 border-[#22FFAA]/20'
                          : 'bg-[#07101F] border-[#0F1D35] hover:border-[#162440]'
                      )}>
                      <div className={cn('w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all',
                        selectedSegs.includes(seg.id) ? 'bg-accent border-accent' : 'border-[#4A5578]')}>
                        {selectedSegs.includes(seg.id) && <CheckCircle2 size={10} className="text-[#050816]" strokeWidth={3} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-[13px] font-semibold', selectedSegs.includes(seg.id) ? 'text-[#F0F4FF]' : 'text-[#8B9CC0]')}>
                          {seg.name}
                        </p>
                      </div>
                      {seg.member_count != null && (
                        <span className="text-[11px] text-[#4A5578] flex-shrink-0 tabular-nums">{seg.member_count} members</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {selectedSegs.length > 0 && (
                <p className="text-[12px] text-accent mt-4 font-medium">
                  {selectedSegs.length} segment{selectedSegs.length !== 1 ? 's' : ''} selected
                </p>
              )}
            </div>
          )}

          {/* ── SETTINGS TAB ── */}
          {activeTab === 'settings' && (
            <div className="bg-[#0A1226] border border-[#0F1D35] rounded-2xl p-6 space-y-6">
              <div className="flex items-center gap-2">
                <Settings2 size={14} className="text-[#FFB84D]" strokeWidth={2} />
                <p className="text-[13px] font-bold text-[#F0F4FF]">Mission Settings</p>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#4A5578] uppercase tracking-wider mb-3 block">Visibility</label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { val: false, icon: Lock,  label: 'Private', desc: 'Only invited users can see and participate' },
                    { val: true,  icon: Globe, label: 'Public',  desc: 'Anyone in your org can discover and join' },
                  ].map(({ val, icon: Icon, label, desc }) => (
                    <button key={String(val)} onClick={() => setIsPublic(val)}
                      className={cn('flex items-start gap-3 p-4 rounded-xl border text-left transition-all',
                        isPublic === val ? 'bg-[#22FFAA]/5 border-[#22FFAA]/25' : 'bg-[#07101F] border-[#0F1D35] hover:border-[#162440]'
                      )}>
                      <Icon size={15} className={isPublic === val ? 'text-accent mt-0.5' : 'text-[#4A5578] mt-0.5'} strokeWidth={2} />
                      <div>
                        <p className={cn('text-[13px] font-semibold', isPublic === val ? 'text-accent' : 'text-[#8B9CC0]')}>{label}</p>
                        <p className="text-[11px] text-[#4A5578] mt-0.5 leading-relaxed">{desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#4A5578] uppercase tracking-wider mb-2 block">Mission Deadline (optional)</label>
                <div className="relative">
                  <Calendar size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4A5578]" strokeWidth={2} />
                  <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
                    className="w-full h-10 pl-9 pr-4 bg-[#07101F] border border-[#0F1D35] rounded-xl text-[13px] text-[#F0F4FF] focus:outline-none focus:border-[#162440] [color-scheme:dark]" />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[#4A5578] uppercase tracking-wider mb-2 block">Max Participants (optional)</label>
                <input type="number" value={maxParts} onChange={(e) => setMaxParts(e.target.value)} placeholder="Unlimited" min={1}
                  className="w-full h-10 px-4 bg-[#07101F] border border-[#0F1D35] rounded-xl text-[13px] text-[#F0F4FF] placeholder:text-[#4A5578] focus:outline-none focus:border-[#162440]" />
              </div>

              {/* Location / Proximity */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <MapPin size={13} className="text-[#22FFAA]" strokeWidth={2} />
                  <label className="text-[11px] font-bold text-[#4A5578] uppercase tracking-wider">Location Type</label>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {([
                    { val: 'remote', label: '🌐 Remote',  desc: 'Fully online'        },
                    { val: 'local',  label: '📍 Local',   desc: 'On-site required'    },
                    { val: 'hybrid', label: '🔀 Hybrid',  desc: 'Mix of both'         },
                  ] as const).map(({ val, label, desc }) => (
                    <button key={val} onClick={() => setLocationType(val)}
                      className={cn('flex flex-col items-center p-3 rounded-xl border text-center transition-all',
                        locationType === val ? 'bg-[#22FFAA]/5 border-[#22FFAA]/25' : 'bg-[#07101F] border-[#0F1D35] hover:border-[#162440]'
                      )}>
                      <span className="text-[14px] mb-1">{label.split(' ')[0]}</span>
                      <span className={cn('text-[11px] font-semibold', locationType === val ? 'text-[#22FFAA]' : 'text-[#8B9CC0]')}>{label.split(' ')[1]}</span>
                      <span className="text-[10px] text-[#4A5578] mt-0.5">{desc}</span>
                    </button>
                  ))}
                </div>

                {locationType !== 'remote' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                    className="space-y-3">
                    <div>
                      <label className="text-[11px] font-bold text-[#4A5578] uppercase tracking-wider mb-2 block">City / Location</label>
                      <div className="flex gap-2">
                        <input
                          value={locationCity}
                          onChange={(e) => setLocationCity(e.target.value)}
                          onBlur={resolveLocationCoords}
                          placeholder="e.g. Lagos, Nigeria"
                          className="flex-1 h-10 px-4 bg-[#07101F] border border-[#0F1D35] rounded-xl text-[13px] text-[#F0F4FF] placeholder:text-[#4A5578] focus:outline-none focus:border-[#162440]"
                        />
                        <button onClick={detectMyLocation} disabled={geoLoading}
                          className="flex items-center gap-1.5 h-10 px-4 bg-[#22FFAA]/10 border border-[#22FFAA]/25 text-[#22FFAA] rounded-xl text-[12px] font-semibold transition-colors hover:bg-[#22FFAA]/18 disabled:opacity-50 whitespace-nowrap">
                          {geoLoading
                            ? <Loader2 size={12} strokeWidth={2} className="animate-spin" />
                            : <Navigation size={12} strokeWidth={2} />
                          }
                          My Location
                        </button>
                      </div>
                      {geoError && <p className="text-[11px] text-[#FF5C7A] mt-1.5">{geoError}</p>}
                      {locationLat != null && (
                        <p className="text-[11px] text-[#22FFAA] mt-1.5 flex items-center gap-1">
                          <MapPin size={10} strokeWidth={2} />
                          Pinned: {locationLat.toFixed(4)}, {locationLng?.toFixed(4)}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-[#4A5578] uppercase tracking-wider mb-2 block">
                        Participation Radius — {locationRadius} km
                      </label>
                      <input type="range" min={1} max={200} value={locationRadius}
                        onChange={(e) => setLocationRadius(Number(e.target.value))}
                        className="w-full accent-[#22FFAA]" />
                      <div className="flex justify-between text-[10px] text-[#4A5578] mt-1">
                        <span>1 km</span><span>Walking distance ({locationRadius <= 5 ? '✓' : ''})</span><span>200 km</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          )}

          {/* ── PREVIEW TAB ── */}
          {activeTab === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Eye size={13} className="text-[#8B9CC0]" strokeWidth={2} />
                <p className="text-[12px] text-[#4A5578] font-medium">Participant view — how this mission appears to users</p>
              </div>

              <div className="bg-[#0A1226] border border-[#0F1D35] rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-[#0F1D35]">
                  <h2 className="text-[20px] font-bold text-[#F0F4FF] mb-3">
                    {title || <span className="text-[#4A5578]">Untitled Mission</span>}
                  </h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('text-[11px] font-bold px-2 py-1 rounded-full capitalize',
                      difficulty === 'easy' ? 'bg-[#22FFAA]/10 text-[#22FFAA]'
                      : difficulty === 'medium' ? 'bg-[#FFB84D]/10 text-[#FFB84D]'
                      : 'bg-[#FF5C7A]/10 text-[#FF5C7A]'
                    )}>{difficulty}</span>
                    {estimatedTime && (
                      <span className="flex items-center gap-1 text-[11px] text-[#8B9CC0]">
                        <Clock size={10} strokeWidth={2} />{estimatedTime}
                      </span>
                    )}
                    {tags.map((t) => (
                      <span key={t} className="text-[10px] font-semibold px-2 py-0.5 bg-[#0D1530] text-[#8B9CC0] rounded-full">{t}</span>
                    ))}
                  </div>
                  {story && <p className="text-[13px] text-[#8B9CC0] leading-relaxed mt-3">{story}</p>}
                </div>

                <div className="p-6">
                  <p className="text-[11px] font-bold text-[#4A5578] uppercase tracking-wider mb-4">{steps.length} Steps</p>
                  <div className="space-y-3">
                    {steps.map((step, i) => (
                      <div key={step.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0',
                            step.type === 'action' ? 'bg-[#22FFAA]/10 text-[#22FFAA]'
                            : step.type === 'reflection' ? 'bg-[#6D5DFD]/10 text-[#6D5DFD]'
                            : 'bg-[#FFB84D]/10 text-[#FFB84D]'
                          )}>{i + 1}</div>
                          {i < steps.length - 1 && <div className="w-px flex-1 mt-1.5 bg-[#0F1D35] min-h-[20px]" />}
                        </div>
                        <div className="flex-1 pb-3">
                          <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-md capitalize inline-block mb-1.5',
                            step.type === 'action' ? 'text-[#22FFAA] bg-[#22FFAA]/10'
                            : step.type === 'reflection' ? 'text-[#6D5DFD] bg-[#6D5DFD]/10'
                            : 'text-[#FFB84D] bg-[#FFB84D]/10'
                          )}>{step.type}</span>
                          <p className="text-[13px] text-[#F0F4FF] font-medium leading-snug">
                            {step.instruction || <span className="text-[#4A5578] italic">No instruction yet</span>}
                          </p>
                          {step.success_criteria && (
                            <p className="text-[11px] text-[#4A5578] mt-1 flex items-start gap-1.5">
                              <CheckCircle2 size={10} className="text-[#22FFAA]/60 mt-0.5 flex-shrink-0" strokeWidth={2} />
                              {step.success_criteria}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="px-6 py-4 bg-[#07101F] border-t border-[#0F1D35] flex items-center justify-between">
                  <p className="text-[12px] text-[#4A5578]">Complete all {steps.length} steps to earn:</p>
                  <span className="text-[13px] font-bold text-[#FFB84D]">{reward || 'Mission completion badge'}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setActiveTab('overview')}
                  className="flex-1 h-10 bg-[#0A1226] border border-[#0F1D35] rounded-xl text-[13px] font-medium text-[#8B9CC0] hover:border-[#162440] transition-colors">
                  Edit Overview
                </button>
                <button onClick={() => handleSave('active')} disabled={saving}
                  className="flex-1 h-10 bg-accent text-[#060a0e] rounded-xl text-[13px] font-bold shadow-[0_4px_16px_rgba(34,255,170,0.25)] disabled:opacity-50">
                  {saving ? 'Publishing…' : 'Publish Mission'}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
