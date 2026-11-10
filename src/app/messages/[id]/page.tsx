'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, Send, Users, Target, Building2,
  MessageSquare, MoreVertical, Loader2, AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useMessages } from '@/hooks/useMessages';
import type { ConversationWithDetails } from '@/lib/supabase/types';

/* ─── design tokens ─── */
const BG     = '#050816';
const CARD   = '#0A1226';
const ACCENT = '#22FFAA';
const AI_CLR = '#6D5DFD';
const DIM    = '#8B9CC0';
const FAINT  = '#4A5578';
const TXT    = '#F0F4FF';

/* ─── helpers ─── */
function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function convDisplayName(conv: ConversationWithDetails, userId: string): string {
  if (conv.name) return conv.name;
  if (conv.type === 'direct') {
    const other = conv.members.find((m) => m.user_id !== userId);
    return other?.profile?.display_name ?? 'Direct Message';
  }
  return 'Mission Chat';
}

const TYPE_ICON: Record<string, React.ElementType> = {
  direct:       MessageSquare,
  mission:      Target,
  team:         Users,
  organization: Building2,
  community:    Users,
};

const TYPE_COLOR: Record<string, string> = {
  direct:       ACCENT,
  mission:      '#FFB84D',
  team:         AI_CLR,
  organization: '#60A5FA',
  community:    '#FF9DB2',
};

/* ─── MessageBubble ─── */
function MessageBubble({
  content, senderName, senderAvatar, senderId, isOwn, timestamp, showSender,
}: {
  content: string | null;
  senderName: string | null;
  senderAvatar: string | null;
  senderId: string;
  isOwn: boolean;
  timestamp: string;
  showSender: boolean;
}) {
  if (!content) return null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: isOwn ? 'row-reverse' : 'row',
      alignItems: 'flex-end',
      gap: 8,
      marginBottom: showSender ? 12 : 3,
    }}>
      {/* Avatar (only for others, only when sender changes) */}
      {!isOwn && (
        <div style={{
          width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
          background: senderAvatar ? 'transparent' : 'rgba(109,93,253,0.2)',
          border: '1px solid rgba(109,93,253,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
          visibility: showSender ? 'visible' : 'hidden',
        }}>
          {senderAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={senderAvatar} alt={senderName ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 10, fontWeight: 700, color: AI_CLR }}>
              {(senderName ?? '?').charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      )}

      <div style={{ maxWidth: '72%', display: 'flex', flexDirection: 'column', alignItems: isOwn ? 'flex-end' : 'flex-start' }}>
        {/* Sender name */}
        {!isOwn && showSender && senderName && (
          <span style={{ fontSize: 11, fontWeight: 600, color: DIM, marginBottom: 3, paddingLeft: 12 }}>
            {senderName}
          </span>
        )}

        {/* Bubble */}
        <div style={{
          padding: '9px 13px',
          borderRadius: isOwn ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
          background: isOwn
            ? 'linear-gradient(135deg, rgba(34,255,170,0.25) 0%, rgba(34,255,170,0.15) 100%)'
            : 'rgba(255,255,255,0.06)',
          border: isOwn
            ? '1px solid rgba(34,255,170,0.25)'
            : '1px solid rgba(255,255,255,0.08)',
          boxShadow: isOwn
            ? '0 2px 12px rgba(34,255,170,0.08)'
            : '0 2px 8px rgba(0,0,0,0.2)',
        }}>
          <p style={{ margin: 0, fontSize: 14, color: isOwn ? '#D0FFE8' : TXT, lineHeight: 1.5, wordBreak: 'break-word' }}>
            {content}
          </p>
        </div>

        {/* Timestamp */}
        <span style={{ fontSize: 10, color: FAINT, marginTop: 3, paddingLeft: isOwn ? 0 : 12 }}>
          {formatTime(timestamp)}
        </span>
      </div>
    </div>
  );
}

