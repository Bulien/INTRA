"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { balanceTeams, type Player } from "@/lib/teamBalancer";
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Typography,
  Slider,
  Divider,
  Tooltip,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import ShuffleIcon from "@mui/icons-material/Shuffle";
import HistoryIcon from "@mui/icons-material/History";
import PersonIcon from "@mui/icons-material/Person";
import { sanitizeDisplayName } from "@/lib/sanitizeInput";
import { MatchCard, TeamColumn, TeamPlayerRow, VsDivider } from "@/components/MatchCard";

const GAMES = [
  { value: "lol", label: "LoL", maxPlayers: 10 },
  { value: "ow", label: "Overwatch", maxPlayers: 12 },
  { value: "sc", label: "Survival Chaos", maxPlayers: 4 },
  { value: "battlerite", label: "Battlerite", maxPlayers: 6 },
];

const TEAM_BUILDER_STORAGE_KEY = "team-balancer-team-builder-players";

function capitalizeFirst(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

async function loadRankingPlayers(
  gameType: string,
  season: number
): Promise<{ playerNames: string[]; maxSeason: number }> {
  try {
    const res = await fetch(
      `/api/ranking/${gameType}?season=${season}`,
      { cache: "no-store" }
    );
    if (!res.ok) return { playerNames: [], maxSeason: 1 };
    const data = await res.json();
    const playerNames = (data.players ?? [])
      .map((r: { playerName: string }) => r.playerName)
      .filter(Boolean);
    const maxSeason = data.maxSeason ?? 1;
    return { playerNames, maxSeason };
  } catch {
    return { playerNames: [], maxSeason: 1 };
  }
}

async function recordWin(
  gameType: string,
  season: number,
  winningPlayerNames: string[],
  losingPlayerNames: string[]
) {
  try {
    const res = await fetch(
      `/api/ranking/${gameType}?season=${season}`,
      { cache: "no-store" }
    );
    const data = res.ok ? await res.json() : { players: [], validatedGameIndices: [], validatedPlayerIds: [] };
    const rows: { id: string; playerName: string; scores: (number | null)[] }[] =
      data.players ?? [];
    const existingValidated: number[] = data.validatedGameIndices ?? [];
    const existingValidatedPlayerIds: string[] = data.validatedPlayerIds ?? [];

    const maxGameCount =
      rows.length > 0 ? Math.max(...rows.map((r) => r.scores.length)) : 0;

    const updatedRows = rows.map((r) => ({ ...r, scores: [...r.scores, null as null] }));

    const setScoreForPlayer = (name: string, score: 0 | 1) => {
      const normalizedName = capitalizeFirst(name.trim());
      let playerRow = updatedRows.find(
        (r) => r.playerName.toLowerCase() === normalizedName.toLowerCase()
      );
      if (!playerRow) {
        playerRow = {
          id: crypto.randomUUID(),
          playerName: normalizedName,
          scores: Array(maxGameCount + 1).fill(null),
        };
        updatedRows.push(playerRow);
      }
      while (playerRow.scores.length < maxGameCount + 1) playerRow.scores.push(null);
      playerRow.scores[playerRow.scores.length - 1] = score;
    };

    winningPlayerNames.forEach((name) => setScoreForPlayer(name, 1));
    losingPlayerNames.forEach((name) => setScoreForPlayer(name, 0));

    const finalMaxCols = Math.max(...updatedRows.map((r) => r.scores.length));
    updatedRows.forEach((r) => {
      while (r.scores.length < finalMaxCols) r.scores.push(null);
    });

    const newGameIndex = finalMaxCols - 1;
    const importedPlayerIds = updatedRows.map((p) => p.id);
    const mergedValidatedPlayerIds = [
      ...new Set([...existingValidatedPlayerIds, ...importedPlayerIds]),
    ];
    await fetch(`/api/ranking/${gameType}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        season,
        players: updatedRows,
        validatedGameIndices: [...existingValidated, newGameIndex],
        validatedPlayerIds: mergedValidatedPlayerIds,
      }),
    });

    window.dispatchEvent(new CustomEvent("rankingUpdated", { detail: { gameType } }));
  } catch (error) {
    console.error("Failed to record win:", error);
  }
}

function loadTeamBuilderPlayers(): Player[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TEAM_BUILDER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : [];
  } catch {
    return [];
  }
}

function saveTeamBuilderPlayers(players: Player[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TEAM_BUILDER_STORAGE_KEY, JSON.stringify(players));
  } catch {
    // ignore
  }
}

type SharedGame = {
  id: string;
  gameType: string;
  season: number;
  teamA: Player[];
  teamB: Player[];
  status: string;
  winner: string | null;
  createdAt: string;
  createdById?: string;
  createdByName: string;
};

async function fetchActiveGames(): Promise<SharedGame[]> {
  const res = await fetch("/api/team-builder/games?status=pending", { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  const games = data.games ?? [];
  return games.filter((g: { source?: string }) => g.source !== "ranked_queue");
}

async function createSharedGame(
  gameType: string,
  season: number,
  teamA: Player[],
  teamB: Player[]
): Promise<{ ok: boolean; game?: SharedGame | null; error?: string }> {
  const res = await fetch("/api/team-builder/games", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gameType, season, teamA, teamB }),
  });
  const data = res.ok ? await res.json() : await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: (data as { error?: string }).error ?? "Failed to create game" };
  }
  return { ok: true, game: data as SharedGame };
}

async function submitSharedGameResult(
  gameId: string,
  winnerOrPlacements: "yin" | "yang" | { playerName: string; placement: number }[]
): Promise<{ ok: boolean; error?: string }> {
  const isPlacements = Array.isArray(winnerOrPlacements);
  const body = isPlacements ? { placements: winnerOrPlacements } : { winner: winnerOrPlacements };
  const res = await fetch(`/api/team-builder/games/${gameId}/result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = res.ok ? undefined : await res.json().catch(() => ({}));
  return { ok: res.ok, error: (data as { error?: string })?.error ?? (res.ok ? undefined : "Submit failed") };
}

async function finishSharedGame(gameId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/team-builder/games/${gameId}/finish`, { method: "POST" });
  const data = res.ok ? undefined : await res.json().catch(() => ({}));
  return { ok: res.ok, error: (data as { error?: string })?.error ?? (res.ok ? undefined : "Failed to finish game") };
}

async function cancelSharedGame(gameId: string): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/team-builder/games/${gameId}/cancel`, { method: "POST" });
  const data = res.ok ? undefined : await res.json().catch(() => ({}));
  return { ok: res.ok, error: (data as { error?: string })?.error ?? (res.ok ? undefined : "Failed to cancel game") };
}

export default function TeamBuilderPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [newName, setNewName] = useState("");
  const [selectedGame, setSelectedGame] = useState("lol");
  const [maxSeason, setMaxSeason] = useState(1);
  const [existingPlayers, setExistingPlayers] = useState<string[]>([]);
  const [registeredUserNames, setRegisteredUserNames] = useState<string[]>([]);
  const { data: session } = useSession();
  const [refillResult, setRefillResult] = useState<ReturnType<typeof balanceTeams> | null>(null);
  const result = refillResult ?? balanceTeams(players);
  const [activeSharedGames, setActiveSharedGames] = useState<SharedGame[]>([]);
  const [creatingGame, setCreatingGame] = useState(false);
  const [startGameError, setStartGameError] = useState<string | null>(null);
  const [finishingGameId, setFinishingGameId] = useState<string | null>(null);
  const [cancellingGameId, setCancellingGameId] = useState<string | null>(null);
  const [canValidate, setCanValidate] = useState(false);
  const [validateUserCount, setValidateUserCount] = useState(0);
  const [minRequiredByGame, setMinRequiredByGame] = useState<Record<string, number>>({ lol: 6, ow: 6, sc: 3, battlerite: 6 });
  const [playerSuggestions, setPlayerSuggestions] = useState<string[]>([]);
  const [playerSuggestionsLoading, setPlayerSuggestionsLoading] = useState(false);
  const [playerSuggestionsIndex, setPlayerSuggestionsIndex] = useState(0);
  const [playerInputFocused, setPlayerInputFocused] = useState(false);
  const [addPlayerError, setAddPlayerError] = useState<string | null>(null);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editSuggestions, setEditSuggestions] = useState<string[]>([]);
  const [editSuggestionsIndex, setEditSuggestionsIndex] = useState(0);
  const [editSuggestionsLoading, setEditSuggestionsLoading] = useState(false);
  const [editDropdownRect, setEditDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const [averageRatingsByPlayer, setAverageRatingsByPlayer] = useState<Record<string, number>>({});
  const [scPlacementsGame, setScPlacementsGame] = useState<SharedGame | null>(null);
  const [scPlacements, setScPlacements] = useState<Record<string, number>>({});
  const [scPlacementsError, setScPlacementsError] = useState<string | null>(null);
  const playerInputRef = useRef<HTMLInputElement>(null);
  const playerInputContainerRef = useRef<HTMLDivElement>(null);
  const editInputContainerRef = useRef<HTMLDivElement>(null);

  const registeredSet = useMemo(
    () => new Set((registeredUserNames ?? []).map((n) => String(n).trim().toLowerCase())),
    [registeredUserNames]
  );

  useEffect(() => {
    setPlayers(loadTeamBuilderPlayers());
  }, []);

  useEffect(() => {
    const cached = localStorage.getItem("team-builder-game-type");
    if (cached && GAMES.some((g) => g.value === cached)) {
      setSelectedGame(cached);
    }
  }, []);

  useEffect(() => {
    if (players.length === 0 || !selectedGame) {
      setAverageRatingsByPlayer({});
      return;
    }
    const names = players.map((p) => p.name.trim().toLowerCase()).filter(Boolean);
    if (names.length === 0) return;
    fetch(`/api/team-builder/average-ratings?gameType=${encodeURIComponent(selectedGame)}&names=${encodeURIComponent(names.join(","))}`)
      .then((res) => (res.ok ? res.json() : { averages: {} }))
      .then((data) => setAverageRatingsByPlayer(data.averages ?? {}))
      .catch(() => setAverageRatingsByPlayer({}));
  }, [players, selectedGame]);

  const fetchCanValidate = useCallback(() => {
    fetch("/api/team-builder/can-validate", { cache: "no-store" })
      .then((res) => res.ok ? res.json() : { canValidate: false, userCount: 0, minRequiredByGame: {} })
      .then((data) => {
        setCanValidate(Boolean(data.canValidate));
        setValidateUserCount(Number(data.userCount) || 0);
        setMinRequiredByGame(data.minRequiredByGame ?? { lol: 6, ow: 6, sc: 3, battlerite: 6 });
      })
      .catch(() => { setCanValidate(false); setValidateUserCount(0); setMinRequiredByGame({}); });
  }, []);

  useEffect(() => {
    fetchCanValidate();
  }, [fetchCanValidate]);

  // Refetch when shared games are shown so we never show buttons with stale count
  useEffect(() => {
    if (activeSharedGames.length > 0) {
      fetchCanValidate();
    }
  }, [activeSharedGames.length, fetchCanValidate]);

  useEffect(() => {
    setRefillResult(null);
  }, [players]);

  useEffect(() => {
    if (players.length > 0) {
      saveTeamBuilderPlayers(players);
    }
  }, [players]);

  useEffect(() => {
    loadRankingPlayers(selectedGame, 1).then(({ maxSeason: ms }) => {
      setMaxSeason(ms);
      return loadRankingPlayers(selectedGame, ms);
    }).then(({ playerNames }) => {
      setExistingPlayers(playerNames);
    });
  }, [selectedGame]);

  useEffect(() => {
    if (!session?.user) {
      setRegisteredUserNames([]);
      return;
    }
    fetch("/api/users/names")
      .then((res) => res.json())
      .then((data) => setRegisteredUserNames(data.names ?? []))
      .catch(() => setRegisteredUserNames([]));
  }, [session?.user]);

  // Position dropdown in portal so it isn't cropped
  useEffect(() => {
    if (!playerInputFocused || playerSuggestions.length === 0) {
      setDropdownRect(null);
      return;
    }
    const el = playerInputContainerRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setDropdownRect({ top: r.bottom + 4, left: r.left, width: r.width });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [playerInputFocused, playerSuggestions.length]);

  // Clear add-player error when user types
  useEffect(() => {
    setAddPlayerError(null);
  }, [newName]);

  // Debounced user search for player name (100ms) + local filter
  useEffect(() => {
    const q = newName.trim();
    const local = [...new Set([...existingPlayers, ...registeredUserNames])].filter(
      (n) => n && q && n.toLowerCase().includes(q.toLowerCase())
    );
    if (!q) {
      setPlayerSuggestions([]);
      setPlayerSuggestionsIndex(0);
      return;
    }
    const t = setTimeout(async () => {
      if (q.length >= 2) {
        setPlayerSuggestionsLoading(true);
        try {
          const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
          const data = await res.json();
          const users = (data.users ?? []) as { username: string; name: string }[];
          const fromApi = users.map((u) => (u.name && u.name !== u.username ? `${u.name} (@${u.username})` : u.username));
          const merged = [...local, ...fromApi].filter(Boolean);
          const seen = new Set<string>();
          const unique = merged.filter((s) => {
            const k = s.trim().toLowerCase();
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          });
          setPlayerSuggestions(unique);
        } catch {
          setPlayerSuggestions(local);
        } finally {
          setPlayerSuggestionsLoading(false);
        }
      } else {
        const seen = new Set<string>();
        const uniqueLocal = local.filter((s) => {
          const k = s.trim().toLowerCase();
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        setPlayerSuggestions(uniqueLocal);
      }
      setPlayerSuggestionsIndex(0);
    }, 100);
    return () => clearTimeout(t);
  }, [newName, existingPlayers, registeredUserNames]);

  const editingName = editingPlayerId ? (players.find((p) => p.id === editingPlayerId)?.name ?? "") : "";

  useEffect(() => {
    if (!editingPlayerId) {
      setEditSuggestions([]);
      setEditSuggestionsIndex(0);
      return;
    }
    const q = editingName.trim();
    const local = [...new Set([...existingPlayers, ...registeredUserNames])].filter(
      (n) => n && q && n.toLowerCase().includes(q.toLowerCase())
    );
    if (!q) {
      setEditSuggestions([]);
      setEditSuggestionsIndex(0);
      return;
    }
    const t = setTimeout(async () => {
      if (q.length >= 2) {
        setEditSuggestionsLoading(true);
        try {
          const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
          const data = await res.json();
          const users = (data.users ?? []) as { username: string; name: string }[];
          const fromApi = users.map((u) => (u.name && u.name !== u.username ? `${u.name} (@${u.username})` : u.username));
          const merged = [...local, ...fromApi].filter(Boolean);
          const seen = new Set<string>();
          const unique = merged.filter((s) => {
            const k = s.trim().toLowerCase();
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          });
          setEditSuggestions(unique);
        } catch {
          setEditSuggestions(local);
        } finally {
          setEditSuggestionsLoading(false);
        }
      } else {
        const seen = new Set<string>();
        const uniqueLocal = local.filter((s) => {
          const k = s.trim().toLowerCase();
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        setEditSuggestions(uniqueLocal);
      }
      setEditSuggestionsIndex(0);
    }, 100);
    return () => clearTimeout(t);
  }, [editingPlayerId, editingName, existingPlayers, registeredUserNames]);

  useEffect(() => {
    if (!editingPlayerId || editSuggestions.length === 0) {
      setEditDropdownRect(null);
      return;
    }
    const el = editInputContainerRef.current;
    if (!el) return;
    const update = () => {
      const r = el.getBoundingClientRect();
      setEditDropdownRect({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 200) });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [editingPlayerId, editSuggestions.length]);

  useEffect(() => {
    if (!session?.user) {
      setActiveSharedGames([]);
      return;
    }
    fetchActiveGames().then(setActiveSharedGames);
  }, [session?.user]);

  // Poll for new shared games so receiving users see updates without refreshing
  useEffect(() => {
    if (!session?.user) return;
    const interval = setInterval(() => {
      fetchActiveGames().then(setActiveSharedGames);
    }, 5000);
    return () => clearInterval(interval);
  }, [session?.user]);

  const updatePlayer = useCallback((id: string, updates: Partial<Player>) => {
    setPlayers((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  }, []);

  const setRating = useCallback((id: string, v: number) => {
    updatePlayer(id, { rating: Math.round(Math.min(10, Math.max(1, v))) });
  }, [updatePlayer]);

  const handleNameChange = useCallback((id: string, value: string) => {
    const safe = sanitizeDisplayName(value);
    const capitalized = capitalizeFirst(safe);
    updatePlayer(id, { name: capitalized });
  }, [updatePlayer]);

  const selectedGameConfig = GAMES.find((g) => g.value === selectedGame);
  const maxPlayers = selectedGameConfig?.maxPlayers ?? 99;

  const addPlayer = useCallback(() => {
    const name = newName.trim();
    if (!name) return;

    setAddPlayerError(null);
    if (players.length >= maxPlayers) {
      setAddPlayerError(`${selectedGameConfig?.label ?? selectedGame} allows max ${maxPlayers} players.`);
      return;
    }

    const capitalized = capitalizeFirst(name);

    const alreadyInList = players.some(
      (p) => p.name.trim().toLowerCase() === capitalized.toLowerCase()
    );
    if (alreadyInList) {
      setAddPlayerError("Already in the list");
      return;
    }

    const id = crypto.randomUUID();
    const fromRegistered = [...existingPlayers, ...registeredUserNames].find(
      (p) => p.toLowerCase() === capitalized.toLowerCase()
    );
    setPlayers((prev) => [...prev, { id, name: fromRegistered || capitalized, rating: 5 }]);
    setNewName("");
  }, [newName, players, existingPlayers, registeredUserNames, selectedGame, selectedGameConfig?.label, maxPlayers]);

  const removePlayer = useCallback((id: string) => {
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const resetPlayers = useCallback(() => {
    if (confirm("Reset all players? This will clear the current team.")) {
      setPlayers([]);
      saveTeamBuilderPlayers([]);
    }
  }, []);

  const [lastGameLoading, setLastGameLoading] = useState(false);
  const [lastGameError, setLastGameError] = useState<string | null>(null);
  useEffect(() => {
    setLastGameError(null);
  }, [selectedGame]);

  const loadLastGame = useCallback(async () => {
    setLastGameError(null);
    setLastGameLoading(true);
    try {
      const res = await fetch(`/api/team-builder/last-game?gameType=${encodeURIComponent(selectedGame)}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLastGameError((data as { error?: string }).error ?? "Failed to load last game");
        return;
      }
      const game = (data as { game: { teamA: { id: string; name: string; rating?: number }[]; teamB: { id: string; name: string; rating?: number }[] } | null }).game;
      if (!game?.teamA?.length && !game?.teamB?.length) {
        setLastGameError("No submitted game found for this game type.");
        return;
      }
      const all = [...(game.teamA ?? []), ...(game.teamB ?? [])];
      const seen = new Set<string>();
      const unique = all.filter((p) => {
        const key = (p.name ?? "").trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const playersFromLast: Player[] = unique.map((p, i) => ({
        id: `last-${i}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: (p.name ?? "").trim() || "Unknown",
        rating: typeof p.rating === "number" && p.rating >= 1 && p.rating <= 10 ? p.rating : 5,
      }));
      setPlayers(playersFromLast);
      saveTeamBuilderPlayers(playersFromLast);
    } catch {
      setLastGameError("Failed to load last game");
    } finally {
      setLastGameLoading(false);
    }
  }, [selectedGame]);

  const refillTeams = useCallback(() => {
    setRefillResult(balanceTeams(players, { shuffleSameRating: true }));
  }, [players]);

  const handleStartGame = useCallback(async () => {
    if (!session?.user || result.teamA.length === 0 || result.teamB.length === 0) return;
    setStartGameError(null);
    setCreatingGame(true);
    try {
      const result_ = await createSharedGame(
        selectedGame,
        maxSeason,
        result.teamA,
        result.teamB
      );
      if (result_.ok && result_.game) {
        setActiveSharedGames((prev) => [result_.game!, ...prev]);
      } else if (result_.error) {
        setStartGameError(result_.error);
      }
    } finally {
      setCreatingGame(false);
    }
  }, [session?.user, result.teamA, result.teamB, selectedGame, maxSeason]);

  const [submitSharedError, setSubmitSharedError] = useState<string | null>(null);

  const handleSubmitSharedResult = useCallback(
    async (gameId: string, winner: "yin" | "yang") => {
      setSubmitSharedError(null);
      const { ok, error } = await submitSharedGameResult(gameId, winner);
      if (ok) {
        setActiveSharedGames((prev) => prev.filter((g) => g.id !== gameId));
        window.dispatchEvent(new CustomEvent("rankingUpdated", { detail: { gameType: selectedGame } }));
        closeConfirmWin();
      } else {
        setSubmitSharedError(error ?? "Submit failed");
      }
    },
    [selectedGame]
  );

  const openScPlacementsDialog = useCallback((game: SharedGame) => {
    const minRequired = minRequiredByGame[game.gameType] ?? 6;
    if (validateUserCount < minRequired) {
      setResultBlockedMessage(`Result submission requires at least ${minRequired} registered players (${validateUserCount} currently).`);
      setTimeout(() => setResultBlockedMessage(null), 5000);
      return;
    }
    const regSet = new Set((registeredUserNames ?? []).map((n) => String(n).trim().toLowerCase()));
    const registeredInGame = [...game.teamA, ...game.teamB].filter(
      (p) => (p.name ?? "").trim() !== "" && regSet.has((p.name ?? "").trim().toLowerCase())
    ).length;
    if (registeredInGame < 3) {
      setResultBlockedMessage("At least 3 players in the game must have an account to submit results.");
      setTimeout(() => setResultBlockedMessage(null), 5000);
      return;
    }
    setScPlacementsError(null);
    setScPlacementsGame(game);
    setScPlacements({});
  }, [minRequiredByGame, validateUserCount, registeredUserNames]);

  const handleSubmitScPlacements = useCallback(async () => {
    if (!scPlacementsGame) return;
    const allPlayers = [...scPlacementsGame.teamA, ...scPlacementsGame.teamB].map((p) => (p.name ?? "").trim()).filter(Boolean);
    const placements = allPlayers.map((name) => ({ playerName: name, placement: scPlacements[name] }));
    const used = new Set(placements.map((p) => p.placement));
    if (placements.some((p) => !p.placement || p.placement < 1 || p.placement > 4)) {
      setScPlacementsError("Each player must have a placement from 1 to 4.");
      return;
    }
    if (used.size !== 4 || !used.has(1) || !used.has(2) || !used.has(3) || !used.has(4)) {
      setScPlacementsError("Placements must be 1, 2, 3, and 4 (each used exactly once).");
      return;
    }
    setScPlacementsError(null);
    const { ok, error } = await submitSharedGameResult(scPlacementsGame.id, placements);
    if (ok) {
      setActiveSharedGames((prev) => prev.filter((g) => g.id !== scPlacementsGame.id));
      window.dispatchEvent(new CustomEvent("rankingUpdated", { detail: { gameType: "sc" } }));
      setScPlacementsGame(null);
      setScPlacements({});
    } else {
      setScPlacementsError(error ?? "Submit failed");
    }
  }, [scPlacementsGame, scPlacements]);

  const handleFinishGame = useCallback(async (gameId: string) => {
    setFinishingGameId(gameId);
    const { ok, error } = await finishSharedGame(gameId);
    setFinishingGameId(null);
    if (ok) {
      setActiveSharedGames((prev) => prev.filter((g) => g.id !== gameId));
    } else {
      setResultBlockedMessage(error ?? "Failed to finish game");
      setTimeout(() => setResultBlockedMessage(null), 5000);
    }
  }, []);

  const handleCancelGame = useCallback(async (gameId: string) => {
    setCancellingGameId(gameId);
    const { ok, error } = await cancelSharedGame(gameId);
    setCancellingGameId(null);
    if (ok) {
      setActiveSharedGames((prev) => prev.filter((g) => g.id !== gameId));
    } else {
      setResultBlockedMessage(error ?? "Failed to cancel game");
      setTimeout(() => setResultBlockedMessage(null), 5000);
    }
  }, []);

  const handleTeamWin = useCallback(async (team: "yin" | "yang") => {
    const winningTeam = team === "yin" ? result.teamA : result.teamB;
    const losingTeam = team === "yin" ? result.teamB : result.teamA;
    const winningNames = winningTeam.map((p) => p.name);
    const losingNames = losingTeam.map((p) => p.name);
    await recordWin(selectedGame, maxSeason, winningNames, losingNames);
  }, [result, selectedGame, maxSeason]);

  const [confirmWinOpen, setConfirmWinOpen] = useState(false);
  const [confirmWinTeam, setConfirmWinTeam] = useState<"yin" | "yang" | null>(null);
  const [confirmSharedGameId, setConfirmSharedGameId] = useState<string | null>(null);
  const userName = session?.user?.name?.trim() ?? session?.user?.email?.trim() ?? "";
  const userInYin = userName
    ? result.teamA.some((p) => p.name.trim().toLowerCase() === userName.toLowerCase())
    : false;
  const userInYang = userName
    ? result.teamB.some((p) => p.name.trim().toLowerCase() === userName.toLowerCase())
    : false;
  const canSubmitYinWon = userInYang;
  const canSubmitYangWon = userInYin;

  const openConfirmWin = (team: "yin" | "yang") => {
    if (!session?.user) return;
    if (team === "yin" && !canSubmitYinWon) return;
    if (team === "yang" && !canSubmitYangWon) return;
    setConfirmSharedGameId(null);
    setConfirmWinTeam(team);
    setConfirmWinOpen(true);
  };

  const [resultBlockedMessage, setResultBlockedMessage] = useState<string | null>(null);
  const openConfirmSharedResult = (gameId: string, winner: "yin" | "yang") => {
    const game = activeSharedGames.find((g) => g.id === gameId);
    const minRequired = game ? (minRequiredByGame[game.gameType] ?? 6) : 6;
    if (validateUserCount < minRequired) {
      setResultBlockedMessage(`Result submission requires at least ${minRequired} registered players (${validateUserCount} currently).`);
      setTimeout(() => setResultBlockedMessage(null), 5000);
      return;
    }
    if (!game) return;
    {
      const regSet = new Set((registeredUserNames ?? []).map((n) => String(n).trim().toLowerCase()));
      const registeredInGame = [...game.teamA, ...game.teamB].filter(
        (p) => (p.name ?? "").trim() !== "" && regSet.has((p.name ?? "").trim().toLowerCase())
      ).length;
      const isLolOrOw = game.gameType === "lol" || game.gameType === "ow";
      if (isLolOrOw) {
        if (registeredInGame < 6) {
          setResultBlockedMessage("At least 6 players in the game must have an account to submit results for LoL/Overwatch.");
          setTimeout(() => setResultBlockedMessage(null), 5000);
          return;
        }
      } else {
        const allReg = [...game.teamA, ...game.teamB].every(
          (p) => (p.name ?? "").trim() === "" || regSet.has((p.name ?? "").trim().toLowerCase())
        );
        if (!allReg) {
          setResultBlockedMessage("All players in the game must have an account to submit results.");
          setTimeout(() => setResultBlockedMessage(null), 5000);
          return;
        }
      }
    }
    setSubmitSharedError(null);
    setConfirmSharedGameId(gameId);
    setConfirmWinTeam(winner);
    setConfirmWinOpen(true);
  };

  const baseCanRecordWin = Boolean(session?.user);
  const canRecordWinYin = baseCanRecordWin && canSubmitYinWon;
  const canRecordWinYang = baseCanRecordWin && canSubmitYangWon;

  const closeConfirmWin = () => {
    setConfirmWinOpen(false);
    setConfirmWinTeam(null);
    setConfirmSharedGameId(null);
    setSubmitSharedError(null);
  };

  const closeScPlacementsDialog = () => {
    setScPlacementsGame(null);
    setScPlacements({});
    setScPlacementsError(null);
  };

  const onConfirmWin = useCallback(async () => {
    if (!confirmWinTeam) return;
    if (confirmSharedGameId) {
      await handleSubmitSharedResult(confirmSharedGameId, confirmWinTeam);
    } else {
      await handleTeamWin(confirmWinTeam);
      closeConfirmWin();
    }
  }, [confirmWinTeam, confirmSharedGameId, handleTeamWin, handleSubmitSharedResult]);

  const [chronoSeconds, setChronoSeconds] = useState(0);
  const [chronoRunning, setChronoRunning] = useState(true);
  useEffect(() => {
    if (!chronoRunning) return;
    const id = setInterval(() => setChronoSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [chronoRunning]);
  const chronoDisplay = `${Math.floor(chronoSeconds / 60)}:${String(chronoSeconds % 60).padStart(2, "0")}`;

  const hasActiveSharedGame = Boolean(session?.user && activeSharedGames.length > 0);
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";
  /** When user has any active shared game (they're in it), show only the result-posting view — no going back to builder. */
  const showOnlySharedGames = Boolean(session?.user && activeSharedGames.length > 0);

  const bannedUntilIso = (session?.user as { bannedUntil?: string | null } | undefined)?.bannedUntil;
  const isBanned =
    Boolean(session?.user && bannedUntilIso) && new Date(bannedUntilIso!) > new Date();

  function formatTimeLeft(until: string): string {
    const end = new Date(until).getTime();
    const now = Date.now();
    const ms = Math.max(0, end - now);
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000));
    const parts: string[] = [];
    if (days > 0) parts.push(`${days} day${days !== 1 ? "s" : ""}`);
    if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? "s" : ""}`);
    if (minutes > 0 || parts.length === 0) parts.push(`${minutes} minute${minutes !== 1 ? "s" : ""}`);
    return parts.join(", ");
  }

  if (isBanned && bannedUntilIso) {
    return (
      <Box
        sx={{
          minHeight: "calc(100vh - 8rem)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          py: 4,
          px: 2,
        }}
      >
        <Card
          sx={{
            maxWidth: 420,
            border: "2px solid",
            borderColor: "error.main",
            bgcolor: "background.paper",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          }}
        >
          <CardContent sx={{ py: 3, px: 3, textAlign: "center" }}>
            <Typography variant="h5" sx={{ color: "error.main", fontWeight: 700, mb: 1 }}>
              Account suspended
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              Your account is temporarily banned from using the Team Builder.
            </Typography>
            <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 600 }}>
              Time left: {formatTimeLeft(bannedUntilIso)}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              Ban expires: {new Date(bannedUntilIso).toLocaleString()}
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <>
      {showOnlySharedGames ? (
      <Box sx={{ minHeight: "calc(100vh - 8rem)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", py: 4 }}>
        <Typography variant="overline" sx={{ display: "block", color: "rgba(255,255,255,0.5)", letterSpacing: 1, mb: 2 }}>
          Team Builder
        </Typography>
        <Box sx={{ width: "100%", maxWidth: 640, mx: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
          {activeSharedGames.map((game) => {
            const un = (session?.user?.name ?? session?.user?.email ?? "").trim().toLowerCase();
            const inYin = game.teamA.some((p) => (p.name ?? "").trim().toLowerCase() === un);
            const inYang = game.teamB.some((p) => (p.name ?? "").trim().toLowerCase() === un);
            const isCreator = Boolean(game.createdById && session?.user?.id && game.createdById === session.user.id);
            const canYin = inYang || (isCreator && isAdmin);
            const canYang = inYin || (isCreator && isAdmin);
            const registeredNorm = new Set((registeredUserNames ?? []).map((n) => String(n).trim().toLowerCase()));
            const allPlayersRegistered = [...game.teamA, ...game.teamB].every(
              (p) => (p.name ?? "").trim() === "" || registeredNorm.has((p.name ?? "").trim().toLowerCase())
            );
            const registeredInGame = [...game.teamA, ...game.teamB].filter(
              (p) => (p.name ?? "").trim() !== "" && registeredNorm.has((p.name ?? "").trim().toLowerCase())
            ).length;
            const minRequiredThisGame = minRequiredByGame[game.gameType] ?? 6;
            const isLolOrOw = game.gameType === "lol" || game.gameType === "ow";
            const canSubmitThisGame =
              validateUserCount >= minRequiredThisGame &&
              (game.gameType === "sc"
                ? registeredInGame >= 3
                : isLolOrOw
                  ? registeredInGame >= 6
                  : allPlayersRegistered);
            const gameLabel = GAMES.find((g) => g.value === game.gameType)?.label ?? game.gameType;
            const teamAScore = game.teamA.reduce((s, p) => s + (p.rating ?? 0), 0);
            const teamBScore = game.teamB.reduce((s, p) => s + (p.rating ?? 0), 0);
            return (
              <MatchCard
                key={game.id}
                overline="Team builder"
                title={gameLabel}
                meta={`Season ${game.season} · by ${game.createdByName}`}
                headerAction={isCreator ? (
                  <Button size="small" variant="outlined" disabled={cancellingGameId === game.id} onClick={() => handleCancelGame(game.id)}
                    sx={{ borderColor: "rgba(239,68,68,0.5)", color: "#fca5a5", "&:hover": { borderColor: "#ef4444", bgcolor: "rgba(239,68,68,0.1)" } }}>
                    {cancellingGameId === game.id ? "Cancelling…" : "Cancel game"}
                  </Button>
                ) : undefined}
                footer={
                  <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                    {canSubmitThisGame ? (
                      game.gameType === "sc" ? (
                        <Button fullWidth variant="contained" size="large" onClick={() => openScPlacementsDialog(game)}
                          sx={{ py: 1.5, bgcolor: "#67e8f9", color: "#0f0f0f", fontWeight: 700, "&:hover": { bgcolor: "#22d3ee" } }}>
                          Submit placements (1st–4th)
                        </Button>
                      ) : (
                        <>
                          <Button fullWidth variant="contained" size="large" disabled={!canYin} onClick={() => openConfirmSharedResult(game.id, "yin")}
                            sx={{ py: 1.5, bgcolor: "#67e8f9", color: "#0f0f0f", fontWeight: 700, "&:hover": { bgcolor: "#22d3ee" } }}>Yin Won</Button>
                          <Button fullWidth variant="contained" size="large" disabled={!canYang} onClick={() => openConfirmSharedResult(game.id, "yang")}
                            sx={{ py: 1.5, bgcolor: "#f9a8d4", color: "#0f0f0f", fontWeight: 700, "&:hover": { bgcolor: "#f472b6" } }}>Yang Won</Button>
                        </>
                      )
                    ) : (
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, width: "100%" }}>
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
                          {validateUserCount < minRequiredThisGame ? `Result submission requires at least ${minRequiredThisGame} registered players (${validateUserCount} currently).`
                            : game.gameType === "sc" ? "At least 3 players in the game must have an account to submit results."
                            : isLolOrOw ? "At least 6 players in the game must have an account to submit results for LoL/Overwatch."
                            : "All players in the game must have an account to submit results."}
                        </Typography>
                        <Button variant="outlined" size="medium" disabled={finishingGameId === game.id} onClick={() => handleFinishGame(game.id)}
                          sx={{ borderColor: "rgba(255,255,255,0.4)", color: "text.secondary", "&:hover": { borderColor: "rgba(255,255,255,0.6)", bgcolor: "rgba(255,255,255,0.06)" } }}>
                          {finishingGameId === game.id ? "Finishing…" : "Game finished"}
                        </Button>
                      </Box>
                    )}
                  </Box>
                }
              >
                {game.gameType === "sc" ? (
                  <Box sx={{ py: 2, px: 2 }}>
                    <Box component="ul" sx={{ m: 0, py: 1, px: 0, listStyle: "none" }}>
                      {[...game.teamA, ...game.teamB].map((p) => (
                        <TeamPlayerRow key={p.id} name={p.name ?? ""} rating="—" color="#67e8f9">
                          <><Link href={`/profile/${encodeURIComponent((p.name ?? "").trim())}`} className="text-neutral-200 hover:text-cyan-200 hover:underline">{p.name}</Link>
                          {registeredNorm.has((p.name ?? "").trim().toLowerCase()) && <Tooltip title="Has account" placement="top" arrow><PersonIcon sx={{ fontSize: 16, color: "#67e8f9" }} /></Tooltip>}</>
                        </TeamPlayerRow>
                      ))}
                    </Box>
                  </Box>
                ) : (
                  <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: "stretch" }}>
                    <TeamColumn name="Team Yin" totalElo={teamAScore} color="#67e8f9" accent="#67e8f9">
                      {game.teamA.map((p) => {
                        const isYou = Boolean(session?.user && (p.name ?? "").trim().toLowerCase() === (session.user?.name ?? session.user?.email ?? "").trim().toLowerCase());
                        return (
                          <TeamPlayerRow key={p.id} name={p.name ?? ""} rating={p.rating ?? "—"} color="#67e8f9">
                            {isYou ? (
                              <Box component="span" sx={{ border: "1px solid rgba(251, 191, 36, 0.5)", borderRadius: 1.5, boxShadow: "inset 0 0 12px rgba(251, 191, 36, 0.2)", px: 0.5, py: 0.25, display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                                <Link href={`/profile/${encodeURIComponent((p.name ?? "").trim())}`} className="text-cyan-200 hover:underline">{p.name}</Link>
                                {registeredNorm.has((p.name ?? "").trim().toLowerCase()) && <Tooltip title="Has account" placement="top" arrow><PersonIcon sx={{ fontSize: 16, color: "#67e8f9" }} /></Tooltip>}
                              </Box>
                            ) : (
                              <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                                <Link href={`/profile/${encodeURIComponent((p.name ?? "").trim())}`} className="text-neutral-200 hover:text-cyan-200 hover:underline">{p.name}</Link>
                                {registeredNorm.has((p.name ?? "").trim().toLowerCase()) && <Tooltip title="Has account" placement="top" arrow><PersonIcon sx={{ fontSize: 16, color: "#67e8f9" }} /></Tooltip>}
                              </Box>
                            )}
                          </TeamPlayerRow>
                        );
                      })}
                    </TeamColumn>
                    <VsDivider />
                    <TeamColumn name="Team Yang" totalElo={teamBScore} color="#f9a8d4" accent="#f9a8d4">
                      {game.teamB.map((p) => {
                        const isYouB = Boolean(session?.user && (p.name ?? "").trim().toLowerCase() === (session.user?.name ?? session.user?.email ?? "").trim().toLowerCase());
                        return (
                          <TeamPlayerRow key={p.id} name={p.name ?? ""} rating={p.rating ?? "—"} color="#f9a8d4">
                            {isYouB ? (
                              <Box component="span" sx={{ border: "1px solid rgba(251, 191, 36, 0.5)", borderRadius: 1.5, boxShadow: "inset 0 0 12px rgba(251, 191, 36, 0.2)", px: 0.5, py: 0.25, display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                                <Link href={`/profile/${encodeURIComponent((p.name ?? "").trim())}`} className="text-pink-200 hover:underline">{p.name}</Link>
                                {registeredNorm.has((p.name ?? "").trim().toLowerCase()) && <Tooltip title="Has account" placement="top" arrow><PersonIcon sx={{ fontSize: 16, color: "#67e8f9" }} /></Tooltip>}
                              </Box>
                            ) : (
                              <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                                <Link href={`/profile/${encodeURIComponent((p.name ?? "").trim())}`} className="text-neutral-200 hover:text-pink-200 hover:underline">{p.name}</Link>
                                {registeredNorm.has((p.name ?? "").trim().toLowerCase()) && <Tooltip title="Has account" placement="top" arrow><PersonIcon sx={{ fontSize: 16, color: "#67e8f9" }} /></Tooltip>}
                              </Box>
                            )}
                          </TeamPlayerRow>
                        );
                      })}
                    </TeamColumn>
                  </Box>
                )}
              </MatchCard>
            );
          })}
        </Box>
      </Box>
      ) : (
    <Box>
      <div className="flex items-center justify-between gap-4 mb-3">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-cyan-500/30 bg-cyan-500/5"
          role="timer"
          aria-label="Chronomètre"
        >
          <Typography variant="h5" sx={{ fontFamily: "monospace", color: "#67e8f9", fontWeight: 700 }}>
            {chronoDisplay}
          </Typography>
          <Typography variant="body2" sx={{ color: "#a5f3fc", fontWeight: 600, letterSpacing: "0.05em" }}>
            RESPECTE MON TEMPS
          </Typography>
        </div>
        <div className="flex-1" />
      </div>
      {resultBlockedMessage && (
        <Box sx={{ mb: 2, p: 1.5, bgcolor: "error.dark", color: "error.contrastText", borderRadius: 1 }}>
          <Typography variant="body2">{resultBlockedMessage}</Typography>
        </Box>
      )}
      <div className="flex items-start gap-4 mb-3">
        <div className="flex-1">
          <Typography variant="h4" sx={{ mb: 0.5, color: "text.primary" }}>
            Team Builder
          </Typography>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <Typography
            variant="subtitle1"
            sx={{
              fontWeight: 600,
              color: "text.primary",
              letterSpacing: "0.02em",
              px: 1.5,
              py: 0.5,
              borderRadius: 1,
              bgcolor: "rgba(103,232,249,0.12)",
              border: "1px solid rgba(103,232,249,0.25)",
            }}
          >
            Season {maxSeason} (current)
          </Typography>
          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
              {GAMES.map((g) => {
                const isSelected = selectedGame === g.value;
                return (
                  <Box
                    key={g.value}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    aria-label={`${g.label}${isSelected ? " (selected)" : ""}`}
                    onClick={() => {
                      setSelectedGame(g.value);
                      try {
                        localStorage.setItem("team-builder-game-type", g.value);
                      } catch {
                        // ignore
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedGame(g.value);
                        try {
                          localStorage.setItem("team-builder-game-type", g.value);
                        } catch {
                          // ignore
                        }
                      }
                    }}
                    sx={{
                      minWidth: 88,
                      px: 1.5,
                      py: 0.6,
                      borderRadius: 1.5,
                      border: "2px solid",
                      borderColor: isSelected ? "#22c55e" : "rgba(255,255,255,0.12)",
                      bgcolor: isSelected ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.04)",
                      color: isSelected ? "#4ade80" : "text.secondary",
                      fontWeight: 700,
                      fontSize: "0.875rem",
                      textAlign: "center",
                      cursor: "pointer",
                      position: "relative",
                      boxShadow: isSelected ? "0 0 16px rgba(34,197,94,0.3)" : "none",
                      transition: "border-color 0.2s, background-color 0.2s, box-shadow 0.2s, color 0.2s",
                      "&:hover": {
                        borderColor: isSelected ? "#22c55e" : "rgba(34,197,94,0.4)",
                        bgcolor: isSelected ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.08)",
                      },
                    }}
                  >
                    {isSelected && (
                      <Box
                        sx={{
                          position: "absolute",
                          top: 3,
                          right: 5,
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          bgcolor: "#22c55e",
                          boxShadow: "0 0 6px #22c55e",
                        }}
                      />
                    )}
                    {g.label}
                  </Box>
                );
              })}
            </Box>
        </div>
      </div>

      <Card sx={{ mb: 3, border: "1px solid", borderColor: "divider" }}>
        <CardContent sx={{ py: 2 }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addPlayer();
            }}
            className="flex gap-3 items-center flex-wrap"
          >
            <Box ref={playerInputContainerRef} sx={{ position: "relative", width: 220, flexShrink: 0 }}>
              <Box
                sx={{
                  position: "relative",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 1,
                  height: 40,
                  overflow: "hidden",
                  "&:focus-within": { outline: "1px solid", outlineColor: "primary.main", outlineOffset: -1 },
                }}
              >
                <Box
                  sx={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    px: 1.5,
                    pointerEvents: "none",
                    overflow: "hidden",
                    fontSize: "0.875rem",
                  }}
                  aria-hidden
                >
                  {newName ? (
                    <>
                      <span style={{ color: "inherit" }}>{newName}</span>
                      {(() => {
                        const s = playerSuggestions[playerSuggestionsIndex];
                        const suffix = s && newName.trim() && s.toLowerCase().startsWith(newName.trim().toLowerCase())
                          ? s.slice(newName.trim().length)
                          : "";
                        return suffix ? <span style={{ color: "rgba(255,255,255,0.5)" }}>{suffix}</span> : null;
                      })()}
                    </>
                  ) : (
                    <span style={{ color: "rgba(255,255,255,0.5)" }}>Add by name…</span>
                  )}
                </Box>
                <input
                  ref={playerInputRef}
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(sanitizeDisplayName(e.target.value))}
                  onFocus={() => setPlayerInputFocused(true)}
                  onBlur={() => setTimeout(() => setPlayerInputFocused(false), 150)}
                  onKeyDown={(e) => {
                    const suggestion = playerSuggestions[playerSuggestionsIndex];
                    const displaySuggestion = suggestion && suggestion.toLowerCase().startsWith(newName.trim().toLowerCase())
                      ? suggestion.slice(newName.trim().length)
                      : "";
                    if (e.key === "Tab" && suggestion && displaySuggestion) {
                      e.preventDefault();
                      setNewName(suggestion);
                      setPlayerSuggestions([]);
                      return;
                    }
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      if (playerSuggestions.length) setPlayerSuggestionsIndex((i) => (i + 1) % playerSuggestions.length);
                      return;
                    }
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      if (playerSuggestions.length) setPlayerSuggestionsIndex((i) => (i - 1 + playerSuggestions.length) % playerSuggestions.length);
                      return;
                    }
                  }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    padding: "0 14px",
                    fontSize: "0.875rem",
                    color: "transparent",
                    caretColor: "#fff",
                  }}
                  placeholder=""
                />
                {playerSuggestionsLoading && (
                  <Typography component="span" variant="caption" sx={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "text.secondary" }}>
                    …
                  </Typography>
                )}
              </Box>
              {typeof document !== "undefined" &&
                dropdownRect &&
                createPortal(
                  <ul
                    className="list-none fixed max-h-48 overflow-auto rounded-md border border-cyan-500/30 bg-black/95 shadow-xl"
                    style={{
                      top: dropdownRect.top,
                      left: dropdownRect.left,
                      width: dropdownRect.width,
                      zIndex: 1300,
                    }}
                  >
                    {playerSuggestions.map((name, i) => (
                      <li key={name}>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setNewName(name);
                            setPlayerSuggestions([]);
                            playerInputRef.current?.focus();
                          }}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors ${i === playerSuggestionsIndex ? "bg-cyan-500/25 text-cyan-200" : "text-neutral-200 hover:bg-cyan-500/10"}`}
                        >
                          {capitalizeFirst(name)}
                        </button>
                      </li>
                    ))}
                  </ul>,
                  document.body
                )}
            </Box>
            <Button
              type="submit"
              variant="contained"
              startIcon={<AddIcon />}
              disabled={players.length >= maxPlayers}
              sx={{ bgcolor: "#67e8f9", color: "#0f0f0f", "&:hover": { bgcolor: "#22d3ee" } }}
            >
              Add player
            </Button>
            {addPlayerError && (
              <Typography variant="caption" color="error" sx={{ alignSelf: "center" }}>
                {addPlayerError}
              </Typography>
            )}
          </form>
        </CardContent>
      </Card>

      <Card sx={{ mb: 4, border: "1px solid", borderColor: "divider" }}>
        <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
          <div className="flex items-center gap-2 mb-2">
            <Typography variant="subtitle1" fontWeight={600}>
              Players ({players.length} / {maxPlayers})
            </Typography>
            {players.length > maxPlayers && (
              <Typography variant="caption" color="error" sx={{ alignSelf: "center" }}>
                {selectedGameConfig?.label} allows max {maxPlayers}. Remove {players.length - maxPlayers} to continue.
              </Typography>
            )}
            {selectedGame !== "sc" && (
              <Tooltip
                title="Average rating is the rating given to each player on average"
                placement="top"
                arrow
                slotProps={{ tooltip: { sx: { textAlign: "center" } } }}
              >
                <IconButton size="small" sx={{ p: 0.25, color: "rgba(255,255,255,0.95)" }} aria-label="How is avg rating calculated?">
                  <InfoOutlinedIcon sx={{ fontSize: 22 }} />
                </IconButton>
              </Tooltip>
            )}
            <Box sx={{ flex: 1, minWidth: 0 }} />
            <Button
              size="small"
              variant="outlined"
              startIcon={<HistoryIcon sx={{ fontSize: 18 }} />}
              onClick={loadLastGame}
              disabled={lastGameLoading}
              sx={{ borderColor: "rgba(103,232,249,0.5)", color: "#67e8f9", "&:hover": { borderColor: "#67e8f9", bgcolor: "rgba(103,232,249,0.08)" } }}
            >
              {lastGameLoading ? "Loading…" : "Last game"}
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="error"
              startIcon={<RefreshIcon />}
              onClick={resetPlayers}
            >
              Reset
            </Button>
          </div>
          {lastGameError && (
            <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>
              {lastGameError}
            </Typography>
          )}

          <div className="space-y-1">
            {players.map((p) => {
              const playerKey = p.name.trim().toLowerCase();
              const avgRating = playerKey ? averageRatingsByPlayer[playerKey] : undefined;
              const hasAccount = Boolean(playerKey && registeredSet.has(playerKey));
              return (
              <div
                key={p.id}
                className="flex items-center gap-2 py-1 px-2 rounded bg-cyan-500/5 border border-cyan-500/20"
              >
                <Box
                  ref={editingPlayerId === p.id ? editInputContainerRef : undefined}
                  sx={{ width: selectedGame === "sc" ? 900 : 700, flexShrink: 0, display: "flex", alignItems: "center", gap: 1 }}
                >
                  <TextField
                    value={p.name}
                    onChange={(e) => handleNameChange(p.id, e.target.value)}
                    onFocus={() => setEditingPlayerId(p.id)}
                    onBlur={() => setTimeout(() => setEditingPlayerId(null), 150)}
                    onKeyDown={(e) => {
                      if (editingPlayerId !== p.id) return;
                      const suggestion = editSuggestions[editSuggestionsIndex];
                      const displaySuggestion = suggestion && suggestion.toLowerCase().startsWith((p.name ?? "").trim().toLowerCase())
                        ? suggestion.slice((p.name ?? "").trim().length)
                        : "";
                      if (e.key === "Tab" && suggestion && displaySuggestion) {
                        e.preventDefault();
                        handleNameChange(p.id, suggestion);
                        setEditSuggestions([]);
                        return;
                      }
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        if (editSuggestions.length) setEditSuggestionsIndex((i) => (i + 1) % editSuggestions.length);
                        return;
                      }
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        if (editSuggestions.length) setEditSuggestionsIndex((i) => (i - 1 + editSuggestions.length) % editSuggestions.length);
                        return;
                      }
                    }}
                    size="small"
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      "& .MuiInputBase-root": { height: 32 },
                      "& .MuiInputBase-input": { py: 0.5, fontSize: "0.875rem" },
                    }}
                  />
                  {hasAccount && (
                    <Tooltip title="Has account" placement="top" arrow>
                      <PersonIcon sx={{ fontSize: 18, color: "#67e8f9", flexShrink: 0 }} aria-label="Has account" />
                    </Tooltip>
                  )}
                  {editingPlayerId === p.id && editSuggestionsLoading && (
                    <Typography component="span" variant="caption" sx={{ color: "text.secondary", flexShrink: 0 }}>…</Typography>
                  )}
                  {selectedGame !== "sc" && (
                    <Box
                      sx={{
                        width: 56,
                        flexShrink: 0,
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                        fontSize: "0.75rem",
                        color: "rgba(255,255,255,0.6)",
                        letterSpacing: "0.02em",
                      }}
                    >
                      {avgRating != null ? `avg ${Number(avgRating).toFixed(1)}` : ""}
                    </Box>
                  )}
                </Box>
                {selectedGame !== "sc" && (
                  <div className="flex items-center gap-1 flex-1 max-w-[180px] min-w-[120px]">
                    <Slider
                      value={p.rating}
                      onChange={(_, v) => setRating(p.id, v as number)}
                      min={1}
                      max={10}
                      step={1}
                      valueLabelDisplay="auto"
                      valueLabelFormat={(v) => v}
                      sx={{ height: 4, "& .MuiSlider-thumb": { width: 14, height: 14 } }}
                    />
                    <Typography variant="body2" fontWeight={600} sx={{ minWidth: 20, fontSize: "0.8rem" }}>
                      {p.rating}
                    </Typography>
                  </div>
                )}
                <IconButton size="small" onClick={() => removePlayer(p.id)} color="error" sx={{ p: 0.5 }}>
                  <DeleteIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </div>
            );
            })}
          </div>
          {typeof document !== "undefined" &&
            editingPlayerId &&
            editDropdownRect &&
            editSuggestions.length > 0 &&
            createPortal(
              <ul
                className="list-none fixed max-h-48 overflow-auto rounded-md border border-cyan-500/30 bg-black/95 shadow-xl"
                style={{
                  top: editDropdownRect.top,
                  left: editDropdownRect.left,
                  width: editDropdownRect.width,
                  zIndex: 1300,
                }}
              >
                {editSuggestions.map((name, i) => (
                  <li key={name}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (editingPlayerId) handleNameChange(editingPlayerId, name);
                        setEditSuggestions([]);
                        setEditingPlayerId(null);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm transition-colors ${i === editSuggestionsIndex ? "bg-cyan-500/25 text-cyan-200" : "text-neutral-200 hover:bg-cyan-500/10"}`}
                    >
                      {capitalizeFirst(name)}
                    </button>
                  </li>
                ))}
              </ul>,
              document.body
            )}
        </CardContent>
      </Card>

      {players.length >= 2 && (
        <Box sx={{ mb: 2, display: "flex", gap: 2, flexWrap: "wrap" }}>
          <Button
            variant="outlined"
            startIcon={<ShuffleIcon />}
            onClick={refillTeams}
            disabled={players.length > maxPlayers}
            sx={{
              borderColor: "rgba(103,232,249,0.5)",
              color: "#67e8f9",
              "&:hover": { borderColor: "#67e8f9", bgcolor: "rgba(103,232,249,0.1)" },
            }}
          >
            Refill teams
          </Button>
          {session?.user && (
            <>
              <Button
                variant="contained"
                disabled={creatingGame || hasActiveSharedGame || players.length > maxPlayers}
                onClick={handleStartGame}
                sx={{
                  bgcolor: hasActiveSharedGame ? "rgba(255,255,255,0.2)" : "rgba(249,168,212,0.9)",
                  color: "#0f0f0f",
                  "&:hover": { bgcolor: hasActiveSharedGame ? undefined : "#f9a8d4" },
                }}
              >
                {creatingGame
                  ? "Creating…"
                  : hasActiveSharedGame
                    ? "Game has started"
                    : "Start game (share with players)"}
              </Button>
              {startGameError && (
                <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                  {startGameError}
                </Typography>
              )}
            </>
          )}
        </Box>
      )}

      {session?.user && activeSharedGames.length > 0 && (
        <Box sx={{ width: "100%", mb: 4 }}>
          <Typography variant="overline" sx={{ display: "block", color: "rgba(255,255,255,0.5)", letterSpacing: 1, mb: 2 }}>
            Games waiting for result
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {activeSharedGames.map((game) => {
                const un = (session?.user?.name ?? session?.user?.email ?? "").trim().toLowerCase();
                const inYin = game.teamA.some((p) => (p.name ?? "").trim().toLowerCase() === un);
                const inYang = game.teamB.some((p) => (p.name ?? "").trim().toLowerCase() === un);
                const isCreator = Boolean(game.createdById && session?.user?.id && game.createdById === session.user.id);
                const canYin = inYang || (isCreator && isAdmin);
                const canYang = inYin || (isCreator && isAdmin);
                const registeredNorm2 = new Set((registeredUserNames ?? []).map((n) => String(n).trim().toLowerCase()));
                const allPlayersRegistered2 = [...game.teamA, ...game.teamB].every(
                  (p) => (p.name ?? "").trim() === "" || registeredNorm2.has((p.name ?? "").trim().toLowerCase())
                );
                const registeredInGame2 = [...game.teamA, ...game.teamB].filter(
                  (p) => (p.name ?? "").trim() !== "" && registeredNorm2.has((p.name ?? "").trim().toLowerCase())
                ).length;
                const minRequiredThisGame2 = minRequiredByGame[game.gameType] ?? 6;
                const isLolOrOw2 = game.gameType === "lol" || game.gameType === "ow";
                const canSubmitThisGame2 =
                  validateUserCount >= minRequiredThisGame2 &&
                  (game.gameType === "sc"
                    ? registeredInGame2 >= 3
                    : isLolOrOw2
                      ? registeredInGame2 >= 6
                      : allPlayersRegistered2);
                const gameLabel = GAMES.find((g) => g.value === game.gameType)?.label ?? game.gameType;
                const teamAScore = game.teamA.reduce((s, p) => s + (p.rating ?? 0), 0);
                const teamBScore = game.teamB.reduce((s, p) => s + (p.rating ?? 0), 0);
                return (
                  <MatchCard
                    key={game.id}
                    overline="Team builder"
                    title={gameLabel}
                    meta={`Season ${game.season} · by ${game.createdByName}`}
                    headerAction={isCreator ? (
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={cancellingGameId === game.id}
                        onClick={() => handleCancelGame(game.id)}
                        sx={{
                          borderColor: "rgba(239,68,68,0.5)",
                          color: "#fca5a5",
                          "&:hover": { borderColor: "#ef4444", bgcolor: "rgba(239,68,68,0.1)" },
                        }}
                      >
                        {cancellingGameId === game.id ? "Cancelling…" : "Cancel game"}
                      </Button>
                    ) : undefined}
                    footer={
                      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
                        {canSubmitThisGame2 ? (
                          game.gameType === "sc" ? (
                            <Button
                              fullWidth
                              size="medium"
                              variant="contained"
                              onClick={() => openScPlacementsDialog(game)}
                              sx={{
                                py: 1.5,
                                bgcolor: "#67e8f9",
                                color: "#0f0f0f",
                                fontWeight: 700,
                                "&:hover": { bgcolor: "#22d3ee" },
                              }}
                            >
                              Submit placements (1st–4th)
                            </Button>
                          ) : (
                            <>
                              <Button
                                size="medium"
                                variant="contained"
                                disabled={!canYin}
                                onClick={() => openConfirmSharedResult(game.id, "yin")}
                                sx={{
                                  flex: 1,
                                  py: 1.5,
                                  bgcolor: "#67e8f9",
                                  color: "#0f0f0f",
                                  fontWeight: 700,
                                  "&:hover": { bgcolor: "#22d3ee" },
                                }}
                              >
                                Yin Won
                              </Button>
                              <Button
                                size="medium"
                                variant="contained"
                                disabled={!canYang}
                                onClick={() => openConfirmSharedResult(game.id, "yang")}
                                sx={{
                                  flex: 1,
                                  py: 1.5,
                                  bgcolor: "#f9a8d4",
                                  color: "#0f0f0f",
                                  fontWeight: 700,
                                  "&:hover": { bgcolor: "#f472b6" },
                                }}
                              >
                                Yang Won
                              </Button>
                            </>
                          )
                        ) : (
                          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, flex: 1 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
                              {validateUserCount < minRequiredThisGame2
                                ? `Result submission requires at least ${minRequiredThisGame2} registered players (${validateUserCount} currently).`
                                : game.gameType === "sc"
                                  ? "At least 3 players in the game must have an account to submit results."
                                  : isLolOrOw2
                                    ? "At least 6 players in the game must have an account to submit results for LoL/Overwatch."
                                    : "All players in the game must have an account to submit results."}
                            </Typography>
                            <Button
                              variant="outlined"
                              size="medium"
                              disabled={finishingGameId === game.id}
                              onClick={() => handleFinishGame(game.id)}
                              sx={{
                                borderColor: "rgba(255,255,255,0.4)",
                                color: "text.secondary",
                                "&:hover": { borderColor: "rgba(255,255,255,0.6)", bgcolor: "rgba(255,255,255,0.06)" },
                              }}
                            >
                              {finishingGameId === game.id ? "Finishing…" : "Game finished"}
                            </Button>
                          </Box>
                        )}
                      </Box>
                    }
                  >
                    {game.gameType === "sc" ? (
                      <Box sx={{ py: 2, px: 2 }}>
                        <Box component="ul" sx={{ m: 0, py: 1, px: 0, listStyle: "none" }}>
                          {[...game.teamA, ...game.teamB].map((p) => (
                            <TeamPlayerRow key={p.id} name={p.name ?? ""} rating="—" color="#67e8f9">
                              <>
                                <Link href={`/profile/${encodeURIComponent((p.name ?? "").trim())}`} className="text-neutral-200 hover:text-cyan-200 hover:underline">
                                  {p.name}
                                </Link>
                                {registeredNorm2.has((p.name ?? "").trim().toLowerCase()) && (
                                  <Tooltip title="Has account" placement="top" arrow>
                                    <PersonIcon sx={{ fontSize: 16, color: "#67e8f9" }} />
                                  </Tooltip>
                                )}
                              </>
                            </TeamPlayerRow>
                          ))}
                        </Box>
                      </Box>
                    ) : (
                      <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: "stretch" }}>
                        <TeamColumn name="Team Yin" totalElo={teamAScore} color="#67e8f9" accent="#67e8f9">
                          {game.teamA.map((p) => {
                            const isYouA2 = Boolean(session?.user && (p.name ?? "").trim().toLowerCase() === (session.user?.name ?? session.user?.email ?? "").trim().toLowerCase());
                            return (
                              <TeamPlayerRow key={p.id} name={p.name ?? ""} rating={p.rating ?? "—"} color="#67e8f9">
                                {isYouA2 ? (
                                  <Box component="span" sx={{ border: "1px solid rgba(251, 191, 36, 0.5)", borderRadius: 1.5, boxShadow: "inset 0 0 12px rgba(251, 191, 36, 0.2)", px: 0.5, py: 0.25, display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                                    <Link href={`/profile/${encodeURIComponent((p.name ?? "").trim())}`} className="text-cyan-200 hover:underline">{p.name}</Link>
                                    {registeredNorm2.has((p.name ?? "").trim().toLowerCase()) && <Tooltip title="Has account" placement="top" arrow><PersonIcon sx={{ fontSize: 16, color: "#67e8f9" }} /></Tooltip>}
                                  </Box>
                                ) : (
                                  <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                                    <Link href={`/profile/${encodeURIComponent((p.name ?? "").trim())}`} className="text-neutral-200 hover:text-cyan-200 hover:underline">{p.name}</Link>
                                    {registeredNorm2.has((p.name ?? "").trim().toLowerCase()) && <Tooltip title="Has account" placement="top" arrow><PersonIcon sx={{ fontSize: 16, color: "#67e8f9" }} /></Tooltip>}
                                  </Box>
                                )}
                              </TeamPlayerRow>
                            );
                          })}
                        </TeamColumn>
                        <VsDivider />
                        <TeamColumn name="Team Yang" totalElo={teamBScore} color="#f9a8d4" accent="#f9a8d4">
                          {game.teamB.map((p) => {
                            const isYouB2 = Boolean(session?.user && (p.name ?? "").trim().toLowerCase() === (session.user?.name ?? session.user?.email ?? "").trim().toLowerCase());
                            return (
                              <TeamPlayerRow key={p.id} name={p.name ?? ""} rating={p.rating ?? "—"} color="#f9a8d4">
                                {isYouB2 ? (
                                  <Box component="span" sx={{ border: "1px solid rgba(251, 191, 36, 0.5)", borderRadius: 1.5, boxShadow: "inset 0 0 12px rgba(251, 191, 36, 0.2)", px: 0.5, py: 0.25, display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                                    <Link href={`/profile/${encodeURIComponent((p.name ?? "").trim())}`} className="text-pink-200 hover:underline">{p.name}</Link>
                                    {registeredNorm2.has((p.name ?? "").trim().toLowerCase()) && <Tooltip title="Has account" placement="top" arrow><PersonIcon sx={{ fontSize: 16, color: "#67e8f9" }} /></Tooltip>}
                                  </Box>
                                ) : (
                                  <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                                    <Link href={`/profile/${encodeURIComponent((p.name ?? "").trim())}`} className="text-neutral-200 hover:text-pink-200 hover:underline">{p.name}</Link>
                                    {registeredNorm2.has((p.name ?? "").trim().toLowerCase()) && <Tooltip title="Has account" placement="top" arrow><PersonIcon sx={{ fontSize: 16, color: "#67e8f9" }} /></Tooltip>}
                                  </Box>
                                )}
                              </TeamPlayerRow>
                            );
                          })}
                        </TeamColumn>
                      </Box>
                    )}
                  </MatchCard>
                );
              })}
          </Box>
        </Box>
      )}

      {selectedGame === "sc" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {[...result.teamA, ...result.teamB].slice(0, 4).map((p, i) => (
            <Card key={p.id} sx={{ border: "2px solid", borderColor: "rgba(103,232,249,0.35)", background: "rgba(103,232,249,0.04)" }}>
              <CardContent sx={{ py: 1.5 }}>
                <Typography variant="caption" fontWeight={700} sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>
                  Player {i + 1}
                </Typography>
                <span className="flex items-center gap-1">
                  <Link href={`/profile/${encodeURIComponent((p.name ?? "").trim())}`} className="text-cyan-200 hover:text-cyan-100 hover:underline font-medium">
                    {p.name}
                  </Link>
                  {registeredSet.has((p.name ?? "").trim().toLowerCase()) && (
                    <Tooltip title="Has account" placement="top" arrow>
                      <PersonIcon sx={{ fontSize: 16, color: "#67e8f9" }} aria-label="Has account" />
                    </Tooltip>
                  )}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Card sx={{ border: "2px solid", borderColor: "rgba(103,232,249,0.4)", background: "rgba(103,232,249,0.03)" }}>
            <CardContent sx={{ py: 2 }}>
              <div className="flex justify-between items-center mb-2">
                <Typography variant="subtitle1" fontWeight={600} sx={{ color: "#67e8f9" }}>
                  Yin — {result.teamAScore}
                </Typography>
              </div>
              <Divider sx={{ my: 1.5, borderColor: "rgba(103,232,249,0.2)" }} />
              <ul className="space-y-0.5">
                {result.teamA.map((p) => (
                  <li key={p.id} className="flex justify-between text-sm">
                    <span className="flex items-center gap-1">
                      <Link href={`/profile/${encodeURIComponent((p.name ?? "").trim())}`} className="hover:text-cyan-200 hover:underline">
                        {p.name}
                      </Link>
                      {registeredSet.has((p.name ?? "").trim().toLowerCase()) && (
                        <Tooltip title="Has account" placement="top" arrow>
                          <PersonIcon sx={{ fontSize: 16, color: "#67e8f9" }} aria-label="Has account" />
                        </Tooltip>
                      )}
                    </span>
                    <span className="font-medium">{p.rating}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card sx={{ border: "2px solid", borderColor: "rgba(249,168,212,0.4)", background: "rgba(249,168,212,0.03)" }}>
            <CardContent sx={{ py: 2 }}>
              <div className="flex justify-between items-center mb-2">
                <Typography variant="subtitle1" fontWeight={600} sx={{ color: "#f9a8d4" }}>
                  Yang — {result.teamBScore}
                </Typography>
              </div>
              <Divider sx={{ my: 1.5, borderColor: "rgba(249,168,212,0.2)" }} />
              <ul className="space-y-0.5">
                {result.teamB.map((p) => (
                  <li key={p.id} className="flex justify-between text-sm">
                    <span className="flex items-center gap-1">
                      <Link href={`/profile/${encodeURIComponent((p.name ?? "").trim())}`} className="hover:text-cyan-200 hover:underline">
                        {p.name}
                      </Link>
                      {registeredSet.has((p.name ?? "").trim().toLowerCase()) && (
                        <Tooltip title="Has account" placement="top" arrow>
                          <PersonIcon sx={{ fontSize: 16, color: "#67e8f9" }} aria-label="Has account" />
                        </Tooltip>
                      )}
                    </span>
                    <span className="font-medium">{p.rating}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      )}
    </Box>
      )}

      <Dialog
        open={confirmWinOpen}
        onClose={closeConfirmWin}
        PaperProps={{
          sx: {
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            m: 0,
            minWidth: 320,
            bgcolor: "background.paper",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 2,
          },
        }}
      >
        <DialogTitle sx={{ color: "text.primary" }}>
          Confirm result
        </DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            {confirmSharedGameId
              ? `Confirm: ${confirmWinTeam === "yin" ? "Yin" : "Yang"} won?`
              : `Record ${confirmWinTeam === "yin" ? "Yin" : "Yang"} as winner for ${GAMES.find((g) => g.value === selectedGame)?.label ?? selectedGame}?`}
          </Typography>
          {submitSharedError && (
            <Typography color="error" sx={{ mt: 2, fontSize: "0.875rem" }}>
              {submitSharedError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeConfirmWin} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={onConfirmWin}
            variant="contained"
            sx={{
              bgcolor: confirmWinTeam === "yin" ? "#67e8f9" : "#f9a8d4",
              color: "#0f0f0f",
              "&:hover": { bgcolor: confirmWinTeam === "yin" ? "#22d3ee" : "#f472b6" },
            }}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(scPlacementsGame)}
        onClose={closeScPlacementsDialog}
        PaperProps={{
          sx: {
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            m: 0,
            minWidth: 360,
            bgcolor: "background.paper",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 2,
          },
        }}
      >
        <DialogTitle sx={{ color: "text.primary" }}>
          Survival Chaos — Placements (1st to 4th)
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Assign each player a place (1–4). Each number must be used exactly once.
          </Typography>
          {scPlacementsGame && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {[...scPlacementsGame.teamA, ...scPlacementsGame.teamB]
                .filter((p) => (p.name ?? "").trim())
                .map((p) => {
                  const name = (p.name ?? "").trim();
                  const current = scPlacements[name];
                  return (
                    <Box key={p.id} sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                      <Typography sx={{ flex: "1 1 120px", minWidth: 0, color: "text.primary" }} noWrap>
                        {name}
                      </Typography>
                      <Box sx={{ display: "flex", gap: 0.5 }}>
                        {[1, 2, 3, 4].map((place) => {
                          const isSelected = current === place;
                          return (
                            <Button
                              key={place}
                              size="small"
                              variant={isSelected ? "contained" : "outlined"}
                              onClick={() =>
                                setScPlacements((prev) => ({
                                  ...prev,
                                  [name]: place,
                                }))
                              }
                              sx={{
                                minWidth: 40,
                                px: 1,
                                ...(isSelected
                                  ? {
                                      bgcolor: "#67e8f9",
                                      color: "#0f0f0f",
                                      borderColor: "#67e8f9",
                                      "&:hover": { bgcolor: "#22d3ee", borderColor: "#22d3ee" },
                                    }
                                  : {
                                      borderColor: "rgba(255,255,255,0.3)",
                                      color: "text.secondary",
                                      "&:hover": { borderColor: "#67e8f9", color: "#67e8f9" },
                                    }),
                              }}
                            >
                              {place}
                            </Button>
                          );
                        })}
                      </Box>
                    </Box>
                  );
                })}
            </Box>
          )}
          {scPlacementsError && (
            <Typography color="error" sx={{ mt: 2, fontSize: "0.875rem" }}>
              {scPlacementsError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeScPlacementsDialog} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleSubmitScPlacements}
            variant="contained"
            sx={{
              bgcolor: "#67e8f9",
              color: "#0f0f0f",
              "&:hover": { bgcolor: "#22d3ee" },
            }}
          >
            Submit placements
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
