import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, MessageCircle, Send } from 'lucide-react';
import {
  fetchThreadMessages,
  sendMessage,
  type MessageThread,
  type ThreadMessage,
} from '@/lib/supabaseData';
import { formatPrice, timeAgo } from '@/lib/format';

export function MessagesInbox({
  userId,
  threads,
  onSent,
}: {
  userId: string;
  threads: MessageThread[] | null;
  /** Called after a reply sends, so the caller can refresh the thread list's previews. */
  onSent: () => void;
}) {
  const [selected, setSelected] = useState<MessageThread | null>(null);
  const [thread, setThread] = useState<ThreadMessage[] | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selected) return;
    setThread(null);
    fetchThreadMessages(userId, selected.listingId, selected.otherPartyId).then(setThread);
  }, [userId, selected]);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!selected || !reply.trim()) return;
    setError(null);
    setSending(true);
    try {
      await sendMessage(selected.listingId, userId, selected.otherPartyId, reply.trim());
      setReply('');
      const updated = await fetchThreadMessages(userId, selected.listingId, selected.otherPartyId);
      setThread(updated);
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send that message.');
    } finally {
      setSending(false);
    }
  }

  if (threads === null) {
    return <Loader2 className="mx-auto animate-spin text-[var(--color-ink-soft)]" />;
  }

  if (threads.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--color-line)] py-16 text-center text-[var(--color-ink-soft)]">
        No messages yet.
      </div>
    );
  }

  if (selected) {
    return (
      <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)]">
        <div className="flex items-center gap-3 border-b border-[var(--color-line)] p-4">
          <button
            onClick={() => setSelected(null)}
            aria-label="Back to messages"
            className="text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{selected.otherPartyName}</p>
            <Link
              to={`/listing/${selected.listingId}`}
              className="truncate text-xs text-[var(--color-ink-soft)] hover:text-[var(--color-brand)] hover:underline"
            >
              {selected.listingTitle} · {formatPrice(selected.listingPrice, selected.listingCurrency)}
            </Link>
          </div>
        </div>

        <div className="max-h-96 space-y-2 overflow-y-auto p-4">
          {thread === null ? (
            <Loader2 className="mx-auto animate-spin text-[var(--color-ink-soft)]" />
          ) : (
            thread.map((msg) => {
              const fromMe = msg.senderId === userId;
              return (
                <div key={msg.id} className={`flex ${fromMe ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                      fromMe
                        ? 'bg-[var(--color-ink)] text-white'
                        : 'bg-[var(--color-paper)] text-[var(--color-ink)]'
                    }`}
                  >
                    <p>{msg.body || '(no message text)'}</p>
                    <p
                      className={`mt-1 text-[10px] ${
                        fromMe ? 'text-white/60' : 'text-[var(--color-ink-soft)]'
                      }`}
                    >
                      {timeAgo(msg.sentAt.slice(0, 10))}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form onSubmit={handleReply} className="flex items-center gap-2 border-t border-[var(--color-line)] p-3">
          <input
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Write a reply…"
            className="flex-1 rounded-full border border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-2 text-sm outline-none focus:border-[var(--color-ink-soft)]"
          />
          <button
            type="submit"
            disabled={sending || !reply.trim()}
            aria-label="Send reply"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-ink)] text-white hover:bg-black disabled:opacity-60"
          >
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </form>
        {error && <p className="px-4 pb-3 text-xs text-[var(--color-brand-dark)]">{error}</p>}
      </div>
    );
  }

  return (
    <div className="divide-y divide-[var(--color-line)] rounded-2xl border border-[var(--color-line)] bg-[var(--color-paper-raised)]">
      {threads.map((t) => (
        <button
          key={`${t.listingId}:${t.otherPartyId}`}
          onClick={() => setSelected(t)}
          className="flex w-full items-center gap-4 p-4 text-left hover:bg-[var(--color-paper)]"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-soft)] text-[var(--color-brand-dark)]">
            <MessageCircle size={17} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium">{t.otherPartyName}</span>
              <span className="shrink-0 text-xs text-[var(--color-ink-soft)]">
                {timeAgo(t.lastMessageAt.slice(0, 10))}
              </span>
            </div>
            <p className="truncate text-sm text-[var(--color-ink-soft)]">
              {t.lastMessageFromMe && 'You: '}
              {t.lastMessage || '(no message text)'}
            </p>
            <p className="mt-0.5 truncate text-xs text-[var(--color-ink-soft)]/80">
              Re: {t.listingTitle} · {formatPrice(t.listingPrice, t.listingCurrency)}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}
