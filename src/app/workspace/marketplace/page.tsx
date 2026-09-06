'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, Plus, Pencil, Eye, Users, TrendingUp, CheckCircle2,
  XCircle, Clock, ArrowRight, ChevronDown, Trash2, ExternalLink,
  ToggleLeft, ToggleRight, Star, AlertCircle, Search, X,
  Building2, Tag, DollarSign, Sparkles, Filter, RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { IMPACT_CATEGORIES, SDG_META } from '@/lib/missionCategories';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Mission {
  id:         string;
  title:      string;
  difficulty: string;
  tags:       string[];
  reward:     string;
  status:     string;
}

interface Listing {
  id:              string;
  mission_id:      string;
  tagline:         string;
  highlight:       string | null;
  listing_type:    'free' | 'paid' | 'sponsored';
  price_cents:     number;
  category:        string | null;
  sdg_goals:       number[];
  required_skills: string[];
  status:          'draft' | 'active' | 'paused' | 'archived';
  is_featured:     boolean;
  view_count:      number;
  apply_count:     number;
  published_at:    string | null;
  updated_at:      string;
  mission:         Mission;
}

interface Application {
  id:         string;
  listing_id: string;
  user_id:    string;
  status:     'pending' | 'accepted' | 'rejected' | 'withdrawn';
  cover_note: string | null;
  created_at: string;
  user_profile: {
    display_name: string | null;
    email:        string;
    avatar_url:   string | null;
  } | null;
}

type Tab = 'listings' | 'applications';

// ── Form defaults ─────────────────────────────────────────────────────────────

