"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import SearchIcon from "@mui/icons-material/Search";
import PersonIcon from "@mui/icons-material/Person";
import CloseIcon from "@mui/icons-material/Close";

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
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) {
      setActiveGamesCount(0);
      return;
    }
    const fetchCount = () => {
      fetch("/api/team-builder/games?status=pending", { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : { games: [] }))
        .then((data) => setActiveGamesCount((data.games ?? []).length))
        .catch(() => setActiveGamesCount(0));
    };
    fetchCount();
    const interval = setInterval(fetchCount, 15000);
    return () => clearInterval(interval);
  }, [status, session?.user]);

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
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="flex items-center justify-between h-14">
          <Link
            href="/"
            className="text-lg font-semibold text-white hover:text-cyan-300 transition-colors flex items-center gap-1.5"
          >
            <img src="/yin-yang.png" alt="" aria-hidden className="h-6 w-6 block bg-transparent mix-blend-multiply" />
            INTRA
          </Link>

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
    </nav>
  );
}
