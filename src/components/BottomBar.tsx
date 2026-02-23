"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import ChatIcon from "@mui/icons-material/Chat";
import { ChatPanel } from "@/components/ChatPanel";

export function BottomBar() {
  const { data: session, status } = useSession();
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadDmCount, setUnreadDmCount] = useState(0);

  const isUnread = useCallback(
    (ch: {
      lastMessage?: { sender?: { id: string } | null } | null;
      lastMessageAt?: string | null;
      readAt?: string | null;
    }) => {
      if (!ch.lastMessage?.sender?.id || ch.lastMessage.sender.id === session?.user?.id) return false;
      const readAt = ch.readAt;
      if (readAt == null) return true;
      const lastAt = ch.lastMessageAt;
      if (!lastAt) return false;
      return new Date(lastAt) > new Date(readAt);
    },
    [session?.user?.id]
  );

  const fetchUnread = useCallback(async () => {
    if (status !== "authenticated" || !session?.user?.id) return;
    const res = await fetch("/api/chat/channels", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    const dmChannels = data.dmChannels ?? [];
    const groupChannels = data.groupChannels ?? [];
    const dmCount = dmChannels.filter((dm: Parameters<typeof isUnread>[0]) => isUnread(dm)).length;
    const groupCount = groupChannels.filter((g: Parameters<typeof isUnread>[0]) => isUnread(g)).length;
    setUnreadDmCount(dmCount + groupCount);
  }, [status, session?.user?.id, isUnread]);

  const UNREAD_POLL_MS = 3_000;

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return;
    fetchUnread();
    const interval = setInterval(fetchUnread, UNREAD_POLL_MS);
    return () => clearInterval(interval);
  }, [status, session?.user, fetchUnread]);

  const onReadDm = useCallback(
    (_channelId: string) => {
      fetchUnread();
    },
    [fetchUnread]
  );

  if (status !== "authenticated" || !session?.user) return null;

  const hasUnread = unreadDmCount > 0;
  const badgeLabel = unreadDmCount > 99 ? "99+" : unreadDmCount;

  return (
    <>
      <footer
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-end px-4 py-2 pointer-events-none"
        aria-hidden
      >
        <div className="pointer-events-auto flex items-center gap-2 relative">
          <button
            type="button"
            onClick={() => setChatOpen((o) => !o)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-black/30 hover:bg-black/50 border backdrop-blur-sm transition-colors ${
              hasUnread
                ? "text-amber-300/95 border-amber-400/50 shadow-[0_0_18px_rgba(251,191,36,0.5)]"
                : "text-cyan-200/90 border-cyan-500/30"
            }`}
            aria-label={chatOpen ? "Close chat" : "Open chat"}
          >
            <ChatIcon sx={{ fontSize: 20 }} />
            Chat
            {hasUnread && (
              <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold text-black bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.8)]">
                {badgeLabel}
              </span>
            )}
          </button>
        </div>
      </footer>
      <ChatPanel
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        onReadDm={onReadDm}
      />
    </>
  );
}
