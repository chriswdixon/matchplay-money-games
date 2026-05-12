import { useEffect, useMemo, useRef, useState } from "react";
import { Send, Trash2, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

interface Props {
  matchId: string;
  /** Optional cap on rendered height. Defaults to a comfortable inline panel. */
  className?: string;
}

interface Msg {
  id: string;
  match_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

const MAX_LEN = 1000;

const MatchChat = ({ matchId, className }: Props) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[] | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Initial load + realtime
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from("match_chat_messages")
        .select("id, match_id, sender_id, body, created_at")
        .eq("match_id", matchId)
        .order("created_at", { ascending: true })
        .limit(500);

      if (cancelled) return;
      if (error) {
        setError("Couldn't load chat");
        return;
      }
      setMessages(data ?? []);
    };

    load();

    const channel = supabase
      .channel(`match-chat-${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_chat_messages",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          setMessages((prev) => {
            const list = prev ?? [];
            if (payload.eventType === "INSERT") {
              const m = payload.new as Msg;
              if (list.some((x) => x.id === m.id)) return list;
              return [...list, m];
            }
            if (payload.eventType === "DELETE") {
              const m = payload.old as Msg;
              return list.filter((x) => x.id !== m.id);
            }
            if (payload.eventType === "UPDATE") {
              const m = payload.new as Msg;
              return list.map((x) => (x.id === m.id ? m : x));
            }
            return list;
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [matchId]);

  // Resolve display names for any senders we don't know yet
  useEffect(() => {
    if (!messages) return;
    const missing = Array.from(
      new Set(messages.map((m) => m.sender_id).filter((id) => !names[id])),
    );
    if (missing.length === 0) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", missing);
      if (!data) return;
      setNames((prev) => {
        const next = { ...prev };
        data.forEach((p: any) => {
          next[p.user_id] = p.display_name || "Player";
        });
        return next;
      });
    })();
  }, [messages, names]);

  // Auto-scroll on new messages
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async () => {
    const body = draft.trim();
    if (!body || !user || sending) return;
    if (body.length > MAX_LEN) {
      toast.error(`Message too long (max ${MAX_LEN} characters)`);
      return;
    }
    setSending(true);
    const { error } = await supabase.from("match_chat_messages").insert({
      match_id: matchId,
      sender_id: user.id,
      body,
    });
    setSending(false);
    if (error) {
      toast.error("Couldn't send message");
      return;
    }
    setDraft("");
  };

  const remove = async (id: string) => {
    const { error } = await supabase
      .from("match_chat_messages")
      .delete()
      .eq("id", id);
    if (error) toast.error("Couldn't delete message");
  };

  const grouped = useMemo(() => {
    if (!messages) return [];
    // Group consecutive messages from the same sender within 5 min
    const out: { sender_id: string; items: Msg[] }[] = [];
    messages.forEach((m) => {
      const last = out[out.length - 1];
      const lastItem = last?.items[last.items.length - 1];
      const sameSender = last && last.sender_id === m.sender_id;
      const close =
        lastItem &&
        new Date(m.created_at).getTime() -
          new Date(lastItem.created_at).getTime() <
          5 * 60 * 1000;
      if (sameSender && close) {
        last!.items.push(m);
      } else {
        out.push({ sender_id: m.sender_id, items: [m] });
      }
    });
    return out;
  }, [messages]);

  return (
    <section
      aria-label="Match chat"
      className={`flex flex-col rounded-2xl border border-border bg-card text-card-foreground shadow-card ${className ?? ""}`}
    >
      <header className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <MessageSquare className="w-4 h-4 text-primary" aria-hidden="true" />
        <h2 className="text-sm font-semibold">Match chat</h2>
      </header>

      <div
        ref={scrollerRef}
        className="flex-1 min-h-[240px] max-h-[60vh] overflow-y-auto px-4 py-3 space-y-3"
      >
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : !messages ? (
          <>
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-10 w-2/3 ml-auto" />
            <Skeleton className="h-12 w-3/5" />
          </>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No messages yet. Say hi to your group 👋
          </p>
        ) : (
          grouped.map((group, gi) => {
            const isMe = group.sender_id === user?.id;
            const name = isMe
              ? "You"
              : names[group.sender_id] || "Player";
            return (
              <div
                key={gi}
                className={`flex flex-col gap-1 ${isMe ? "items-end" : "items-start"}`}
              >
                <span className="text-[11px] text-muted-foreground px-1">
                  {name}
                </span>
                {group.items.map((m) => (
                  <div
                    key={m.id}
                    className={`group relative max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                      isMe
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    }`}
                  >
                    {m.body}
                    <span
                      className={`block text-[10px] mt-1 ${
                        isMe
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground"
                      }`}
                    >
                      {formatDistanceToNow(new Date(m.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                    {isMe && (
                      <button
                        type="button"
                        onClick={() => remove(m.id)}
                        aria-label="Delete message"
                        className="absolute -top-2 -left-2 hidden group-hover:inline-flex h-6 w-6 items-center justify-center rounded-full bg-background border border-border text-muted-foreground hover:text-destructive focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="border-t border-border p-3 flex items-end gap-2"
      >
        <label htmlFor={`chat-input-${matchId}`} className="sr-only">
          Message
        </label>
        <Textarea
          id={`chat-input-${matchId}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_LEN))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={user ? "Message your group…" : "Sign in to chat"}
          disabled={!user || sending}
          rows={1}
          className="min-h-[40px] max-h-32 resize-none"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!user || sending || draft.trim().length === 0}
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </section>
  );
};

export default MatchChat;
