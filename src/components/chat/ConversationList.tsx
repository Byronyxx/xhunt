'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Users, Target, Building2, Plus, Search, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useConversations } from '@/hooks/useMessages';
import { useAuth } from '@/lib/auth/context';
import { LIQUID_GLASS_STYLE } from '@/components/LiquidGlass';
import type { ConversationWithDetails } from '@/lib/supabase/types';

/* ─── design tokens ─── */
const BG    = '#050816';
const CARD  = '#0A1226';
const ACCENT = '#22FFAA';
const DIM   = '#8B9CC0';
const FAINT = '#4A5578';
const TXT   = '#F0F4FF';

const XGLASS: React.CSSProperties = LIQUID_GLASS_STYLE;

/* ─── helpers ─── */
function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)   return 'now';
  if (mins  < 60)  return `${mins}m`;
  if (hours < 24)  return `${hours}h`;
  if (days  < 7)   return `${days}d`;
  return new Date(iso).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

function convDisplayName(conv: ConversationWithDetails, userId: string): string {
  if (conv.name) return conv.name;
  if (conv.type === 'direct') {
    const other = conv.members.find((m) => m.user_id !== userId);
    return other?.profile?.display_name ?? 'Unknown';
  }
  return `Mission Chat`;
}

function convAvatar(conv: ConversationWithDetails, userId: string): string | null {
  if (conv.avatar_url) return conv.avatar_url;
  if (conv.type === 'direct') {
    const other = conv.members.find((m) => m.user_id !== userId);
    return other?.profile?.avatar_url ?? null;
  }
  return null;
}

const TYPE_ICON: Record<string, React.ElementType> = {
  direct:       MessageSquare,
  mission:      Target,
  team:         Users,
  organization: Building2,
  community:    Users,
};

/* ─── ConversationItem ─── */
function ConversationItem({
  conv, userId, active, onClick,
}: {
  conv: ConversationWithDetails;
  userId: string;
  active: boolean;
  onClick: () => void;
}) {
  const name    = convDisplayName(conv, userId);
  const avatar  = convAvatar(conv, userId);
  const Icon    = TYPE_ICON[conv.type] ?? MessageSquare;
  const preview = conv.last_message?.content ?? null;
  const stamp   = timeAgo(conv.last_message_at);
  const unread  = conv.unread_count;

  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      style={{
        width: '100%', textAlign: 'left', padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        background: active ? 'rgba(34,255,170,0.08)' : 'transparent',
        border: 'none', borderRadius: 14, cursor: 'pointer',
        borderLeft: active ? `3px solid ${ACCENT}` : '3px solid transparent',
        transition: 'all .15s',
      }}
    >
      {/* Avatar */}
      <div style={{
        width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
        background: avatar ? 'transparent' : 'rgba(34,255,170,0.1)',
        border: '1px solid rgba(34,255,170,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden', position: 'relative',
      }}>
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Icon size={18} style={{ color: ACCENT }} />
        )}
        {unread > 0 && (
          <div style={{
            position: 'absolute', top: -2, right: -2,
            width: 18, height: 18, borderRadius: '50%',
            background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 800, color: BG, border: `2px solid ${BG}`,
          }}>
            {unread > 9 ? '9+' : unread}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{
            fontSize: 14, fontWeight: unread > 0 ? 700 : 500,
            color: unread > 0 ? TXT : '#D0D8F0',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150,
          }}>
            {name}
          </span>
          <span style={{ fontSize: 11, color: FAINT, flexShrink: 0, marginLeft: 8 }}>{stamp}</span>
        </div>
        {preview && (
          <span style={{
            fontSize: 12.5, color: unread > 0 ? DIM : FAINT,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            display: 'block', fontWeight: unread > 0 ? 500 : 400,
          }}>
            {preview}
          </span>
        )}
        {!preview && (
          <span style={{ fontSize: 12, color: FAINT, fontStyle: 'italic' }}>
            {conv.type === 'mission' ? 'Mission workspace' : 'No messages yet'}
          </span>
        )}
      </div>
    </motion.button>
  );
}