/* ─── DateDivider ─── */
function DateDivider({ date }: { date: string }) {
  const d = new Date(date);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const label = isToday ? 'Today' : d.toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0 8px' }}>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
      <span style={{ fontSize: 11, color: FAINT, fontWeight: 500, whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
    </div>
  );
}

/* ─── ChatPage ─── */
export default function ChatPage() {
  const { id: conversationId } = useParams<{ id: string }>();
  const router = useRouter();

  const [userId,   setUserId]   = useState<string | null>(null);
  const [conv,     setConv]     = useState<ConversationWithDetails | null>(null);
  const [convErr,  setConvErr]  = useState('');
  const [content,  setContent]  = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  const { messages, loading, sending, sendMessage } = useMessages(conversationId, userId);

  // Auth
  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace(`/sign-in?redirect_url=${encodeURIComponent(`/messages/${conversationId}`)}`); return; }
      setUserId(data.user.id);
    });
  }, [conversationId, router]);

  // Load conversation details
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    supabase
      .from('conversations')
      .select(`
        *,
        members:conversation_members!conversation_id(
          user_id, role, last_read_at,
          profile:user_profiles!user_id(display_name, avatar_url)
        )
      `)
      .eq('id', conversationId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { setConvErr('Conversation not found.'); return; }
        setConv({ ...(data as ConversationWithDetails), last_message: null, unread_count: 0 });
      });
  }, [conversationId, userId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    if (!content.trim() || sending) return;
    const text = content;
    setContent('');
    await sendMessage(text);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const convName  = conv ? convDisplayName(conv, userId ?? '') : '...';
  const TypeIcon  = conv ? (TYPE_ICON[conv.type] ?? MessageSquare) : MessageSquare;
  const typeColor = conv ? (TYPE_COLOR[conv.type] ?? ACCENT) : ACCENT;
  const memberCount = conv?.members.length ?? 0;

  // Group messages by date for dividers
  const grouped: { date: string; messages: typeof messages }[] = [];
  messages.forEach((msg) => {
    const day = new Date(msg.created_at).toDateString();
    const last = grouped[grouped.length - 1];
    if (!last || last.date !== day) {
      grouped.push({ date: day, messages: [msg] });
    } else {
      last.messages.push(msg);
    }
  });

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: BG, position: 'relative',
    }}>
      {/* ─── Header ─── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 16px',
        background: 'rgba(5,8,22,0.96)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        flexShrink: 0, zIndex: 10,
      }}>
        {/* Back (mobile) */}
        <button
          onClick={() => router.push('/messages')}
          className="md:hidden"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', padding: 4,
          }}
        >
          <ChevronLeft size={22} style={{ color: TXT }} />
        </button>

        {/* Avatar / icon */}
        <div style={{
          width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
          background: `${typeColor}15`,
          border: `1px solid ${typeColor}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }}>
          {conv?.type === 'direct' && conv.members.find((m) => m.user_id !== userId)?.profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={conv.members.find((m) => m.user_id !== userId)!.profile!.avatar_url!}
              alt={convName}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <TypeIcon size={17} style={{ color: typeColor }} />
          )}
        </div>

        {/* Name + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: TXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {convName}
          </div>
          <div style={{ fontSize: 11.5, color: FAINT, display: 'flex', alignItems: 'center', gap: 4 }}>
            {conv?.type !== 'direct' && (
              <>
                <Users size={10} />
                <span>{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
                <span>·</span>
              </>
            )}
            <span style={{ textTransform: 'capitalize', color: `${typeColor}99` }}>{conv?.type}</span>
            {conv?.mission_id && (
              <>
                <span>·</span>
                <Link href={`/missions/${conv.mission_id}`} style={{ color: '#FFB84D', textDecoration: 'none', fontSize: 11 }}>
                  View Mission
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <button style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', padding: 6, borderRadius: 8,
        }}>
          <MoreVertical size={18} style={{ color: FAINT }} />
        </button>
      </div>

      {/* ─── Messages ─── */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '12px 16px',
        display: 'flex', flexDirection: 'column',
        scrollbarWidth: 'none',
      }}>
        {/* Error state */}
        {convErr && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
            background: 'rgba(255,92,122,0.08)', border: '1px solid rgba(255,92,122,0.2)',
            borderRadius: 10, marginBottom: 12,
          }}>
            <AlertCircle size={16} style={{ color: '#FF5C7A' }} />
            <span style={{ fontSize: 13, color: '#FF5C7A' }}>{convErr}</span>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
            <Loader2 size={20} style={{ color: FAINT, animation: 'spin 0.8s linear infinite' }} />
          </div>
        )}

        {/* Empty state */}
        {!loading && messages.length === 0 && !convErr && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: `${typeColor}10`,
              border: `1px solid ${typeColor}20`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <TypeIcon size={24} style={{ color: typeColor }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: TXT, margin: '0 0 4px' }}>{convName}</p>
              <p style={{ fontSize: 13, color: FAINT, margin: 0 }}>
                {conv?.type === 'direct'
                  ? 'Send a message to start the conversation.'
                  : 'Be the first to say something in this mission chat.'}
              </p>
            </div>
          </div>
        )}

        {/* Messages grouped by date */}
        {grouped.map(({ date, messages: dayMsgs }) => (
          <div key={date}>
            <DateDivider date={dayMsgs[0].created_at} />
            {dayMsgs.map((msg, i) => {
              const prev = i > 0 ? dayMsgs[i - 1] : null;
              const showSender = !prev || prev.sender_id !== msg.sender_id;
              return (
                <MessageBubble
                  key={msg.id}
                  content={msg.content}
                  senderName={msg.sender?.display_name ?? null}
                  senderAvatar={msg.sender?.avatar_url ?? null}
                  senderId={msg.sender_id}
                  isOwn={msg.sender_id === userId}
                  timestamp={msg.created_at}
                  showSender={showSender}
                />
              );
            })}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* ─── Composer ─── */}
      <div style={{
        padding: '10px 12px',
        background: 'rgba(5,8,22,0.95)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        flexShrink: 0,
        paddingBottom: 'calc(10px + env(safe-area-inset-bottom, 0px))',
      }}>
        <form
          onSubmit={handleSend}
          style={{
            display: 'flex', alignItems: 'flex-end', gap: 10,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 18, padding: '8px 8px 8px 14px',
            transition: 'border-color .15s',
          }}
        >
          <textarea
            ref={inputRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: TXT, fontSize: 14, fontFamily: 'inherit', resize: 'none',
              lineHeight: 1.5, maxHeight: 120, overflowY: 'auto', paddingTop: 2,
            }}
          />
          <motion.button
            type="submit"
            whileTap={{ scale: 0.9 }}
            disabled={!content.trim() || sending}
            style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
              background: content.trim() ? ACCENT : 'rgba(255,255,255,0.06)',
              border: 'none', cursor: content.trim() ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all .15s',
            }}
          >
            {sending
              ? <Loader2 size={16} style={{ color: BG, animation: 'spin 0.8s linear infinite' }} />
              : <Send size={15} style={{ color: content.trim() ? BG : FAINT }} />
            }
          </motion.button>
        </form>
        <p style={{ fontSize: 11, color: FAINT, margin: '4px 0 0 14px' }}>
          Enter to send · Shift+Enter for new line
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
