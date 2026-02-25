"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import SearchIcon from "@mui/icons-material/Search";
import PersonIcon from "@mui/icons-material/Person";
import CloseIcon from "@mui/icons-material/Close";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";

type SearchUser = { id: string; username: string; name: string };

function capitalizeFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/team-builder", label: "Team Builder" },
  { href: "/ranking", label: "Ranking" },
];

const QUEUE_GAMES = [
  { id: "lol", label: "League of Legends" },
  { id: "ow", label: "Overwatch" },
  { id: "sc", label: "Survival Chaos" },
  { id: "battlerite", label: "Battlerite" },
] as const;

type QueueData = {
  myEntry: { gameType: string; joinedAt: string; label: string } | null;
  playersByGame: Record<string, { id: string; name: string | null; username: string | null; gameType: string; joinedAt: string }[]>;
  gameLabels: Record<string, string>;
};

type MatchedGame = {
  id: string;
  gameType: string;
  season: number;
  teamA: { id: string; name: string; rating: number }[];
  teamB: { id: string; name: string; rating: number }[];
  status: string;
  createdAt: string;
};

type OnlineUser = { id: string; name: string | null; username: string | null };

function isAdmin(session: { user?: { role?: string } | null } | null): boolean {
  return (session?.user as { role?: string } | undefined)?.role === "admin";
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [completionIndex, setCompletionIndex] = useState(0);
  const [activeGamesCount, setActiveGamesCount] = useState(0);
  const [playModalOpen, setPlayModalOpen] = useState(false);
  const [queueData, setQueueData] = useState<QueueData | null>(null);
  const [queueTimerSeconds, setQueueTimerSeconds] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [onlineHovering, setOnlineHovering] = useState(false);
  const [onlinePinned, setOnlinePinned] = useState(false);
  const [queueHovering, setQueueHovering] = useState(false);
  const [queuePinned, setQueuePinned] = useState(false);
  const [matchedGameFromQueue, setMatchedGameFromQueue] = useState<MatchedGame | null>(null);
  const [ongoingQueueMatchId, setOngoingQueueMatchId] = useState<string | null>(null);
  const onlineMenuOpen = onlineHovering || onlinePinned;
  const queueMenuOpen = queueHovering || queuePinned;
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const queueMenuRef = useRef<HTMLDivElement>(null);
  const onlineMenuRef = useRef<HTMLDivElement>(null);
  const onlineCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearOnlineCloseTimeout = () => {
    if (onlineCloseTimeoutRef.current != null) {
      clearTimeout(onlineCloseTimeoutRef.current);
      onlineCloseTimeoutRef.current = null;
    }
  };
  const clearQueueCloseTimeout = () => {
    if (queueCloseTimeoutRef.current != null) {
      clearTimeout(queueCloseTimeoutRef.current);
      queueCloseTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) {
      setActiveGamesCount(0);
      setOngoingQueueMatchId(null);
      return;
    }
    const fetchPending = () => {
      fetch("/api/team-builder/games?status=pending", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : { games: [] }))
        .then((data) => {
          const games = data.games ?? [];
          const teamBuilderGames = games.filter((g: { source?: string }) => g.source !== "ranked_queue");
          setActiveGamesCount(teamBuilderGames.length);
          const queueGame = games.find((g: { source?: string }) => g.source === "ranked_queue");
          setOngoingQueueMatchId(queueGame?.id ?? null);
        })
        .catch(() => {
          setActiveGamesCount(0);
          setOngoingQueueMatchId(null);
        });
    };
    fetchPending();
    const interval = setInterval(fetchPending, 15000);
    return () => clearInterval(interval);
  }, [status, session?.user]);

  const fetchQueue = useCallback(async () => {
    const res = await fetch("/api/queue", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setQueueData({
      myEntry: data.myEntry ?? null,
      playersByGame: data.playersByGame ?? { lol: [], ow: [], sc: [], battlerite: [] },
      gameLabels: data.gameLabels ?? {},
    });
    if (data.matchedGame) {
      setMatchedGameFromQueue(data.matchedGame);
      setOngoingQueueMatchId(data.matchedGame.id);
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) {
      setQueueData(null);
      return;
    }
    fetchQueue();
    const interval = setInterval(fetchQueue, 4000);
    return () => clearInterval(interval);
  }, [status, session?.user, fetchQueue]);

  useEffect(() => {
    if (!queueData?.myEntry) {
      setQueueTimerSeconds(0);
      return;
    }
    const joined = new Date(queueData.myEntry.joinedAt).getTime();
    const tick = () => setQueueTimerSeconds(Math.floor((Date.now() - joined) / 1000));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [queueData?.myEntry?.joinedAt]);

  const fetchOnline = useCallback(async () => {
    const res = await fetch("/api/online", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setOnlineUsers(data.users ?? []);
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) {
      setOnlineUsers([]);
      return;
    }
    fetchOnline();
    const interval = setInterval(fetchOnline, 4000);
    return () => clearInterval(interval);
  }, [status, session?.user, fetchOnline]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (queueMenuRef.current && !queueMenuRef.current.contains(e.target as Node)) setQueuePinned(false);
      if (onlineMenuRef.current && !onlineMenuRef.current.contains(e.target as Node)) setOnlinePinned(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      clearOnlineCloseTimeout();
      clearQueueCloseTimeout();
    };
  }, []);

  const handleJoinQueue = async (gameType: string) => {
    const res = await fetch("/api/queue/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameType }),
    });
    if (res.ok) {
      setPlayModalOpen(false);
      fetchQueue();
    }
  };

  const handleLeaveQueue = async () => {
    const res = await fetch("/api/queue/leave", { method: "POST" });
    if (res.ok) {
      setQueuePinned(false);
      fetchQueue();
    }
  };

  const formatTimer = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus();
    } else {
      setSearchQuery("");
      setSearchResults([]);
    }
  }, [searchOpen]);

  const runSearch = useCallback(async (q: string) => {
    const term = q.trim();
    if (term.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(term)}`);
      const data = await res.json();
      setSearchResults(data.users ?? []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setCompletionIndex(0);
      return;
    }
    const t = setTimeout(() => runSearch(searchQuery), 100);
    return () => clearTimeout(t);
  }, [searchQuery, runSearch]);

  useEffect(() => {
    setCompletionIndex(0);
  }, [searchResults]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSearchOpen(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("keydown", handleEscape);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSelectUser = (username: string) => {
    setSearchOpen(false);
    router.push(`/profile/${encodeURIComponent(username)}`);
  };

  const completionSuggestion = searchResults[completionIndex];
  const completionDisplay = completionSuggestion
    ? (completionSuggestion.name !== completionSuggestion.username
        ? `${capitalizeFirst(completionSuggestion.name ?? "")} (@${capitalizeFirst(completionSuggestion.username ?? "")})`
        : capitalizeFirst(completionSuggestion.username ?? ""))
    : "";
  const previewSuffix = completionDisplay && searchQuery.trim()
    ? (completionDisplay.toLowerCase().startsWith(searchQuery.trim().toLowerCase())
        ? completionDisplay.slice(searchQuery.trim().length)
        : "")
    : "";

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Tab" && completionSuggestion && previewSuffix) {
      e.preventDefault();
      setSearchQuery(completionDisplay);
      setSearchResults([]);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (searchResults.length) setCompletionIndex((i) => (i + 1) % searchResults.length);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (searchResults.length) setCompletionIndex((i) => (i - 1 + searchResults.length) % searchResults.length);
      return;
    }
    if (e.key === "Enter" && completionSuggestion) {
      e.preventDefault();
      handleSelectUser(completionSuggestion.username);
    }
  };

  return (
    <nav className="border-b border-cyan-500/20 bg-black/80 backdrop-blur-sm sticky top-0 z-50">
      {session && (
        <div
          className="fixed top-0 left-0 z-[60] flex items-center pl-4 border-b border-cyan-500/20 bg-black/80 backdrop-blur-sm pr-6 h-14"
          ref={onlineMenuRef}
          onMouseEnter={() => { clearOnlineCloseTimeout(); setOnlineHovering(true); }}
          onMouseLeave={() => { clearOnlineCloseTimeout(); onlineCloseTimeoutRef.current = setTimeout(() => setOnlineHovering(false), 200); }}
        >
          <button
            type="button"
            onClick={() => setOnlinePinned((o) => !o)}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors text-neutral-400 hover:text-cyan-200 hover:bg-cyan-500/10 border border-white/10 ${
              onlineMenuOpen ? "shadow-[0_0_12px_rgba(103,232,249,0.4)]" : ""
            }`}
          >
            <span className="font-medium">Online</span>
            {onlineUsers.length > 0 ? (
              <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-cyan-500/30 px-1.5 text-xs font-bold text-cyan-200">
                {onlineUsers.length > 99 ? "99+" : onlineUsers.length}
              </span>
            ) : null}
          </button>
          {onlineMenuOpen && (
            <div
              className="absolute top-full left-4 mt-1 w-56 max-h-80 overflow-auto rounded-lg border border-cyan-500/30 bg-black/95 shadow-xl z-[100]"
              onMouseEnter={() => { clearOnlineCloseTimeout(); setOnlineHovering(true); }}
              onMouseLeave={() => { clearOnlineCloseTimeout(); onlineCloseTimeoutRef.current = setTimeout(() => setOnlineHovering(false), 200); }}
            >
              <div className="p-2 border-b border-white/10">
                <span className="text-sm font-semibold text-cyan-200">Online now</span>
              </div>
              <ul className="p-2 space-y-0.5">
                {onlineUsers.length === 0 ? (
                  <li className="text-sm text-neutral-500 py-2 text-center">No one online</li>
                ) : (
                  onlineUsers.map((u) => {
                    const isYou = session?.user?.id === u.id;
                    const displayName = u.name ?? u.username ?? "—";
                    return (
                      <li key={u.id} className="flex items-center">
                        <span className={`inline-block rounded py-0.5 px-1.5 text-sm truncate min-w-0 flex-1 ${isYou ? "border border-amber-400/50 shadow-[inset_0_0_12px_rgba(251,191,36,0.2)]" : "border border-transparent"}`}>
                          <Link
                            href={`/profile/${encodeURIComponent((u.username ?? u.name ?? "").trim() || "?")}`}
                            className="block text-neutral-200 hover:text-cyan-200 transition-colors truncate"
                            onClick={() => setOnlinePinned(false)}
                          >
                            {displayName}
                          </Link>
                        </span>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          )}
        </div>
      )}
      {session && queueData && (
        <div
          className="fixed top-0 right-0 z-[60] flex items-center pr-4 border-b border-cyan-500/20 bg-black/80 backdrop-blur-sm pl-6 h-14"
          ref={queueMenuRef}
          onMouseEnter={() => { clearQueueCloseTimeout(); setQueueHovering(true); }}
          onMouseLeave={() => { clearQueueCloseTimeout(); queueCloseTimeoutRef.current = setTimeout(() => setQueueHovering(false), 200); }}
        >
          <button
            type="button"
            onClick={() => setQueuePinned((o) => !o)}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
              queueData.myEntry
                ? "bg-red-500/20 text-red-300 border border-red-400/50 hover:bg-red-500/30 shadow-[0_0_14px_rgba(239,68,68,0.35)]"
                : "text-neutral-400 hover:text-cyan-200 hover:bg-cyan-500/10 border border-white/10"
            } ${queueMenuOpen ? "shadow-[0_0_12px_rgba(103,232,249,0.4)]" : ""}`}
          >
            {queueData.myEntry ? (
              <>
                <span className="font-semibold">In queue · {queueData.myEntry.label}</span>
                <span className="tabular-nums font-mono text-red-200" aria-label="Time in queue">
                  {formatTimer(queueTimerSeconds)}
                </span>
              </>
            ) : (
              <>
                <span className="font-medium">Queue</span>
                {(() => {
                  const total = (["lol", "ow", "sc", "battlerite"] as const).reduce(
                    (s, g) => s + (queueData.playersByGame[g]?.length ?? 0),
                    0
                  );
                  return total > 0 ? (
                    <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-cyan-500/30 px-1.5 text-xs font-bold text-cyan-200">
                      {total > 99 ? "99+" : total}
                    </span>
                  ) : null;
                })()}
              </>
            )}
          </button>
          {queueMenuOpen && (
            <div
              className="absolute top-full right-4 mt-1 w-72 max-h-80 overflow-auto rounded-lg border border-cyan-500/30 bg-black/95 shadow-xl z-[100]"
              onMouseEnter={() => { clearQueueCloseTimeout(); setQueueHovering(true); }}
              onMouseLeave={() => { clearQueueCloseTimeout(); queueCloseTimeoutRef.current = setTimeout(() => setQueueHovering(false), 200); }}
            >
              <div className="p-2 border-b border-white/10 flex items-center justify-between">
                <span className="text-sm font-semibold text-cyan-200">Players in queue</span>
                {queueData.myEntry && (
                  <button
                    type="button"
                    onClick={handleLeaveQueue}
                    className="text-xs px-2 py-1 rounded text-neutral-400 hover:text-red-300 hover:bg-red-500/20 transition-colors"
                  >
                    Leave queue
                  </button>
                )}
              </div>
              <div className="p-2 space-y-3">
                {(["lol", "ow", "sc", "battlerite"] as const).map((gameType) => {
                  const players = queueData.playersByGame[gameType] ?? [];
                  const label = queueData.gameLabels[gameType] ?? gameType;
                  if (players.length === 0) return null;
                  return (
                    <div key={gameType}>
                      <div className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">
                        {label}
                      </div>
                      <ul className="space-y-0.5">
                        {players.map((p) => {
                          const isYou = session?.user?.id === p.id;
                          const displayName = p.name ?? p.username ?? "—";
                          return (
                            <li key={p.id} className="flex items-center">
                              <span className={`inline-block rounded py-0.5 px-1.5 text-sm truncate min-w-0 flex-1 ${isYou ? "border border-amber-400/50 shadow-[inset_0_0_12px_rgba(251,191,36,0.2)]" : "border border-transparent"}`}>
                                <Link
                                  href={`/profile/${encodeURIComponent((p.username ?? p.name ?? "").trim() || "?")}`}
                                  className="block text-neutral-200 hover:text-cyan-200 transition-colors truncate"
                                  onClick={() => setQueuePinned(false)}
                                >
                                  {displayName}
                                </Link>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
                {(["lol", "ow", "sc", "battlerite"] as const).every(
                  (g) => (queueData.playersByGame[g]?.length ?? 0) === 0
                ) && (
                  <p className="text-sm text-neutral-500 py-2 text-center">No one in queue</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-lg font-semibold text-white hover:text-cyan-300 transition-colors flex items-center gap-1.5"
            >
              <img src="/yin-yang.png" alt="" aria-hidden className="h-6 w-6 block bg-transparent mix-blend-multiply" />
              INTRA
            </Link>
            {session && (
              <button
                type="button"
                onClick={() => setPlayModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-orange-200 bg-orange-950/80 hover:bg-orange-900/90 border border-orange-500/60 shadow-[0_0_12px_rgba(234,88,12,0.35)] hover:shadow-[0_0_16px_rgba(234,88,12,0.45)] transition-all"
                aria-label="Join queue to play"
              >
                <SportsEsportsIcon sx={{ fontSize: 18 }} />
                Play
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            {isAdmin(session) && (
              <Link
                href="/admin"
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  pathname?.startsWith("/admin")
                    ? "bg-cyan-500/20 text-cyan-300"
                    : "text-neutral-400 hover:text-pink-200 hover:bg-pink-500/10"
                }`}
              >
                Admin
              </Link>
            )}
            {ongoingQueueMatchId && (
              <button
                type="button"
                onClick={() => router.push(`/queue-match/${ongoingQueueMatchId}`)}
                className="px-3 py-2 rounded-md text-sm font-semibold transition-colors bg-red-500/20 text-red-300 border border-red-400/50 hover:bg-red-500/30 shadow-[0_0_14px_rgba(239,68,68,0.4)] hover:shadow-[0_0_20px_rgba(239,68,68,0.5)]"
              >
                Ongoing game
              </button>
            )}
            {navLinks.map((link) => {
              const isActive =
                link.href === "/"
                  ? pathname === "/"
                  : pathname?.startsWith(link.href);
              const showGameBadge = link.href === "/team-builder" && activeGamesCount > 0;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-cyan-500/20 text-cyan-300"
                      : "text-neutral-400 hover:text-pink-200 hover:bg-pink-500/10"
                  }`}
                >
                  {link.label}
                  {showGameBadge && (
                    <span
                      className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-400 text-[10px] font-bold text-black"
                      aria-label={`${activeGamesCount} game(s) in progress`}
                    >
                      {activeGamesCount > 9 ? "9+" : activeGamesCount}
                    </span>
                  )}
                </Link>
              );
            })}

            <div className="relative flex items-center" ref={searchContainerRef}>
              {searchOpen ? (
                <div className="flex items-center gap-1 ml-1">
                  <div className="relative flex items-center rounded-md bg-white/10 border border-cyan-500/30 focus-within:border-cyan-400 focus-within:ring-1 focus-within:ring-cyan-400/50 w-56 flex-none overflow-hidden">
                    <SearchIcon className="absolute left-2.5 w-4 h-4 text-neutral-500 pointer-events-none shrink-0 z-10" />
                    <div className="relative flex-1 flex items-center h-9 pl-8 pr-8">
                      {/* Inline completion: typed text + suffix in gray, behind input; placeholder when empty */}
                      <div
                        className="absolute inset-0 flex items-center pl-8 pr-8 pointer-events-none text-sm overflow-hidden"
                        aria-hidden
                      >
                        {searchQuery ? (
                          <>
                            <span className="text-white shrink-0">{searchQuery}</span>
                            {previewSuffix && <span className="text-neutral-500 shrink-0">{previewSuffix}</span>}
                          </>
                        ) : (
                          <span className="text-neutral-500">Search user...</span>
                        )}
                      </div>
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                        placeholder="Search user..."
                        className="absolute inset-0 w-full bg-transparent text-sm focus:outline-none border-0 p-0 pl-8 pr-8 caret-white text-transparent placeholder:opacity-0"
                        style={{ caretColor: "#fff" }}
                        aria-label="Search for a user"
                      />
                    </div>
                    {searchLoading && (
                      <span className="absolute right-9 text-cyan-400 text-xs animate-pulse z-10">…</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setSearchOpen(false)}
                      className="absolute right-2 p-0.5 rounded text-neutral-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 z-10"
                      aria-label="Close search"
                    >
                      <CloseIcon sx={{ fontSize: 18 }} />
                    </button>
                  </div>
                  {searchResults.length > 0 && (
                    <div className="absolute top-full left-0 mt-1 w-64 max-h-72 overflow-auto rounded-lg border border-cyan-500/30 bg-black/95 shadow-xl z-[100]">
                      <ul className="py-1">
                        {searchResults.map((u) => (
                          <li key={u.id}>
                            <button
                              type="button"
                              onClick={() => handleSelectUser(u.username)}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-neutral-200 hover:bg-cyan-500/20 hover:text-cyan-200 transition-colors"
                            >
                              <PersonIcon sx={{ fontSize: 18, color: "#67e8f9" }} />
                              <span className="truncate">
                                {u.name !== u.username ? `${capitalizeFirst(u.name)} (@${capitalizeFirst(u.username)})` : capitalizeFirst(u.username)}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {searchQuery.trim().length >= 2 && !searchLoading && searchResults.length === 0 && (
                    <div className="absolute top-full left-0 mt-1 w-64 py-3 px-3 rounded-lg border border-cyan-500/30 bg-black/95 text-sm text-neutral-400 z-[100]">
                      No users found.
                    </div>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    pathname?.startsWith("/search")
                      ? "bg-cyan-500/20 text-cyan-300"
                      : "text-neutral-400 hover:text-pink-200 hover:bg-pink-500/10"
                  }`}
                  aria-label="Open search"
                >
                  <SearchIcon sx={{ fontSize: 18 }} />
                  Search
                </button>
              )}
            </div>

            <div className="ml-2 pl-2 border-l border-white/10 flex items-center gap-2">
              {status === "loading" ? (
                <span className="px-3 py-2 text-sm text-neutral-500">…</span>
              ) : session ? (
                <>
                  <Link
                    href="/profile"
                    className="px-2.5 py-1 rounded-md text-sm font-medium bg-cyan-500/15 text-cyan-200 border border-cyan-500/30 hover:bg-cyan-500/25 hover:border-cyan-500/50 transition-colors"
                    title={session.user?.email ?? undefined}
                  >
                    {session.user?.name ?? session.user?.email ?? "User"}
                  </Link>
                  <button
                    type="button"
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="px-3 py-2 rounded-md text-sm font-medium text-neutral-400 hover:text-pink-200 hover:bg-pink-500/10 transition-colors"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  className="px-3 py-2 rounded-md text-sm font-medium text-neutral-400 hover:text-pink-200 hover:bg-pink-500/10 transition-colors"
                >
                  Login
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {playModalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="play-modal-title"
            onClick={() => setPlayModalOpen(false)}
          >
            <div
              className="fixed left-1/2 w-full max-w-sm mx-4 bg-neutral-900 border border-orange-500/40 rounded-xl shadow-2xl shadow-orange-900/20 p-6 -translate-x-1/2 -translate-y-1/2"
              style={{ top: "calc(28px + 50vh)", margin: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 id="play-modal-title" className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                <SportsEsportsIcon sx={{ color: "#f97316" }} />
                Choose game
              </h2>
              <p className="text-sm text-neutral-400 mb-4">You will be added to the queue for this game.</p>
              <div className="grid grid-cols-1 gap-2">
                {QUEUE_GAMES.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => handleJoinQueue(g.id)}
                    className="px-4 py-3 rounded-lg text-left font-medium text-white bg-white/5 hover:bg-orange-500/20 border border-white/10 hover:border-orange-500/50 transition-colors"
                  >
                    {g.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setPlayModalOpen(false)}
                className="mt-4 w-full py-2 rounded-lg text-sm text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>,
          document.body
        )}

      {matchedGameFromQueue && typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="matched-game-title"
            onClick={() => {
              if (matchedGameFromQueue?.id) {
                router.push(`/queue-match/${matchedGameFromQueue.id}`);
                setMatchedGameFromQueue(null);
              }
            }}
          >
            <div className="w-full max-w-lg bg-neutral-900 border border-cyan-500/40 rounded-xl shadow-2xl overflow-hidden pointer-events-none">
              <div className="p-4 border-b border-white/10">
                <h2 id="matched-game-title" className="text-lg font-bold text-cyan-200 flex items-center gap-2">
                  <SportsEsportsIcon sx={{ color: "#67e8f9" }} />
                  Match found — {QUEUE_GAMES.find((g) => g.id === matchedGameFromQueue.gameType)?.label ?? matchedGameFromQueue.gameType}
                </h2>
                <p className="text-sm text-neutral-400 mt-1">Your team is ready. Click anywhere to post the result after the game.</p>
              </div>
              <div className="grid grid-cols-2 gap-4 p-4">
                <div className="rounded-lg p-3 bg-cyan-500/10 border border-cyan-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-cyan-300 uppercase tracking-wider">Team Yin</span>
                    <span className="text-sm font-semibold text-cyan-200 tabular-nums">
                      {matchedGameFromQueue.teamA.reduce((s, p) => s + (p.rating ?? 0), 0)} ELO
                    </span>
                  </div>
                  <ul className="space-y-1 text-sm text-neutral-200">
                    {matchedGameFromQueue.teamA.map((p) => (
                      <li key={p.id} className="flex justify-between">
                        <span className="truncate">{p.name || "—"}</span>
                        <span className="text-cyan-300 font-mono ml-2">{p.rating ?? "—"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg p-3 bg-pink-500/10 border border-pink-500/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-pink-300 uppercase tracking-wider">Team Yang</span>
                    <span className="text-sm font-semibold text-pink-200 tabular-nums">
                      {matchedGameFromQueue.teamB.reduce((s, p) => s + (p.rating ?? 0), 0)} ELO
                    </span>
                  </div>
                  <ul className="space-y-1 text-sm text-neutral-200">
                    {matchedGameFromQueue.teamB.map((p) => (
                      <li key={p.id} className="flex justify-between">
                        <span className="truncate">{p.name || "—"}</span>
                        <span className="text-pink-300 font-mono ml-2">{p.rating ?? "—"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="p-4 border-t border-white/10">
                <div className="py-2.5 rounded-lg text-center text-sm font-medium text-cyan-200">
                  Click anywhere → Post results
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </nav>
  );
}