/* ─── ConversationList ─── */
export default function ConversationList() {
  const router   = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const userId   = user?.id ?? null;
  const [query,  setQuery]  = useState('');
  const [showNewDM, setShowNewDM] = useState(false);

  const { conversations, loading } = useConversations(userId);

  const activeId = pathname.startsWith('/messages/') ? pathname.split('/')[2] : null;

  const filtered = query.trim()
    ? conversations.filter((c) => {
        const name = convDisplayName(c, userId ?? '').toLowerCase();
        return name.includes(query.toLowerCase());
      })
    : conversations;

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: 'rgba(5,8,22,0.98)',
      borderRight: '1px solid rgba(255,255,255,0.07)',
    }}>
      {/* Header */}
      <div style={{
        padding: '18px 16px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: TXT, letterSpacing: '-0.02em' }}>
            Messages
          </span>
          <motion.button
            whileTap={{ scale: 0.93 }}
            onClick={() => setShowNewDM(true)}
            style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'rgba(34,255,170,0.12)',
              border: '1px solid rgba(34,255,170,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Plus size={16} style={{ color: ACCENT }} />
          </motion.button>
        </div>

        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10, padding: '8px 12px',
        }}>
          <Search size={14} style={{ color: FAINT, flexShrink: 0 }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search messages..."
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              color: TXT, fontSize: 13, flex: 1,
              fontFamily: 'inherit',
            }}
          />
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px', scrollbarWidth: 'none' }}>
        {loading && (
          <div style={{ padding: '32px 16px', textAlign: 'center' }}>
            <div style={{ width: 24, height: 24, border: `2px solid ${FAINT}`, borderTopColor: ACCENT, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' }} />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ padding: '48px 16px', textAlign: 'center' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: 'rgba(34,255,170,0.08)',
              border: '1px solid rgba(34,255,170,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 12px',
            }}>
              <MessageSquare size={20} style={{ color: FAINT }} />
            </div>
            <p style={{ fontSize: 13, color: FAINT, margin: 0 }}>
              {query ? 'No results' : 'No conversations yet'}
            </p>
            {!query && (
              <p style={{ fontSize: 12, color: '#2D3550', marginTop: 4 }}>
                Join a mission to start chatting
              </p>
            )}
          </div>
        )}

        <AnimatePresence>
          {filtered.map((conv) => (
            <motion.div
              key={conv.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
            >
              <ConversationItem
                conv={conv}
                userId={userId ?? ''}
                active={conv.id === activeId}
                onClick={() => router.push(`/messages/${conv.id}`)}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* New DM Modal */}
      <AnimatePresence>
        {showNewDM && (
          <NewDMModal userId={userId} onClose={() => setShowNewDM(false)} />
        )}
      </AnimatePresence>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

/* ─── NewDMModal ─── */
function NewDMModal({ userId, onClose }: { userId: string | null; onClose: () => void }) {
  const router = useRouter();
  const [search, setSearch]   = useState('');
  const [results, setResults] = useState<{ id: string; display_name: string | null; avatar_url: string | null }[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (search.trim().length < 2) { setResults([]); return; }
    const supabase = createClient();
    supabase
      .from('user_profiles')
      .select('id, display_name, avatar_url')
      .ilike('display_name', `%${search}%`)
      .neq('id', userId ?? '')
      .limit(8)
      .then(({ data }) => setResults(data ?? []));
  }, [search, userId]);

  async function startDM(participantId: string) {
    if (!userId || creating) return;
    setCreating(true);
    const res = await fetch('/api/messages/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'direct', participant_ids: [participantId] }),
    });
    const { conversation_id } = await res.json();
    setCreating(false);
    onClose();
    router.push(`/messages/${conversation_id}`);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(5,8,22,0.85)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480,
          background: CARD,
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '20px 20px 0 0',
          padding: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: TXT }}>New Message</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: FAINT, cursor: 'pointer', fontSize: 20 }}>×</button>
        </div>

        <input
          autoFocus
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search people..."
          style={{
            width: '100%', padding: '10px 14px', background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10,
            color: TXT, fontSize: 14, fontFamily: 'inherit', outline: 'none',
            boxSizing: 'border-box',
          }}
        />

        <div style={{ marginTop: 12, maxHeight: 280, overflowY: 'auto' }}>
          {results.map((user) => (
            <button
              key={user.id}
              onClick={() => startDM(user.id)}
              disabled={creating}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 8px', background: 'none', border: 'none',
                borderRadius: 10, cursor: 'pointer', textAlign: 'left',
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'rgba(34,255,170,0.1)',
                border: '1px solid rgba(34,255,170,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', flexShrink: 0,
              }}>
                {user.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatar_url} alt={user.display_name ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: 14, fontWeight: 700, color: ACCENT }}>
                    {(user.display_name ?? 'U').charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 14, color: TXT }}>{user.display_name ?? 'Unknown'}</span>
              {creating && <Check size={14} style={{ color: ACCENT, marginLeft: 'auto' }} />}
            </button>
          ))}
          {search.trim().length >= 2 && results.length === 0 && (
            <p style={{ fontSize: 13, color: FAINT, padding: '12px 8px', margin: 0 }}>No users found</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