const BLANK_FORM = {
  tagline:         '',
  highlight:       '',
  listing_type:    'free' as const,
  price_cents:     0,
  category:        '',
  sdg_goals:       [] as number[],
  required_skills: [] as string[],
  status:          'active' as const,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_META = {
  active:   { color: '#22FFAA', label: 'Active',   bg: 'rgba(34,255,170,0.08)' },
  draft:    { color: '#FFB84D', label: 'Draft',    bg: 'rgba(255,184,77,0.08)' },
  paused:   { color: '#8B9CC0', label: 'Paused',   bg: 'rgba(139,156,192,0.08)' },
  archived: { color: '#4A5578', label: 'Archived', bg: 'rgba(74,85,120,0.08)' },
};

const APP_STATUS_META = {
  pending:   { color: '#FFB84D', label: 'Pending',   icon: Clock },
  accepted:  { color: '#22FFAA', label: 'Accepted',  icon: CheckCircle2 },
  rejected:  { color: '#FF5C7A', label: 'Rejected',  icon: XCircle },
  withdrawn: { color: '#4A5578', label: 'Withdrawn', icon: XCircle },
};

const DIFF_BADGE: Record<string, string> = {
  easy:   '#22FFAA',
  medium: '#FFB84D',
  hard:   '#FF5C7A',
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: typeof Globe; color: string }) {
  return (
    <div className="rounded-2xl p-4 flex items-center gap-3"
      style={{ background: '#07101F', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}12` }}>
        <Icon size={18} strokeWidth={1.8} style={{ color }} />
      </div>
      <div>
        <p className="text-[20px] font-black" style={{ color: '#F0F4FF' }}>{value}</p>
        <p className="text-[11px]" style={{ color: '#4A5578' }}>{label}</p>
      </div>
    </div>
  );
}

// ── Edit drawer ───────────────────────────────────────────────────────────────

function EditDrawer({
  missions, listing, onClose, onSaved,
}: {
  missions:  Mission[];
  listing:   Listing | null;
  onClose:   () => void;
  onSaved:   () => void;
}) {
  const [form,    setForm]    = useState({ ...BLANK_FORM, ...{
    tagline:         listing?.tagline         ?? '',
    highlight:       listing?.highlight       ?? '',
    listing_type:    listing?.listing_type    ?? 'free' as const,
    price_cents:     listing?.price_cents     ?? 0,
    category:        listing?.category        ?? '',
    sdg_goals:       listing?.sdg_goals       ?? [],
    required_skills: listing?.required_skills ?? [],
    status:          listing?.status          ?? 'active' as const,
  }});
  const [missionId, setMissionId] = useState(listing?.mission_id ?? missions[0]?.id ?? '');
  const [saving,    setSaving]    = useState(false);
  const [skillInput, setSkillInput] = useState('');

  async function save() {
    if (!missionId) return;
    setSaving(true);
    const payload = {
      mission_id:      missionId,
      tagline:         form.tagline,
      highlight:       form.highlight || null,
      listing_type:    form.listing_type,
      price_cents:     form.listing_type === 'paid' ? form.price_cents : 0,
      category:        form.category || null,
      sdg_goals:       form.sdg_goals,
      required_skills: form.required_skills,
      status:          form.status,
    };

    if (listing?.id) {
      await fetch(`/api/workspace/marketplace/listings/${listing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch('/api/workspace/marketplace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }
    setSaving(false);
    onSaved();
    onClose();
  }

  function toggleSdg(n: number) {
    setForm((f) => ({
      ...f, sdg_goals: f.sdg_goals.includes(n) ? f.sdg_goals.filter((x) => x !== n) : [...f.sdg_goals, n],
    }));
  }

  function addSkill() {
    const s = skillInput.trim();
    if (s && !form.required_skills.includes(s)) {
      setForm((f) => ({ ...f, required_skills: [...f.required_skills, s] }));
    }
    setSkillInput('');
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 z-40" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 260 }}
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg overflow-y-auto"
        style={{ background: '#050816', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="sticky top-0 flex items-center justify-between px-6 py-4 z-10"
          style={{ background: '#050816', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <h2 className="text-[16px] font-bold" style={{ color: '#F0F4FF' }}>
            {listing?.id ? 'Edit Listing' : 'New Listing'}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: '#07101F', border: '1px solid rgba(255,255,255,0.07)' }}>
            <X size={15} strokeWidth={2} style={{ color: '#8B9CC0' }} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Mission select */}
          {!listing?.id && (
            <div>
              <label className="block text-[11px] font-bold text-[#4A5578] uppercase tracking-wider mb-1.5">Mission</label>
              <select value={missionId} onChange={(e) => setMissionId(e.target.value)}
                className="w-full h-10 px-3 rounded-xl text-[13px] focus:outline-none"
                style={{ background: '#07101F', border: '1px solid rgba(255,255,255,0.08)', color: '#F0F4FF' }}>
                {missions.map((m) => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
            </div>
          )}

          {/* Tagline */}
          <div>
            <label className="block text-[11px] font-bold text-[#4A5578] uppercase tracking-wider mb-1.5">Tagline *</label>
            <input value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })}
              placeholder="One-line pitch for this mission"
              className="w-full h-10 px-3 rounded-xl text-[13px] focus:outline-none"
              style={{ background: '#07101F', border: '1px solid rgba(255,255,255,0.08)', color: '#F0F4FF' }} />
          </div>

          {/* Highlight */}
          <div>
            <label className="block text-[11px] font-bold text-[#4A5578] uppercase tracking-wider mb-1.5">Highlight</label>
            <textarea value={form.highlight} onChange={(e) => setForm({ ...form, highlight: e.target.value })}
              placeholder="Bold callout — e.g. '🏆 Winners featured in our annual impact report'"
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl text-[13px] resize-none focus:outline-none"
              style={{ background: '#07101F', border: '1px solid rgba(255,255,255,0.08)', color: '#F0F4FF' }} />
          </div>

          {/* Type + Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-[#4A5578] uppercase tracking-wider mb-1.5">Type</label>
              <select value={form.listing_type} onChange={(e) => setForm({ ...form, listing_type: e.target.value as typeof form.listing_type })}
                className="w-full h-10 px-3 rounded-xl text-[13px] focus:outline-none"
                style={{ background: '#07101F', border: '1px solid rgba(255,255,255,0.08)', color: '#F0F4FF' }}>
                <option value="free">Free</option>
                <option value="paid">Paid</option>
                <option value="sponsored">Sponsored</option>
              </select>
            </div>
            {form.listing_type === 'paid' && (
              <div>
                <label className="block text-[11px] font-bold text-[#4A5578] uppercase tracking-wider mb-1.5">Price (USD)</label>
                <input type="number" min="0" step="1"
                  value={form.price_cents / 100}
                  onChange={(e) => setForm({ ...form, price_cents: Math.round(parseFloat(e.target.value || '0') * 100) })}
                  className="w-full h-10 px-3 rounded-xl text-[13px] focus:outline-none"
                  style={{ background: '#07101F', border: '1px solid rgba(255,255,255,0.08)', color: '#F0F4FF' }} />
              </div>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="block text-[11px] font-bold text-[#4A5578] uppercase tracking-wider mb-1.5">Category</label>
            <div className="flex flex-wrap gap-2">
              {IMPACT_CATEGORIES.map((c) => (
                <button key={c.id} type="button"
                  onClick={() => setForm({ ...form, category: form.category === c.id ? '' : c.id })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all"
                  style={{
                    background:  form.category === c.id ? `${c.color}15` : 'transparent',
                    color:       form.category === c.id ? c.color : '#8B9CC0',
                    borderColor: form.category === c.id ? `${c.color}30` : 'rgba(255,255,255,0.07)',
                  }}>
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* SDG Goals */}
          <div>
            <label className="block text-[11px] font-bold text-[#4A5578] uppercase tracking-wider mb-1.5">SDG Goals</label>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 17 }, (_, i) => i + 1).map((n) => {
                const meta = SDG_META[n as keyof typeof SDG_META];
                const active = form.sdg_goals.includes(n);
                return meta ? (
                  <button key={n} type="button" onClick={() => toggleSdg(n)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all"
                    style={{
                      background:  active ? `${meta.color}15` : 'transparent',
                      color:       active ? meta.color : '#4A5578',
                      borderColor: active ? `${meta.color}30` : 'rgba(255,255,255,0.06)',
                    }}>
                    {meta.emoji} {n}
                  </button>
                ) : null;
              })}
            </div>
          </div>

          {/* Required skills */}
          <div>
            <label className="block text-[11px] font-bold text-[#4A5578] uppercase tracking-wider mb-1.5">Required Skills</label>
            <div className="flex gap-2 mb-2">
              <input value={skillInput} onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                placeholder="Type a skill and press Enter…"
                className="flex-1 h-9 px-3 rounded-xl text-[13px] focus:outline-none"
                style={{ background: '#07101F', border: '1px solid rgba(255,255,255,0.08)', color: '#F0F4FF' }} />
              <button onClick={addSkill} type="button"
                className="h-9 px-3 rounded-xl text-[12px] font-semibold"
                style={{ background: 'rgba(34,255,170,0.08)', border: '1px solid rgba(34,255,170,0.2)', color: '#22FFAA' }}>
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {form.required_skills.map((s) => (
                <span key={s} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold"
                  style={{ background: 'rgba(109,93,253,0.1)', border: '1px solid rgba(109,93,253,0.2)', color: '#6D5DFD' }}>
                  {s}
                  <button onClick={() => setForm((f) => ({ ...f, required_skills: f.required_skills.filter((x) => x !== s) }))}
                    type="button">
                    <X size={10} strokeWidth={2.5} />
                  </button>
                </span>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[11px] font-bold text-[#4A5578] uppercase tracking-wider mb-1.5">Status</label>
            <div className="flex gap-2">
              {(['active', 'draft', 'paused'] as const).map((s) => {
                const meta = STATUS_META[s];
                return (
                  <button key={s} type="button" onClick={() => setForm({ ...form, status: s })}
                    className="flex-1 h-9 rounded-xl text-[12px] font-semibold border transition-all"
                    style={{
                      background:  form.status === s ? meta.bg : 'transparent',
                      color:       form.status === s ? meta.color : '#8B9CC0',
                      borderColor: form.status === s ? `${meta.color}30` : 'rgba(255,255,255,0.07)',
                    }}>
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Save */}
          <button onClick={save} disabled={saving || !form.tagline.trim() || !missionId}
            className="w-full h-11 rounded-2xl font-bold text-[14px] flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            style={{ background: '#22FFAA', color: '#050816' }}>
            {saving ? 'Saving…' : listing?.id ? 'Update Listing' : 'Publish Listing'}
            <ArrowRight size={15} strokeWidth={2.5} />
          </button>
        </div>
      </motion.div>
    </>
  );
}

// ── Application drawer ────────────────────────────────────────────────────────

function ApplicationDrawer({
  listingTitle, applications, onClose, onUpdated,
}: {
  listingTitle: string;
  applications: Application[];
  onClose:      () => void;
  onUpdated:    () => void;
}) {
  const [updating, setUpdating] = useState<string | null>(null);

  async function setStatus(appId: string, status: Application['status']) {
    setUpdating(appId);
    await fetch(`/api/workspace/marketplace/applications/${appId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setUpdating(null);
    onUpdated();
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 z-40" onClick={onClose} />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 260 }}
        className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg overflow-y-auto"
        style={{ background: '#050816', borderLeft: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="sticky top-0 flex items-center justify-between px-6 py-4 z-10"
          style={{ background: '#050816', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div>
            <h2 className="text-[16px] font-bold" style={{ color: '#F0F4FF' }}>Applications</h2>
            <p className="text-[12px]" style={{ color: '#4A5578' }}>{listingTitle}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: '#07101F', border: '1px solid rgba(255,255,255,0.07)' }}>
            <X size={15} strokeWidth={2} style={{ color: '#8B9CC0' }} />
          </button>
        </div>

        <div className="p-6 space-y-3">
          {applications.length === 0 ? (
            <div className="text-center py-10">
              <Users size={28} strokeWidth={1.2} style={{ color: '#4A5578' }} className="mx-auto mb-3" />
              <p className="text-[14px] font-semibold" style={{ color: '#8B9CC0' }}>No applications yet</p>
            </div>
          ) : applications.map((app) => {
            const statusMeta = APP_STATUS_META[app.status];
            return (
              <div key={app.id} className="rounded-2xl p-4"
                style={{ background: '#07101F', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[12px] font-bold"
                      style={{ background: 'rgba(109,93,253,0.15)', color: '#6D5DFD' }}>
                      {(app.user_profile?.display_name ?? app.user_profile?.email ?? 'U')[0].toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold truncate" style={{ color: '#F0F4FF' }}>
                        {app.user_profile?.display_name ?? app.user_profile?.email ?? 'Unknown'}
                      </p>
                      <p className="text-[11px]" style={{ color: '#4A5578' }}>{formatDate(app.created_at)}</p>
                    </div>
                  </div>
                  <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: `${statusMeta.color}12`,
                      color:       statusMeta.color,
                      border:     `1px solid ${statusMeta.color}25`,
                    }}>
                    {statusMeta.label}
                  </span>
                </div>
                {app.cover_note && (
                  <p className="text-[12px] mb-3 p-2.5 rounded-xl" style={{ background: '#0A1226', color: '#8B9CC0' }}>
                    {app.cover_note}
                  </p>
                )}
                {app.status === 'pending' && (
                  <div className="flex gap-2">
                    <button onClick={() => setStatus(app.id, 'accepted')} disabled={!!updating}
                      className="flex-1 h-8 rounded-xl text-[12px] font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5"
                      style={{ background: 'rgba(34,255,170,0.08)', border: '1px solid rgba(34,255,170,0.2)', color: '#22FFAA' }}>
                      {updating === app.id ? <RefreshCw size={11} className="animate-spin" /> : <CheckCircle2 size={11} strokeWidth={2} />}
                      Accept
                    </button>
                    <button onClick={() => setStatus(app.id, 'rejected')} disabled={!!updating}
                      className="flex-1 h-8 rounded-xl text-[12px] font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5"
                      style={{ background: 'rgba(255,92,122,0.08)', border: '1px solid rgba(255,92,122,0.2)', color: '#FF5C7A' }}>
                      <XCircle size={11} strokeWidth={2} />
                      Decline
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function WorkspaceMarketplacePage() {
  const [tab,          setTab]          = useState<Tab>('listings');
  const [listings,     setListings]     = useState<Listing[]>([]);
  const [missions,     setMissions]     = useState<Mission[]>([]);
  const [allApps,      setAllApps]      = useState<Application[]>([]);
  const [loading,      setLoading]      = useState(true);
  // undefined = drawer closed; null = new listing; Listing = edit existing
  const [editListing,  setEditListing]  = useState<Listing | null | undefined>(undefined);
  const [viewApps,     setViewApps]     = useState<Listing | null>(null);
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState<Listing['status'] | 'all'>('all');

  const drawerOpen = editListing !== undefined;

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/workspace/marketplace');
      const data = await res.json();
      setListings((data.listings ?? []) as Listing[]);
      setMissions((data.missions ?? []) as Mission[]);
      setAllApps((data.applications ?? []) as Application[]);
    } catch {
      // leave state as-is on network failure
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  async function toggleStatus(listing: Listing) {
    const next = listing.status === 'active' ? 'paused' : 'active';
    await fetch(`/api/workspace/marketplace/listings/${listing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    void load();
  }

  async function deleteListing(id: string) {
    if (!confirm('Remove this listing from the marketplace?')) return;
    await fetch(`/api/workspace/marketplace/listings/${id}`, { method: 'DELETE' });
    void load();
  }

  async function setAppStatus(appId: string, status: Application['status']) {
    await fetch(`/api/workspace/marketplace/applications/${appId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    void load();
  }

  const appsForListing = useCallback(
    (id: string) => allApps.filter((a) => a.listing_id === id),
    [allApps],
  );

  const filtered = listings.filter((l) => {
    if (statusFilter !== 'all' && l.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return l.mission.title.toLowerCase().includes(q) || l.tagline.toLowerCase().includes(q);
    }
    return true;
  });

  const totalViews     = listings.reduce((s, l) => s + l.view_count, 0);
  const totalApplied   = listings.reduce((s, l) => s + l.apply_count, 0);
  const activeListings = listings.filter((l) => l.status === 'active').length;
  const pendingApps    = allApps.filter((a) => a.status === 'pending').length;

  return (
    <div className="min-h-screen p-6 md:p-8" style={{ background: '#050816' }}>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-[24px] font-black" style={{ color: '#F0F4FF' }}>Marketplace</h1>
            <p className="text-[13px] mt-0.5" style={{ color: '#4A5578' }}>
              List your missions publicly and manage applications
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/marketplace" target="_blank"
              className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-[13px] font-semibold"
              style={{ background: '#07101F', border: '1px solid rgba(255,255,255,0.08)', color: '#8B9CC0' }}>
              <ExternalLink size={13} strokeWidth={2} />
              View public page
            </Link>
            <button
              onClick={() => setEditListing(null)}
              className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-[13px] font-semibold"
              style={{ background: 'rgba(34,255,170,0.08)', border: '1px solid rgba(34,255,170,0.2)', color: '#22FFAA' }}>
              <Plus size={14} strokeWidth={2.5} />
              New Listing
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Active Listings" value={activeListings}  icon={Globe}      color="#22FFAA" />
          <StatCard label="Total Views"     value={totalViews}      icon={Eye}        color="#6D5DFD" />
          <StatCard label="Applications"    value={totalApplied}    icon={Users}      color="#FFB84D" />
          <StatCard label="Pending Review"  value={pendingApps}     icon={AlertCircle} color="#FF5C7A" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 p-1 rounded-2xl w-fit"
          style={{ background: '#07101F', border: '1px solid rgba(255,255,255,0.07)' }}>
          {([['listings', 'Listings'], ['applications', 'Applications']] as [Tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('h-8 px-5 rounded-xl text-[13px] font-semibold transition-all',
                tab === t ? 'text-[#F0F4FF]' : 'text-[#4A5578] hover:text-[#8B9CC0]')}
              style={tab === t ? { background: '#0A1226', boxShadow: '0 0 0 1px rgba(255,255,255,0.1)' } : {}}>
              {label}
              {t === 'applications' && pendingApps > 0 && (
                <span className="ml-1.5 text-[9px] font-black px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,92,122,0.15)', color: '#FF5C7A' }}>
                  {pendingApps}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Filter bar */}
        <div className="flex gap-3 mb-5">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4A5578' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search listings…"
              className="w-full h-9 pl-9 pr-3 rounded-xl text-[13px] focus:outline-none"
              style={{ background: '#07101F', border: '1px solid rgba(255,255,255,0.08)', color: '#F0F4FF' }} />
          </div>
          {tab === 'listings' && (
            <div className="flex gap-1.5">
              {(['all', 'active', 'draft', 'paused'] as const).map((s) => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={cn('h-9 px-3 rounded-xl text-[12px] font-semibold border transition-all capitalize',
                    statusFilter === s
                      ? 'bg-[rgba(255,255,255,0.06)] text-[#F0F4FF] border-[rgba(255,255,255,0.12)]'
                      : 'text-[#4A5578] border-[rgba(255,255,255,0.06)] hover:text-[#8B9CC0]')}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: '#07101F' }} />
            ))}
          </div>
        ) : tab === 'listings' ? (
          filtered.length === 0 ? (
            <div className="text-center py-20 rounded-3xl"
              style={{ background: '#07101F', border: '1px solid rgba(255,255,255,0.05)' }}>
              <Globe size={32} strokeWidth={1} style={{ color: '#4A5578' }} className="mx-auto mb-3" />
              <p className="text-[16px] font-bold mb-1" style={{ color: '#8B9CC0' }}>
                {listings.length === 0 ? 'No listings yet' : 'No results'}
              </p>
              <p className="text-[13px] mb-5" style={{ color: '#4A5578' }}>
                {listings.length === 0
                  ? 'Publish your first mission to the global marketplace.'
                  : 'Adjust your filter or search term.'}
              </p>
              {listings.length === 0 && (
                <button onClick={() => setEditListing(null)}
                  className="inline-flex items-center gap-2 h-9 px-5 rounded-xl text-[13px] font-semibold"
                  style={{ background: 'rgba(34,255,170,0.08)', border: '1px solid rgba(34,255,170,0.2)', color: '#22FFAA' }}>
                  <Plus size={14} strokeWidth={2.5} />
                  New Listing
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((listing) => {
                const apps = appsForListing(listing.id);
                const statusMeta = STATUS_META[listing.status];
                const catMeta = IMPACT_CATEGORIES.find((c) => c.id === listing.category);
                return (
                  <motion.div key={listing.id}
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl overflow-hidden"
                    style={{ background: '#07101F', border: '1px solid rgba(255,255,255,0.07)' }}>
                    {/* Left accent */}
                    <div className="flex">
                      {catMeta && <div className="w-1 flex-shrink-0" style={{ background: catMeta.color }} />}
                      <div className="flex-1 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                                style={{ background: statusMeta.bg, color: statusMeta.color, border: `1px solid ${statusMeta.color}25` }}>
                                {statusMeta.label}
                              </span>
                              {listing.is_featured && (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                                  style={{ background: 'rgba(255,184,77,0.1)', color: '#FFB84D', border: '1px solid rgba(255,184,77,0.2)' }}>
                                  ⭐ Featured
                                </span>
                              )}
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full capitalize"
                                style={{ background: 'rgba(109,93,253,0.08)', color: '#6D5DFD', border: '1px solid rgba(109,93,253,0.15)' }}>
                                {listing.listing_type}
                              </span>
                            </div>
                            <h3 className="text-[14px] font-bold truncate" style={{ color: '#F0F4FF' }}>
                              {listing.mission.title}
                            </h3>
                            <p className="text-[12px] truncate mt-0.5" style={{ color: '#8B9CC0' }}>{listing.tagline}</p>
                          </div>

                          {/* Metrics */}
                          <div className="flex items-center gap-4 text-[11px] flex-shrink-0" style={{ color: '#4A5578' }}>
                            <span className="flex items-center gap-1">
                              <Eye size={11} /> {listing.view_count.toLocaleString()}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users size={11} /> {listing.apply_count.toLocaleString()}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 mt-3 pt-3"
                          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                          <button onClick={() => setViewApps(listing)}
                            className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-semibold transition-all"
                            style={{ background: 'rgba(109,93,253,0.08)', border: '1px solid rgba(109,93,253,0.15)', color: '#6D5DFD' }}>
                            <Users size={11} strokeWidth={2} />
                            {apps.length} Applications
                            {apps.filter((a) => a.status === 'pending').length > 0 && (
                              <span className="ml-1 text-[9px] font-black px-1 rounded-full bg-[rgba(255,92,122,0.2)] text-[#FF5C7A]">
                                {apps.filter((a) => a.status === 'pending').length}
                              </span>
                            )}
                          </button>
                          <button onClick={() => setEditListing(listing)}
                            className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-semibold transition-all"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#8B9CC0' }}>
                            <Pencil size={11} strokeWidth={2} />
                            Edit
                          </button>
                          <button onClick={() => toggleStatus(listing)}
                            className="flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-semibold transition-all"
                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#8B9CC0' }}>
                            {listing.status === 'active'
                              ? <><ToggleRight size={11} strokeWidth={2} style={{ color: '#22FFAA' }} /> Pause</>
                              : <><ToggleLeft size={11} strokeWidth={2} /> Activate</>}
                          </button>
                          <button onClick={() => deleteListing(listing.id)}
                            className="ml-auto flex items-center gap-1.5 h-7 px-3 rounded-lg text-[11px] font-semibold transition-all"
                            style={{ background: 'rgba(255,92,122,0.06)', border: '1px solid rgba(255,92,122,0.1)', color: '#FF5C7A' }}>
                            <Trash2 size={11} strokeWidth={2} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )
        ) : (
          /* Applications tab */
          <div className="space-y-3">
            {allApps.length === 0 ? (
              <div className="text-center py-20 rounded-3xl"
                style={{ background: '#07101F', border: '1px solid rgba(255,255,255,0.05)' }}>
                <Users size={32} strokeWidth={1} style={{ color: '#4A5578' }} className="mx-auto mb-3" />
                <p className="text-[16px] font-bold" style={{ color: '#8B9CC0' }}>No applications yet</p>
              </div>
            ) : allApps.filter((a) => !search || (a.user_profile?.display_name ?? a.user_profile?.email ?? '').toLowerCase().includes(search.toLowerCase())).map((app) => {
              const statusMeta = APP_STATUS_META[app.status];
              const listing = listings.find((l) => l.id === app.listing_id);
              return (
                <motion.div key={app.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl p-4"
                  style={{ background: '#07101F', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-[13px] font-bold"
                      style={{ background: 'rgba(109,93,253,0.15)', color: '#6D5DFD' }}>
                      {(app.user_profile?.display_name ?? app.user_profile?.email ?? 'U')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className="text-[14px] font-bold truncate" style={{ color: '#F0F4FF' }}>
                          {app.user_profile?.display_name ?? app.user_profile?.email ?? 'Unknown user'}
                        </p>
                        <span className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: `${statusMeta.color}12`, color: statusMeta.color, border: `1px solid ${statusMeta.color}25` }}>
                          {statusMeta.label}
                        </span>
                      </div>
                      {listing && (
                        <p className="text-[11px] mb-1" style={{ color: '#4A5578' }}>
                          → {listing.mission.title}
                        </p>
                      )}
                      {app.cover_note && (
                        <p className="text-[12px] mt-1.5 p-2 rounded-xl line-clamp-2" style={{ background: '#0A1226', color: '#8B9CC0' }}>
                          {app.cover_note}
                        </p>
                      )}
                      <p className="text-[10px] mt-1.5" style={{ color: '#4A5578' }}>{formatDate(app.created_at)}</p>
                    </div>
                  </div>
                  {app.status === 'pending' && (
                    <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      <button onClick={() => setAppStatus(app.id, 'accepted')}
                        className="flex-1 h-8 rounded-xl text-[12px] font-semibold flex items-center justify-center gap-1.5"
                        style={{ background: 'rgba(34,255,170,0.08)', border: '1px solid rgba(34,255,170,0.2)', color: '#22FFAA' }}>
                        <CheckCircle2 size={12} strokeWidth={2} /> Accept
                      </button>
                      <button onClick={() => setAppStatus(app.id, 'rejected')}
                        className="flex-1 h-8 rounded-xl text-[12px] font-semibold flex items-center justify-center gap-1.5"
                        style={{ background: 'rgba(255,92,122,0.08)', border: '1px solid rgba(255,92,122,0.2)', color: '#FF5C7A' }}>
                        <XCircle size={12} strokeWidth={2} /> Decline
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Drawers */}
      <AnimatePresence>
        {drawerOpen && (
          <EditDrawer
            missions={missions}
            listing={editListing as Listing | null}
            onClose={() => setEditListing(undefined)}
            onSaved={load}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {viewApps && (
          <ApplicationDrawer
            listingTitle={viewApps.mission.title}
            applications={appsForListing(viewApps.id)}
            onClose={() => setViewApps(null)}
            onUpdated={load}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
