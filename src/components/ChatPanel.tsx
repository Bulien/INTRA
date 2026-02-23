"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import SearchIcon from "@mui/icons-material/Search";

type Channel =
  | { id: string; type: "game"; gameType: string; label: string; lastMessageAt: string | null; lastMessage: { content: string; sender: { id: string; name: string | null; username: string | null } | null } | null }
  | { id: string; type: "dm"; otherUser: { id: string; name: string | null; username: string | null } | null; lastMessageAt: string | null; lastMessage: { content: string; sender: { id: string; name: string | null; username: string | null } | null } | null; readAt: string | null }
  | { id: string; type: "group"; name: string; lastMessageAt: string | null; lastMessage: { content: string; sender: { id: string; name: string | null; username: string | null } | null } | null; members: { id: string; name: string | null; username: string | null }[]; readAt: string | null };

type Message = {
  id: string;
  content: string;
  createdAt: string;
  sender: { id: string; name: string | null; username: string | null } | null;
};

type User = { id: string; name: string | null; username: string | null };

export function ChatPanel({
  open,
  onClose,
  onReadDm,
}: {
  open: boolean;
  onClose: () => void;
  onReadDm?: (channelId: string) => void;
}) {
  const { data: session, status } = useSession();
  const [channelsData, setChannelsData] = useState<{
    gameChannels: Channel[];
    dmChannels: Channel[];
    groupChannels: Channel[];
  } | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showUserList, setShowUserList] = useState(false);
  const [showGroupFlow, setShowGroupFlow] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userList, setUserList] = useState<User[]>([]);
  const [userListNextCursor, setUserListNextCursor] = useState<string | null>(null);
  const [userListLoading, setUserListLoading] = useState(false);
  const [userListLoadingMore, setUserListLoadingMore] = useState(false);
  const [groupSelectedIds, setGroupSelectedIds] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [leavingGroup, setLeavingGroup] = useState(false);
  const [closingDm, setClosingDm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchChannels = useCallback(async () => {
    const res = await fetch("/api/chat/channels", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setChannelsData({
      gameChannels: data.gameChannels ?? [],
      dmChannels: data.dmChannels ?? [],
      groupChannels: data.groupChannels ?? [],
    });
  }, []);

  const fetchMessages = useCallback(async (channelId: string) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/chat/channels/${channelId}/messages`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages ?? []);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    if (open && status === "authenticated") fetchChannels();
  }, [open, status, fetchChannels]);

  const CHANNELS_POLL_MS = 3_000;
  useEffect(() => {
    if (!open || status !== "authenticated") return;
    const interval = setInterval(fetchChannels, CHANNELS_POLL_MS);
    return () => clearInterval(interval);
  }, [open, status, fetchChannels]);

  const MESSAGE_POLL_MS = 3_000;

  useEffect(() => {
    if (!open || !selectedChannelId) return;
    const tick = () => {
      fetchMessages(selectedChannelId).then(() => {
        fetch(`/api/chat/channels/${selectedChannelId}/read`, { method: "POST" })
          .then((r) => r.ok && (fetchChannels(), onReadDm?.(selectedChannelId)))
          .catch(() => {});
      });
    };
    tick();
    const interval = setInterval(tick, MESSAGE_POLL_MS);
    return () => clearInterval(interval);
  }, [open, selectedChannelId, fetchMessages, fetchChannels, onReadDm]);

  const lastReadChannelRef = useRef<string | null>(null);
  // Mark DM/group as read once when user opens the channel (not on every channelsData update)
  useEffect(() => {
    if (!open || !selectedChannelId) return;
    if (lastReadChannelRef.current === selectedChannelId) return;
    const isDmOrGroup =
      channelsData?.dmChannels?.some((c) => c.id === selectedChannelId) ||
      channelsData?.groupChannels?.some((c) => c.id === selectedChannelId);
    if (isDmOrGroup) {
      lastReadChannelRef.current = selectedChannelId;
      fetch(`/api/chat/channels/${selectedChannelId}/read`, { method: "POST" })
        .then((r) => r.ok && fetchChannels())
        .catch(() => {});
      onReadDm?.(selectedChannelId);
    }
  }, [open, selectedChannelId, channelsData?.dmChannels, channelsData?.groupChannels, fetchChannels, onReadDm]);
  useEffect(() => {
    if (!selectedChannelId) lastReadChannelRef.current = null;
  }, [selectedChannelId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchUsers = useCallback(async (cursor: string | null, append: boolean, search?: string) => {
    setUserListLoading(!append);
    setUserListLoadingMore(append);
    try {
      const params = new URLSearchParams();
      params.set("limit", "14");
      if (cursor) params.set("cursor", cursor);
      if (search !== undefined && search !== "") params.set("q", search);
      const res = await fetch(`/api/chat/users?${params}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      const list = data.users ?? [];
      setUserList((prev) => (append ? [...prev, ...list] : list));
      setUserListNextCursor(data.nextCursor ?? null);
    } finally {
      setUserListLoading(false);
      setUserListLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (open && (showUserList || showGroupFlow)) {
      setUserList([]);
      setUserListNextCursor(null);
      fetchUsers(null, false, userSearch.trim() || undefined);
    }
  }, [open, showUserList, showGroupFlow, fetchUsers]);

  const searchDebounceRef = useRef(false);
  useEffect(() => {
    if (!open || (!showUserList && !showGroupFlow)) return;
    if (!searchDebounceRef.current) {
      searchDebounceRef.current = true;
      return;
    }
    const t = setTimeout(() => {
      setUserList([]);
      setUserListNextCursor(null);
      fetchUsers(null, false, userSearch.trim() || undefined);
    }, 400);
    return () => clearTimeout(t);
  }, [userSearch, open, showUserList, showGroupFlow, fetchUsers]);
  useEffect(() => {
    if (!open || (!showUserList && !showGroupFlow)) searchDebounceRef.current = false;
  }, [open, showUserList, showGroupFlow]);

  const loadMoreUsers = useCallback(() => {
    if (userListNextCursor && !userListLoadingMore) fetchUsers(userListNextCursor, true, userSearch.trim() || undefined);
  }, [userListNextCursor, userListLoadingMore, userSearch, fetchUsers]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !selectedChannelId || sending) return;
    setSending(true);
    setInput("");
    try {
      const res = await fetch(`/api/chat/channels/${selectedChannelId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      if (res.ok) {
        const msg = await res.json();
        setMessages((prev) => [...prev, msg]);
        fetchChannels();
      }
    } finally {
      setSending(false);
    }
  };

  const startDm = async (otherUserId: string) => {
    const res = await fetch("/api/chat/dm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ otherUserId }),
    });
    if (!res.ok) return;
    const data = await res.json();
    setSelectedChannelId(data.channelId);
    setShowUserList(false);
    setUserSearch("");
    fetchChannels();
  };

  const createGroup = async () => {
    const userIds = [...groupSelectedIds];
    if (userIds.length === 0) return;
    setCreatingGroup(true);
    try {
      const res = await fetch("/api/chat/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupName.trim() || "Group", userIds }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setSelectedChannelId(data.channelId);
      setShowGroupFlow(false);
      setGroupSelectedIds(new Set());
      setGroupName("");
      setUserSearch("");
      fetchChannels();
    } finally {
      setCreatingGroup(false);
    }
  };

  const toggleGroupUser = (userId: string) => {
    setGroupSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const displayName = (u: { name: string | null; username: string | null } | null) =>
    u?.name?.trim() || u?.username?.trim() || "—";

  const hasUnread = (ch: Channel) => {
    if (!session?.user?.id) return false;
    if (ch.type === "game") return false;
    if (!ch.lastMessage?.sender?.id || ch.lastMessage.sender.id === session.user.id) return false;
    const readAt = "readAt" in ch ? ch.readAt : null;
    if (readAt == null) return true;
    const lastAt = ch.lastMessageAt;
    if (!lastAt) return false;
    return new Date(lastAt) > new Date(readAt);
  };

  const leaveGroup = async () => {
    if (!selectedChannelId || leavingGroup) return;
    setLeavingGroup(true);
    try {
      const res = await fetch(`/api/chat/channels/${selectedChannelId}/leave`, { method: "POST" });
      if (!res.ok) return;
      setSelectedChannelId(null);
      fetchChannels();
    } finally {
      setLeavingGroup(false);
    }
  };

  const closeDm = async () => {
    if (!selectedChannelId || closingDm) return;
    setClosingDm(true);
    try {
      const res = await fetch("/api/chat/dm/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: selectedChannelId }),
      });
      if (!res.ok) return;
      setSelectedChannelId(null);
      fetchChannels();
    } finally {
      setClosingDm(false);
    }
  };

  if (!open) return null;
  if (status !== "authenticated" || !session?.user) return null;

  const allChannels: Channel[] = [
    ...(channelsData?.gameChannels ?? []),
    ...(channelsData?.dmChannels ?? []),
    ...(channelsData?.groupChannels ?? []),
  ];
  const selectedChannel = allChannels.find((c) => c.id === selectedChannelId);
  const selectedLabel =
    selectedChannel?.type === "game"
      ? selectedChannel.label
      : selectedChannel?.type === "dm"
        ? displayName(selectedChannel.otherUser)
        : selectedChannel?.type === "group"
          ? selectedChannel.name
          : "Chat";

  const headerTitle = showUserList ? "New DM" : showGroupFlow ? "New group" : selectedChannelId ? selectedLabel : "Channels";

  const panelHeight = "min(640px, 70vh)";

  return (
    <div
      className="fixed bottom-14 right-4 z-[100] w-[520px] max-w-[calc(100vw-2rem)] flex flex-col rounded-t-xl border border-cyan-500/30 bg-black/95 shadow-xl backdrop-blur-sm"
      style={{ height: panelHeight, minHeight: panelHeight }}
    >
      <div className="border-b border-white/10 flex-shrink-0">
        <div className="flex items-center justify-between px-3 py-2">
          <button
            type="button"
            onClick={onClose}
            className="font-semibold text-cyan-200 text-left min-w-0 truncate flex-1"
            title="Close chat"
          >
            {headerTitle}
          </button>
          <div className="flex items-center gap-1">
            {selectedChannel?.type === "group" && (
              <button
                type="button"
                onClick={() => leaveGroup()}
                disabled={leavingGroup}
                className="px-2 py-1 text-xs rounded text-amber-200/90 hover:bg-amber-500/20 disabled:opacity-50"
              >
                {leavingGroup ? "Leaving…" : "Leave group"}
              </button>
            )}
            {selectedChannel?.type === "dm" && (
              <button
                type="button"
                onClick={() => { setClosingDm(true); closeDm(); }}
                disabled={closingDm}
                className="px-2 py-1 text-xs rounded text-neutral-300 hover:bg-white/10 disabled:opacity-50"
              >
                {closingDm ? "Closing…" : "Close DM"}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded text-neutral-400 hover:text-white hover:bg-white/10"
              aria-label="Close chat"
            >
              <CloseIcon sx={{ fontSize: 20 }} />
            </button>
          </div>
        </div>
        {selectedChannel?.type === "group" && selectedChannel.members?.length > 0 && (
          <div className="px-3 pb-2 pt-0">
            <p className="text-xs text-neutral-400 mb-1">Members</p>
            <div className="flex flex-wrap gap-1.5">
              {selectedChannel.members.map((m) => (
                <span
                  key={m.id}
                  className="px-2 py-0.5 rounded bg-white/5 text-neutral-300 text-xs"
                >
                  {displayName(m)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Channel list */}
        <div
          className={`w-44 border-r border-white/10 flex-shrink-0 flex flex-col ${selectedChannelId && !showUserList && !showGroupFlow ? "hidden sm:flex" : ""}`}
        >
          <div className="p-1 overflow-auto flex-1">
            {(channelsData?.gameChannels ?? []).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { setSelectedChannelId(c.id); setShowUserList(false); setShowGroupFlow(false); }}
                className={`w-full text-left px-2 py-1.5 rounded text-sm truncate ${selectedChannelId === c.id ? "bg-cyan-500/20 text-cyan-200" : "text-neutral-300 hover:bg-white/5"}`}
              >
                {c.label}
              </button>
            ))}
            {(channelsData?.dmChannels ?? []).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { setSelectedChannelId(c.id); setShowUserList(false); setShowGroupFlow(false); c.type === "dm" && onReadDm?.(c.id); }}
                className={`w-full text-left px-2 py-1.5 rounded text-sm truncate flex items-center gap-1.5 ${selectedChannelId === c.id ? "bg-cyan-500/20 text-cyan-200" : "text-neutral-300 hover:bg-white/5"}`}
              >
                {hasUnread(c) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 shadow-[0_0_6px_rgba(251,191,36,0.8)]" aria-hidden />
                )}
                <span className="min-w-0 truncate">DM: {displayName(c.otherUser)}</span>
              </button>
            ))}
            {(channelsData?.groupChannels ?? []).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { setSelectedChannelId(c.id); setShowUserList(false); setShowGroupFlow(false); }}
                className={`w-full text-left px-2 py-1.5 rounded text-sm truncate flex items-center gap-1.5 ${selectedChannelId === c.id ? "bg-cyan-500/20 text-cyan-200" : "text-neutral-300 hover:bg-white/5"}`}
              >
                {hasUnread(c) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 shadow-[0_0_6px_rgba(251,191,36,0.8)]" aria-hidden />
                )}
                <span className="min-w-0 truncate">{c.name}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-1 p-1 border-t border-white/10">
            <button
              type="button"
              onClick={() => { setShowUserList(true); setShowGroupFlow(false); setUserSearch(""); }}
              className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-cyan-300 hover:bg-cyan-500/10 rounded"
            >
              <PersonAddIcon sx={{ fontSize: 18 }} />
              New DM
            </button>
            <button
              type="button"
              onClick={() => { setShowGroupFlow(true); setShowUserList(false); setUserSearch(""); setGroupSelectedIds(new Set()); setGroupName(""); }}
              className="flex items-center gap-1.5 px-2 py-1.5 text-sm text-cyan-300 hover:bg-cyan-500/10 rounded"
            >
              <GroupAddIcon sx={{ fontSize: 18 }} />
              New group
            </button>
          </div>
        </div>

        {/* User list for New DM or New group — with search */}
        {(showUserList || showGroupFlow) && (
          <div className="flex-1 flex flex-col min-w-0">
            <div className="p-2 border-b border-white/10 flex-shrink-0">
              <div className="relative">
                <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" sx={{ fontSize: 18 }} />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search players…"
                  className="w-full pl-8 pr-3 py-2 rounded-lg bg-white/5 border border-cyan-500/30 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
                />
              </div>
              {showGroupFlow && (
                <div className="mt-2 flex flex-wrap gap-2 items-center">
                  <input
                    type="text"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Group name (optional)"
                    className="flex-1 min-w-[120px] px-2 py-1.5 rounded bg-white/5 border border-cyan-500/30 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
                  />
                  <span className="text-xs text-neutral-400">{groupSelectedIds.size} selected</span>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-auto p-1 min-h-0">
              {userListLoading && userList.length === 0 ? (
                <p className="text-sm text-neutral-500 p-2">Loading…</p>
              ) : userList.length === 0 ? (
                <p className="text-sm text-neutral-500 p-2">No players match</p>
              ) : showUserList ? (
                <>
                  {userList.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => startDm(u.id)}
                      className="w-full text-left px-2 py-2 rounded text-sm text-neutral-200 hover:bg-white/10 flex items-center gap-2"
                    >
                      {displayName(u)}
                    </button>
                  ))}
                  {userListNextCursor && (
                    <div className="p-2">
                      <button
                        type="button"
                        onClick={loadMoreUsers}
                        disabled={userListLoadingMore}
                        className="w-full py-2 rounded-lg text-sm text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50"
                      >
                        {userListLoadingMore ? "Loading…" : "Load more"}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {userList.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => toggleGroupUser(u.id)}
                      className={`w-full text-left px-2 py-2 rounded text-sm flex items-center gap-2 ${
                        groupSelectedIds.has(u.id) ? "bg-cyan-500/20 text-cyan-200" : "text-neutral-200 hover:bg-white/10"
                      }`}
                    >
                      <span className={`w-4 h-4 rounded border flex-shrink-0 ${groupSelectedIds.has(u.id) ? "bg-cyan-500 border-cyan-400" : "border-neutral-500"}`} />
                      {displayName(u)}
                    </button>
                  ))}
                  {userListNextCursor && (
                    <div className="p-2">
                      <button
                        type="button"
                        onClick={loadMoreUsers}
                        disabled={userListLoadingMore}
                        className="w-full py-2 rounded-lg text-sm text-cyan-300 hover:bg-cyan-500/10 disabled:opacity-50"
                      >
                        {userListLoadingMore ? "Loading…" : "Load more"}
                      </button>
                    </div>
                  )}
                  <div className="p-2">
                    <button
                      type="button"
                      onClick={createGroup}
                      disabled={groupSelectedIds.size === 0 || creatingGroup}
                      className="w-full py-2 rounded-lg text-sm font-medium bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {creatingGroup ? "Creating…" : "Create group"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Messages + input */}
        {selectedChannelId && !showUserList && !showGroupFlow && (
          <div className="flex-1 flex flex-col min-w-0">
            <div
              ref={scrollRef}
              className="flex-1 overflow-auto p-2 space-y-2 min-h-0"
            >
              {loadingMessages && messages.length === 0 ? (
                <p className="text-sm text-neutral-500">Loading…</p>
              ) : (
                messages.map((m) => {
                  const d = new Date(m.createdAt);
                  const time = `[${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}]`;
                  return (
                    <div key={m.id} className="text-sm">
                      <span className="text-neutral-500">{time}</span>{" "}
                      <span
                        className={`font-medium ${m.sender?.id === session.user?.id ? "text-green-400" : "text-cyan-300"}`}
                      >
                        {displayName(m.sender)}:
                      </span>{" "}
                      <span className="text-neutral-200 break-words">{m.content}</span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
            <form
              className="flex gap-1 p-2 border-t border-white/10"
              onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Message…"
                className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-white/5 border border-cyan-500/30 text-sm text-white placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-cyan-400/50"
                maxLength={50}
              />
              <button
                type="submit"
                disabled={!input.trim() || sending}
                className="p-2 rounded-lg bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30 disabled:opacity-50 disabled:pointer-events-none"
                aria-label="Send"
              >
                <SendIcon sx={{ fontSize: 20 }} />
              </button>
            </form>
          </div>
        )}

        {!selectedChannelId && !showUserList && !showGroupFlow && (
          <div className="flex-1 flex items-center justify-center p-4 text-neutral-500 text-sm">
            Select a channel, start a DM, or create a group
          </div>
        )}
      </div>
    </div>
  );
}
