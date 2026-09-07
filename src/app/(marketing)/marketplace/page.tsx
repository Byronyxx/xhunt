'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, SlidersHorizontal, ArrowRight, Users, Star, Zap,
  Globe, Target, Award, TrendingUp, ChevronRight, ExternalLink,
  Filter, X, Sparkles, CheckCircle2, Clock, MapPin, Building2,
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { IMPACT_CATEGORIES, SDG_META, estimateCashReward } from '@/lib/missionCategories';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ListingRow {
  id:              string;
  mission_id:      string;
  tagline:         string;
  highlight:       string | null;
  listing_type:    'free' | 'paid' | 'sponsored';
  price_cents:     number;
  category:        string | null;
  sdg_goals:       number[];
  required_skills: string[];
  is_featured:     boolean;
  view_count:      number;
  apply_count:     number;
  published_at:    string | null;
  mission: {
    id:             string;
    title:          string;
    story_context:  string | null;
    difficulty:     string;
    estimated_time: string | null;
    tags:           string[];
    reward:         string;
    tenant: {
      name:     string;
      logo_url: string | null;
      slug:     string;
    } | null;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { id: 'featured',    label: 'Featured' },
  { id: 'popular',     label: 'Most Applied' },
  { id: 'newest',      label: 'Newest' },
  { id: 'reward_high', label: 'Highest Reward' },
] as const;

const DIFF_COLORS: Record<string, string> = {
  easy:   '#22FFAA',
  medium: '#FFB84D',
  hard:   '#FF5C7A',
};

function ListingCard({ listing, onApply }: { listing: ListingRow; onApply: (id: string) => void }) {
  const m = listing.mission;
  const catMeta = IMPACT_CATEGORIES.find((c) => c.id === listing.category);
  const diffColor = DIFF_COLORS[m.difficulty] ?? '#8B9CC0';
  const cashEst = estimateCashReward(undefined, m.difficulty as 'easy' | 'medium' | 'hard', undefined);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="group rounded-2xl overflow-hidden transition-all hover:scale-[1.01] cursor-pointer"
      style={{ background: '#07101F', border: '1px solid rgba(255,255,255,0.07)' }}
      onClick={() => onApply(listing.id)}
    >
      {/* Category stripe */}
      {catMeta && (
        <div className="h-1" style={{ background: catMeta.color }} />
      )}

      <div className="p-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              {listing.is_featured && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,184,77,0.12)', color: '#FFB84D', border: '1px solid rgba(255,184,77,0.2)' }}>
                  ⭐ Featured
                </span>
              )}
              {listing.listing_type === 'paid' && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(34,255,170,0.08)', color: '#22FFAA', border: '1px solid rgba(34,255,170,0.2)' }}>
                  💰 Paid
                </span>
              )}
              {catMeta && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: `${catMeta.color}10`, color: catMeta.color, border: `1px solid ${catMeta.color}25` }}>
                  {catMeta.emoji} {catMeta.label}
                </span>
              )}
            </div>
            <h3 className="text-[15px] font-bold leading-snug" style={{ color: '#F0F4FF' }}>{m.title}</h3>
            {listing.tagline && (
              <p className="text-[12px] mt-1 leading-relaxed line-clamp-2" style={{ color: '#8B9CC0' }}>{listing.tagline}</p>
            )}
          </div>
          {listing.listing_type === 'paid' && listing.price_cents > 0 ? (
            <div className="text-right flex-shrink-0">
              <p className="text-[18px] font-black" style={{ color: '#22FFAA' }}>
                ${(listing.price_cents / 100).toFixed(0)}
              </p>
              <p className="text-[10px] text-[#4A5578]">to join</p>
            </div>
          ) : cashEst ? (
            <div className="text-right flex-shrink-0">
              <p className="text-[16px] font-black" style={{ color: '#22FFAA' }}>{cashEst}</p>
              <p className="text-[10px] text-[#4A5578]">reward</p>
            </div>
          ) : null}
        </div>

        {/* Org */}
        {m.tenant && (
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-md overflow-hidden flex-shrink-0"
              style={{ background: '#0A1226' }}>
              {m.tenant.logo_url
                ? <img src={m.tenant.logo_url} alt="" className="w-full h-full object-cover" />
                : <Building2 size={12} strokeWidth={1.5} style={{ color: '#4A5578', margin: 'auto' }} />}
            </div>
            <span className="text-[11px] font-semibold" style={{ color: '#8B9CC0' }}>{m.tenant.name}</span>
          </div>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-4 mb-3 text-[11px]" style={{ color: '#4A5578' }}>
          <span className="flex items-center gap-1">
            <Users size={11} strokeWidth={2} />
            {listing.apply_count.toLocaleString()} applied
          </span>
          <span className="flex items-center gap-1">
            <Clock size={11} strokeWidth={2} />
            {m.estimated_time || 'Self-paced'}
          </span>
          <span className="flex items-center gap-1" style={{ color: diffColor }}>
            <Zap size={11} strokeWidth={2} />
            {m.difficulty}
          </span>
        </div>

        {/* SDG chips */}
        {listing.sdg_goals.length > 0 && (
          <div className="flex gap-1 flex-wrap mb-3">
            {listing.sdg_goals.slice(0, 4).map((g) => {
              const meta = SDG_META[g as keyof typeof SDG_META];
              return meta ? (
                <span key={g} className="text-[9px] font-bold px-1.5 py-0.5 rounded-md"
                  style={{ background: `${meta.color}15`, color: meta.color, border: `1px solid ${meta.color}25` }}>
                  {meta.emoji} SDG {g}
                </span>
              ) : null;
            })}
          </div>
        )}

        {/* CTA */}
        <button
          className="w-full h-9 rounded-xl font-semibold text-[13px] flex items-center justify-center gap-2 transition-all"
          style={{
            background: 'rgba(34,255,170,0.08)',
            border: '1px solid rgba(34,255,170,0.2)',
            color: '#22FFAA',
          }}
          onClick={(e) => { e.stopPropagation(); onApply(listing.id); }}
        >
          Apply Now <ArrowRight size={13} strokeWidth={2.5} />
        </button>
      </div>
    </motion.div>
  );
}

