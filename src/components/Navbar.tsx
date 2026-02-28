"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import SearchIcon from "@mui/icons-material/Search";
import PersonIcon from "@mui/icons-material/Person";
import CloseIcon from "@mui/icons-material/Close";
import MenuIcon from "@mui/icons-material/Menu";
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
  { href: "/tools", label: "Tools" },
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

type DraftStateAccept = { phase: "accept"; acceptDeadline?: string; acceptedUserIds?: string[] };
type MatchedGame = {
  id: string;
  gameType: string;
  season: number;
  teamA: { id: string; name: string; rating: number }[];
  teamB: { id: string; name: string; rating: number }[];
  status: string;
  createdAt: string;
  draftState?: DraftStateAccept;
};

type OnlineUser = { id: string; name: string | null; username: string | null };

type OngoingGameNav = { id: string; gameType: string; source: string; teamA: string[]; teamB: string[] };

function isAdmin(session: { user?: { role?: string } | null } | null): boolean {
  return (session?.user as { role?: string } | undefined)?.role === "admin";
}

function MatchFoundModal({
  matchedGame,
  onAcceptAndGo,
  onDecline,
}: {
  matchedGame: MatchedGame;
  onClose: () => void;
  onAcceptAndGo: (id: string) => void;
  onDecline: () => void;
}) {
  const isAcceptPhase =
    matchedGame.gameType === "battlerite" &&
    (matchedGame.draftState as DraftStateAccept | undefined)?.phase === "accept";
  const acceptDeadline = (matchedGame.draftState as DraftStateAccept | undefined)?.acceptDeadline;
  const acceptedCount = (matchedGame.draftState as DraftStateAccept | undefined)?.acceptedUserIds?.length ?? 0;
  const [acceptSecondsLeft, setAcceptSecondsLeft] = useState(0);
  const [acceptLoading, setAcceptLoading] = useState(false);
  const [declineLoading, setDeclineLoading] = useState(false);
  const [declinedByName, setDeclinedByName] = useState<string | null>(null);

  useEffect(() => {
    if (!isAcceptPhase || !acceptDeadline) return;
    const end = new Date(acceptDeadline).getTime();
    const tick = () => setAcceptSecondsLeft(Math.max(0, Math.ceil((end - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isAcceptPhase, acceptDeadline]);

  useEffect(() => {
    if (!isAcceptPhase || !matchedGame.id) return;
    const checkCancelled = async () => {
      const res = await fetch(`/api/team-builder/games/${matchedGame.id}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (data?.status === "cancelled" && data?.cancelledByName) {
        setDeclinedByName(data.cancelledByName);
      }
    };
    checkCancelled();
    const interval = setInterval(checkCancelled, 2000);
    return () => clearInterval(interval);
  }, [isAcceptPhase, matchedGame.id]);

  const handleAccept = async () => {
    if (!matchedGame.id || acceptLoading) return;
    setAcceptLoading(true);
    try {
      const res = await fetch(`/api/team-builder/games/${matchedGame.id}/accept`, { method: "POST" });
      if (res.ok) onAcceptAndGo(matchedGame.id);
    } finally {
      setAcceptLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!matchedGame.id || declineLoading) return;
    setDeclineLoading(true);
    try {
      const res = await fetch(`/api/team-builder/games/${matchedGame.id}/cancel`, { method: "POST" });
      if (res.ok) onDecline();
    } finally {
      setDeclineLoading(false);
    }
  };

  const handleOverlayClick = () => {
    if (!isAcceptPhase && matchedGame.id) {
      onAcceptAndGo(matchedGame.id);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="matched-game-title"
      onClick={handleOverlayClick}
      style={{ cursor: isAcceptPhase ? "default" : "pointer" }}
    >
      <div
        className="w-full max-w-lg bg-neutral-900 border border-cyan-500/40 rounded-xl shadow-2xl overflow-hidden pointer-events-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-white/10">
          <h2 id="matched-game-title" className="text-lg font-bold text-cyan-200 flex items-center gap-2">
            <SportsEsportsIcon sx={{ color: "#67e8f9" }} />
            {declinedByName ? "Game cancelled" : `Match found — ${QUEUE_GAMES.find((g) => g.id === matchedGame.gameType)?.label ?? matchedGame.gameType}`}
          </h2>
          <p className="text-sm text-neutral-400 mt-1">
            {declinedByName
              ? `${declinedByName} declined the game.`
              : isAcceptPhase
                ? "Accept to join the draft. If you decline, the match is cancelled for everyone."
                : "Your team is ready. Click anywhere to post the result after the game."}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4 p-4">
          <div className="rounded-lg p-3 bg-cyan-500/10 border border-cyan-500/30">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-cyan-300 uppercase tracking-wider">Team Yin</span>
              <span className="text-sm font-semibold text-cyan-200 tabular-nums">
                {matchedGame.teamA.reduce((s, p) => s + (p.rating ?? 0), 0)} ELO
              </span>
            </div>
            <ul className="space-y-1 text-sm text-neutral-200">
              {matchedGame.teamA.map((p) => (
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
                {matchedGame.teamB.reduce((s, p) => s + (p.rating ?? 0), 0)} ELO
              </span>
            </div>
            <ul className="space-y-1 text-sm text-neutral-200">
              {matchedGame.teamB.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span className="truncate">{p.name || "—"}</span>
                  <span className="text-pink-300 font-mono ml-2">{p.rating ?? "—"}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {declinedByName ? (
          <div className="p-4 border-t border-white/10">
            <button
              type="button"
              onClick={onDecline}
              className="w-full py-2.5 rounded-lg bg-slate-600/40 text-slate-200 font-semibold hover:bg-slate-600/60"
            >
              Close
            </button>
          </div>
        ) : isAcceptPhase ? (
          <div className="p-4 border-t border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Time to accept</span>
              <span className={`text-2xl font-bold tabular-nums ${acceptSecondsLeft <= 5 ? "text-red-400" : "text-cyan-400"}`}>
                {String(acceptSecondsLeft).padStart(2, "0")}
              </span>
            </div>
            <p className="text-xs text-slate-500">{acceptedCount} / 6 players accepted</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleAccept}
                disabled={acceptLoading || acceptSecondsLeft <= 0}
                className="flex-1 py-2.5 rounded-lg bg-cyan-500/20 text-cyan-200 font-semibold hover:bg-cyan-500/30 disabled:opacity-50 disabled:pointer-events-none"
              >
                {acceptLoading ? "…" : "Accept"}
              </button>
              <button
                type="button"
                onClick={handleDecline}
                disabled={declineLoading}
                className="flex-1 py-2.5 rounded-lg bg-red-500/20 text-red-300 font-semibold hover:bg-red-500/30 disabled:opacity-50"
              >
                {declineLoading ? "…" : "Decline"}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 border-t border-white/10">
            <div className="py-2.5 rounded-lg text-center text-sm font-medium text-cyan-200">
              Click anywhere → Post results
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [completionIndex, setCompletionIndex] = useState(0);
  const [activeGamesCount, setActiveGamesCount] = useState(0);
  const [teamBuilderGamesCount, setTeamBuilderGamesCount] = useState(0);
  const [ongoingGames, setOngoingGames] = useState<OngoingGameNav[]>([]);
  const [playModalOpen, setPlayModalOpen] = useState(false);
  const [queueData, setQueueData] = useState<QueueData | null>(null);
  const [queueTimerSeconds, setQueueTimerSeconds] = useState(0);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [onlineHovering, setOnlineHovering] = useState(false);
  const [onlinePinned, setOnlinePinned] = useState(false);
  const [ongoingHovering, setOngoingHovering] = useState(false);
  const [ongoingPinned, setOngoingPinned] = useState(false);
  const [queueHovering, setQueueHovering] = useState(false);
  const [queuePinned, setQueuePinned] = useState(false);
  const [matchedGameFromQueue, setMatchedGameFromQueue] = useState<MatchedGame | null>(null);
  const [ongoingQueueMatchId, setOngoingQueueMatchId] = useState<string | null>(null);
  const previousPendingGameIdsRef = useRef<Set<string>>(new Set());
  const navInitializedRef = useRef(false);
  const onlineMenuOpen = onlineHovering || onlinePinned;
  const ongoingMenuOpen = ongoingHovering || ongoingPinned;
  const queueMenuOpen = queueHovering || queuePinned;
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const queueMenuRef = useRef<HTMLDivElement>(null);
  const onlineMenuRef = useRef<HTMLDivElement>(null);
  const ongoingMenuRef = useRef<HTMLDivElement>(null);
  const onlineCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ongoingCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queueCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearOnlineCloseTimeout = () => {
    if (onlineCloseTimeoutRef.current != null) {
      clearTimeout(onlineCloseTimeoutRef.current);
      onlineCloseTimeoutRef.current = null;
    }
  };
  const clearOngoingCloseTimeout = () => {
    if (ongoingCloseTimeoutRef.current != null) {
      clearTimeout(ongoingCloseTimeoutRef.current);
      ongoingCloseTimeoutRef.current = null;
    }
  };
  const clearQueueCloseTimeout = () => {
    if (queueCloseTimeoutRef.current != null) {
      clearTimeout(queueCloseTimeoutRef.current);
      queueCloseTimeoutRef.current = null;
    }
  };

  const fetchNav = useCallback(async () => {
    const res = await fetch("/api/nav", { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    const pendingGameIds = (data.pendingGameIds ?? []) as string[];
    const ongoingGames = (data.ongoingGames ?? []) as OngoingGameNav[];
    setActiveGamesCount(data.pendingGamesCount ?? 0);
    setTeamBuilderGamesCount(data.pendingTeamBuilderCount ?? 0);
    setOngoingGames(ongoingGames);
    setOngoingQueueMatchId(data.ongoingQueueMatchId ?? null);
    setOnlineUsers(data.online ?? []);

    const prevIds = previousPendingGameIdsRef.current;
    const newGameIds = pendingGameIds.filter((id) => !prevIds.has(id));
    const hasNewGame = newGameIds.length > 0;
    if (navInitializedRef.current && hasNewGame && pendingGameIds.length > 0) {
      const newQueueMatchId = newGameIds.find(
        (id) => ongoingGames.find((g) => g.id === id)?.source === "ranked_queue"
      );
      if (newQueueMatchId) {
        router.push(`/queue-match/${newQueueMatchId}`);
      } else {
        router.push("/team-builder");
      }
    }
    navInitializedRef.current = true;
    previousPendingGameIdsRef.current = new Set(pendingGameIds);
  }, [router]);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) {
      setActiveGamesCount(0);
      setTeamBuilderGamesCount(0);
      setOngoingGames([]);
      setOngoingQueueMatchId(null);
      setOnlineUsers([]);
      return;
    }
    fetchNav();
    const interval = setInterval(fetchNav, 5000);
    return () => clearInterval(interval);
  }, [status, session?.user, fetchNav]);

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
    const interval = setInterval(fetchQueue, 5000);
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

  // Online users are loaded via fetchNav above (combined with pending games).

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (queueMenuRef.current && !queueMenuRef.current.contains(e.target as Node)) setQueuePinned(false);
      if (onlineMenuRef.current && !onlineMenuRef.current.contains(e.target as Node)) setOnlinePinned(false);
      if (ongoingMenuRef.current && !ongoingMenuRef.current.contains(e.target as Node)) setOngoingPinned(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      clearOnlineCloseTimeout();
      clearOngoingCloseTimeout();
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
    setMobileMenuOpen(false);
  }, [pathname]);

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
        <div className="hidden lg:flex fixed top-0 left-0 z-[60] items-center gap-3 pl-4 border-b border-cyan-500/20 bg-black/80 backdrop-blur-sm pr-6 h-14">
          <div
            ref={onlineMenuRef}
            className="relative"
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
          <div
            ref={ongoingMenuRef}
            className="relative"
            onMouseEnter={() => { clearOngoingCloseTimeout(); setOngoingHovering(true); }}
            onMouseLeave={() => { clearOngoingCloseTimeout(); ongoingCloseTimeoutRef.current = setTimeout(() => setOngoingHovering(false), 200); }}
          >
            <button
              type="button"
              onClick={() => setOngoingPinned((o) => !o)}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors text-neutral-400 hover:text-cyan-200 hover:bg-cyan-500/10 border border-white/10 ${
                ongoingMenuOpen ? "shadow-[0_0_12px_rgba(103,232,249,0.4)]" : ""
              }`}
            >
              <span className="font-medium">Ongoing games</span>
              {ongoingGames.length > 0 ? (
                <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-cyan-500/30 px-1.5 text-xs font-bold text-cyan-200">
                  {ongoingGames.length > 99 ? "99+" : ongoingGames.length}
                </span>
              ) : null}
            </button>
            {ongoingMenuOpen && (
              <div
                className="absolute top-full left-4 mt-1 w-72 max-h-[70vh] overflow-auto rounded-lg border border-cyan-500/30 bg-black/95 shadow-xl z-[100]"
                onMouseEnter={() => { clearOngoingCloseTimeout(); setOngoingHovering(true); }}
                onMouseLeave={() => { clearOngoingCloseTimeout(); ongoingCloseTimeoutRef.current = setTimeout(() => setOngoingHovering(false), 200); }}
              >
                <div className="p-2 border-b border-white/10">
                  <span className="text-sm font-semibold text-cyan-200">Ongoing games</span>
                </div>
                <div className="p-2 space-y-3">
                  {ongoingGames.length === 0 ? (
                    <p className="text-sm text-neutral-500 py-2">No games in progress.</p>
                  ) : (
                    ongoingGames.map((game, index) => {
                      const gameLabel = QUEUE_GAMES.find((g) => g.id === game.gameType)?.label ?? game.gameType;
                      const href = game.source === "ranked_queue" ? `/queue-match/${game.id}` : "/team-builder";
                      return (
                        <div key={game.id} className="rounded border border-white/10 bg-white/5 p-2 text-sm">
                          <Link
                            href={href}
                            className="font-semibold text-cyan-200 hover:text-cyan-100 block mb-1.5"
                            onClick={() => setOngoingPinned(false)}
                          >
                            Game {index + 1}: {gameLabel}
                          </Link>
                          <div className="space-y-1 text-neutral-300">
                            <div>
                              <span className="text-neutral-500 text-xs">Team A: </span>
                              {game.teamA.join(", ") || "—"}
                            </div>
                            <div>
                              <span className="text-neutral-500 text-xs">Team B: </span>
                              {game.teamB.join(", ") || "—"}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div className="pt-1 border-t border-white/10 flex flex-col gap-1">
                    <Link
                      href="/team-builder"
                      className="text-sm font-medium text-cyan-300 hover:text-cyan-200 transition-colors"
                      onClick={() => setOngoingPinned(false)}
                    >
                      Go to Team Builder →
                    </Link>
                    <button
                      type="button"
                      className="text-sm font-medium text-cyan-300 hover:text-cyan-200 transition-colors text-left"
                      onClick={() => {
                        setOngoingPinned(false);
                        setPlayModalOpen(true);
                      }}
                    >
                      Go to queue →
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {session && (
        <div
          className="hidden lg:flex fixed top-0 right-0 z-[60] items-center gap-3 pr-4 border-b border-cyan-500/20 bg-black/80 backdrop-blur-sm pl-4 h-14"
          ref={queueMenuRef}
          onMouseEnter={() => { clearQueueCloseTimeout(); setQueueHovering(true); }}
          onMouseLeave={() => { clearQueueCloseTimeout(); queueCloseTimeoutRef.current = setTimeout(() => setQueueHovering(false), 200); }}
        >
          {ongoingQueueMatchId && (
            <button
              type="button"
              onClick={() => router.push(`/queue-match/${ongoingQueueMatchId}`)}
              className="px-3 py-2 rounded-md text-sm font-semibold transition-colors bg-red-500/20 text-red-300 border border-red-400/50 hover:bg-red-500/30 shadow-[0_0_14px_rgba(239,68,68,0.4)] hover:shadow-[0_0_20px_rgba(239,68,68,0.5)]"
            >
              Ongoing game
            </button>
          )}
          <button
            type="button"
            onClick={() => setPlayModalOpen(true)}
            className="flex items-center gap-3 px-10 py-1 rounded-xl text-xl font-bold text-orange-200 bg-orange-950/90 hover:bg-orange-900 border-2 border-orange-500/70 shadow-[0_0_20px_rgba(234,88,12,0.45)] hover:shadow-[0_0_28px_rgba(234,88,12,0.55)] transition-all"
            aria-label="Join queue to play"
          >
            <SportsEsportsIcon sx={{ fontSize: 36 }} />
            Play
          </button>
          {queueData && (
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
          )}
          {queueData && queueMenuOpen && (
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
              <img src="/yinyang_gen2.png" alt="" aria-hidden className="h-6 w-6 block" />
              INTRA
            </Link>
          </div>

          {/* Desktop nav links + search + auth */}
          <div className="hidden lg:flex items-center gap-1">
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
            {navLinks.map((link) => {
              const isActive =
                link.href === "/"
                  ? pathname === "/"
                  : pathname?.startsWith(link.href);
              const showGameBadge = link.href === "/team-builder" && teamBuilderGamesCount > 0;
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
                      aria-label={`${teamBuilderGamesCount} team builder game(s) in progress`}
                    >
                      {teamBuilderGamesCount > 9 ? "9+" : teamBuilderGamesCount}
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

          {/* Mobile controls */}
          <div className="flex lg:hidden items-center gap-2">
            {session && (
              <button
                type="button"
                onClick={() => { setMobileMenuOpen(false); setPlayModalOpen(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold text-orange-200 bg-orange-950/90 hover:bg-orange-900 border border-orange-500/70 shadow-[0_0_14px_rgba(234,88,12,0.4)] transition-all"
                aria-label="Join queue to play"
              >
                <SportsEsportsIcon sx={{ fontSize: 20 }} />
                Play
              </button>
            )}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="p-2 rounded-md text-neutral-400 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-cyan-500/20 bg-black/95 backdrop-blur-lg max-h-[calc(100vh-3.5rem)] overflow-y-auto">
          <div className="p-3 space-y-0.5">
            {isAdmin(session) && (
              <Link
                href="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  pathname?.startsWith("/admin") ? "bg-cyan-500/20 text-cyan-300" : "text-neutral-300 hover:text-cyan-200 hover:bg-cyan-500/10"
                }`}
              >
                Admin
              </Link>
            )}
            {navLinks.map((link) => {
              const isActive = link.href === "/" ? pathname === "/" : pathname?.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? "bg-cyan-500/20 text-cyan-300" : "text-neutral-300 hover:text-cyan-200 hover:bg-cyan-500/10"
                  }`}
                >
                  {link.label}
                  {link.href === "/team-builder" && teamBuilderGamesCount > 0 && (
                    <span className="ml-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-cyan-400 px-1.5 text-[10px] font-bold text-black">
                      {teamBuilderGamesCount > 9 ? "9+" : teamBuilderGamesCount}
                    </span>
                  )}
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => { setMobileMenuOpen(false); setSearchOpen(true); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-400 hover:text-cyan-200 hover:bg-cyan-500/10 transition-colors"
            >
              <SearchIcon sx={{ fontSize: 18 }} />
              Search
            </button>

            {session && (
              <>
                <div className="border-t border-white/10 pt-2 mt-2 space-y-0.5">
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg text-sm text-neutral-400">
                    <span className="font-medium">Online</span>
                    <span className="text-cyan-300 font-semibold">{onlineUsers.length}</span>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg text-sm text-neutral-400">
                    <span className="font-medium">Ongoing games</span>
                    <span className="text-cyan-300 font-semibold">{ongoingGames.length}</span>
                  </div>
                  {ongoingQueueMatchId && (
                    <Link
                      href={`/queue-match/${ongoingQueueMatchId}`}
                      onClick={() => setMobileMenuOpen(false)}
                      className="block px-3 py-2.5 rounded-lg text-sm font-semibold bg-red-500/15 text-red-300 border border-red-400/40 hover:bg-red-500/25 transition-colors"
                    >
                      Go to ongoing game
                    </Link>
                  )}
                  {queueData?.myEntry ? (
                    <div className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm bg-red-500/10 border border-red-400/30">
                      <span className="text-red-300 font-medium">In queue · {queueData.myEntry.label}</span>
                      <div className="flex items-center gap-3">
                        <span className="tabular-nums font-mono text-red-200 text-xs">{formatTimer(queueTimerSeconds)}</span>
                        <button type="button" onClick={handleLeaveQueue} className="text-xs text-neutral-400 hover:text-red-300 transition-colors">Leave</button>
                      </div>
                    </div>
                  ) : queueData ? (
                    <div className="flex items-center justify-between px-3 py-2 rounded-lg text-sm text-neutral-400">
                      <span className="font-medium">Queue</span>
                      <span className="text-cyan-300 font-semibold">
                        {(["lol", "ow", "sc", "battlerite"] as const).reduce((s, g) => s + (queueData.playersByGame[g]?.length ?? 0), 0)} players
                      </span>
                    </div>
                  ) : null}
                </div>

                <div className="border-t border-white/10 pt-2 mt-2 space-y-0.5">
                  <Link
                    href="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-cyan-200 hover:bg-cyan-500/10 transition-colors"
                  >
                    <PersonIcon sx={{ fontSize: 18 }} />
                    {session.user?.name ?? "Profile"}
                  </Link>
                  <button
                    type="button"
                    onClick={() => { signOut({ callbackUrl: "/" }); setMobileMenuOpen(false); }}
                    className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-400 hover:text-pink-200 hover:bg-pink-500/10 transition-colors"
                  >
                    Log out
                  </button>
                </div>
              </>
            )}
            {!session && status !== "loading" && (
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-400 hover:text-pink-200 hover:bg-pink-500/10 transition-colors"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      )}

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
          <MatchFoundModal
            matchedGame={matchedGameFromQueue}
            onClose={() => {
              setMatchedGameFromQueue(null);
            }}
            onAcceptAndGo={(id) => {
              setMatchedGameFromQueue(null);
              router.push(`/queue-match/${id}`);
            }}
            onDecline={() => setMatchedGameFromQueue(null)}
          />,
          document.body
        )}

    </nav>
  );
}