// ── Apply modal ───────────────────────────────────────────────────────────────

function ApplyModal({ listingId, onClose }: { listingId: string; onClose: () => void }) {
  const [note,      setNote]      = useState('');
  const [applying,  setApplying]  = useState(false);
  const [applied,   setApplied]   = useState(false);
  const [applyError, setApplyError] = useState('');

  async function submit() {
    setApplying(true);
    setApplyError('');

    try {
      const res = await fetch('/api/marketplace/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, note: note.trim() || undefined }),
      });

      if (res.status === 401) {
        window.location.href = '/auth/login';
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Application failed');

      setApplied(true);
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Application failed');
    } finally {
      setApplying(false);
    }
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 z-40" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-full max-w-md rounded-3xl p-6" style={{ background: '#07101F', border: '1px solid rgba(255,255,255,0.1)' }}>
          {applied ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: 'rgba(34,255,170,0.1)', border: '1px solid rgba(34,255,170,0.3)' }}>
                <CheckCircle2 size={28} strokeWidth={2} style={{ color: '#22FFAA' }} />
              </div>
              <h3 className="text-xl font-bold mb-2" style={{ color: '#F0F4FF' }}>Application Sent!</h3>
              <p className="text-[13px] mb-5" style={{ color: '#8B9CC0' }}>
                The organization will review your application and get back to you.
              </p>
              <button onClick={onClose} className="w-full h-11 rounded-2xl font-bold text-[14px]"
                style={{ background: '#22FFAA', color: '#050816' }}>
                Done
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-[16px] font-bold" style={{ color: '#F0F4FF' }}>Apply for Mission</h3>
                <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{ background: '#0A1226', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <X size={15} strokeWidth={2} style={{ color: '#8B9CC0' }} />
                </button>
              </div>
              <div className="mb-4">
                <label className="text-[10px] font-bold text-[#4A5578] uppercase tracking-wider mb-1.5 block">
                  Cover Note (optional)
                </label>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4}
                  placeholder="Tell the organization why you're the right person for this mission…"
                  className="w-full px-3 py-2.5 rounded-xl text-[13px] resize-none focus:outline-none"
                  style={{ background: '#0A1226', border: '1px solid rgba(255,255,255,0.08)', color: '#F0F4FF' }} />
              </div>
              {applyError && (
                <p className="text-[12px] mb-3" style={{ color: '#FF5C7A' }}>{applyError}</p>
              )}
              <button onClick={submit} disabled={applying}
                className="w-full h-11 rounded-2xl font-bold text-[14px] flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: '#22FFAA', color: '#050816' }}>
                {applying ? 'Sending…' : 'Submit Application'}
                <ArrowRight size={15} strokeWidth={2.5} />
              </button>
            </>
          )}
        </div>
      </motion.div>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MarketplacePage() {
  const [listings,    setListings]    = useState<ListingRow[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [category,    setCategory]    = useState<string | null>(null);
  const [sort,        setSort]        = useState<typeof SORT_OPTIONS[number]['id']>('featured');
  const [showFilters, setShowFilters] = useState(false);
  const [applyId,     setApplyId]     = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/marketplace/listings');
        const data = await res.json();
        setListings((data.listings ?? []) as ListingRow[]);
      } catch {
        // leave listings empty on network failure
      }
      setLoading(false);
    }
    void load();
  }, []);

  // Filter + sort
  const filtered = listings
    .filter((l) => {
      if (category && l.category !== category) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          l.mission.title.toLowerCase().includes(q) ||
          (l.tagline?.toLowerCase().includes(q) ?? false) ||
          l.mission.tags.some((t) => t.toLowerCase().includes(q))
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sort === 'featured')    return Number(b.is_featured) - Number(a.is_featured);
      if (sort === 'popular')     return b.apply_count - a.apply_count;
      if (sort === 'newest')      return new Date(b.published_at ?? b.mission.reward).getTime() - new Date(a.published_at ?? 0).getTime();
      if (sort === 'reward_high') return b.price_cents - a.price_cents;
      return 0;
    });

  const featuredCount = listings.filter((l) => l.is_featured).length;
  const totalApplied  = listings.reduce((sum, l) => sum + l.apply_count, 0);

  return (
    <div className="min-h-screen" style={{ background: '#050816' }}>
      {/* Hero */}
      <div className="max-w-6xl mx-auto px-6 pt-20 pb-12">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4"
            style={{ background: 'rgba(34,255,170,0.08)', border: '1px solid rgba(34,255,170,0.2)' }}>
            <Globe size={13} strokeWidth={2} style={{ color: '#22FFAA' }} />
            <span className="text-[12px] font-semibold" style={{ color: '#22FFAA' }}>Impact Marketplace</span>
          </div>
          <h1 className="text-[42px] md:text-[56px] font-black leading-none mb-4"
            style={{ color: '#F0F4FF' }}>
            Find missions that<br />
            <span style={{ color: '#22FFAA' }}>match your impact</span>
          </h1>
          <p className="text-[16px] max-w-2xl mx-auto" style={{ color: '#8B9CC0' }}>
            Discover paid and pro-bono missions from NGOs, startups, universities, and governments.
            Get rewarded for real-world impact.
          </p>
        </motion.div>

        {/* Stats bar */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="flex items-center justify-center gap-8 mb-10">
          {[
            { label: 'Live Missions', value: listings.length.toString(), icon: Target },
            { label: 'Featured',      value: featuredCount.toString(),  icon: Star },
            { label: 'Total Applied', value: totalApplied > 1000 ? `${(totalApplied/1000).toFixed(1)}K` : totalApplied.toString(), icon: Users },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="flex items-center gap-2">
              <Icon size={14} strokeWidth={2} style={{ color: '#22FFAA' }} />
              <span className="text-[18px] font-black" style={{ color: '#F0F4FF' }}>{value}</span>
              <span className="text-[12px]" style={{ color: '#4A5578' }}>{label}</span>
            </div>
          ))}
        </motion.div>

        {/* Search + Filter bar */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="flex gap-3 mb-6">
          <div className="flex-1 relative">
            <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2" strokeWidth={2} style={{ color: '#4A5578' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search missions, organizations, skills…"
              className="w-full h-11 pl-10 pr-4 rounded-2xl text-[14px] focus:outline-none transition-all"
              style={{ background: '#07101F', border: '1px solid rgba(255,255,255,0.08)', color: '#F0F4FF' }} />
          </div>
          <button onClick={() => setShowFilters(!showFilters)}
            className={cn('flex items-center gap-2 h-11 px-4 rounded-2xl text-[13px] font-semibold transition-all',
              showFilters ? 'bg-[rgba(34,255,170,0.1)] text-[#22FFAA] border border-[rgba(34,255,170,0.25)]'
                          : 'text-[#8B9CC0] border border-[rgba(255,255,255,0.08)]')}
            style={!showFilters ? { background: '#07101F' } : {}}>
            <Filter size={14} strokeWidth={2} />Filters
          </button>
        </motion.div>

        {/* Filter panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} className="overflow-hidden mb-6">
              <div className="rounded-2xl p-5 space-y-4" style={{ background: '#07101F', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div>
                  <p className="text-[10px] font-bold text-[#4A5578] uppercase tracking-wider mb-2">Sort By</p>
                  <div className="flex gap-2 flex-wrap">
                    {SORT_OPTIONS.map((s) => (
                      <button key={s.id} onClick={() => setSort(s.id)}
                        className={cn('px-3 py-1.5 rounded-xl text-[12px] font-semibold border transition-all',
                          sort === s.id
                            ? 'bg-[rgba(34,255,170,0.1)] text-[#22FFAA] border-[rgba(34,255,170,0.25)]'
                            : 'text-[#8B9CC0] border-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.15)]')}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-[#4A5578] uppercase tracking-wider mb-2">Impact Category</p>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setCategory(null)}
                      className={cn('px-3 py-1.5 rounded-xl text-[12px] font-semibold border transition-all',
                        !category ? 'bg-[rgba(255,255,255,0.08)] text-[#F0F4FF] border-[rgba(255,255,255,0.15)]'
                                  : 'text-[#8B9CC0] border-[rgba(255,255,255,0.06)]')}>
                      All
                    </button>
                    {IMPACT_CATEGORIES.map((c) => (
                      <button key={c.id} onClick={() => setCategory(c.id === category ? null : c.id)}
                        className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold border transition-all')}
                        style={{
                          background:  category === c.id ? `${c.color}15` : 'transparent',
                          color:       category === c.id ? c.color : '#8B9CC0',
                          borderColor: category === c.id ? `${c.color}30` : 'rgba(255,255,255,0.06)',
                        }}>
                        {c.emoji} {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 rounded-2xl animate-pulse" style={{ background: '#07101F' }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[18px] font-bold mb-2" style={{ color: '#F0F4FF' }}>
              {listings.length === 0 ? 'No missions listed yet' : 'No results found'}
            </p>
            <p className="text-[14px]" style={{ color: '#4A5578' }}>
              {listings.length === 0
                ? 'Organizations will start listing missions here soon.'
                : 'Try a different search or category filter.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((l) => (
              <ListingCard key={l.id} listing={l} onApply={setApplyId} />
            ))}
          </div>
        )}

        {/* CTA for orgs */}
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          className="mt-20 rounded-3xl p-10 text-center"
          style={{ background: 'linear-gradient(135deg,rgba(109,93,253,0.12),rgba(34,255,170,0.08))', border: '1px solid rgba(34,255,170,0.15)' }}>
          <Sparkles size={28} strokeWidth={1.5} style={{ color: '#22FFAA' }} className="mx-auto mb-4" />
          <h2 className="text-[28px] font-black mb-3" style={{ color: '#F0F4FF' }}>List your missions here</h2>
          <p className="text-[15px] mb-6 max-w-lg mx-auto" style={{ color: '#8B9CC0' }}>
            Reach thousands of skilled contributors. Post your challenge and get applications from people who want to make an impact.
          </p>
          <Link href="/workspace"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-[14px]"
            style={{ background: '#22FFAA', color: '#050816' }}>
            Go to Workspace <ChevronRight size={15} strokeWidth={2.5} />
          </Link>
        </motion.div>
      </div>

      {/* Apply modal */}
      <AnimatePresence>
        {applyId && <ApplyModal listingId={applyId} onClose={() => setApplyId(null)} />}
      </AnimatePresence>
    </div>
  );
}
