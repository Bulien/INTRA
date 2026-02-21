"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
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
  ToggleButtonGroup,
  ToggleButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import ShuffleIcon from "@mui/icons-material/Shuffle";
import { sanitizeDisplayName } from "@/lib/sanitizeInput";

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
  return data.games ?? [];
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
  const [canValidate, setCanValidate] = useState(false);
  const [validateUserCount, setValidateUserCount] = useState(0);
  const [minRequiredByGame, setMinRequiredByGame] = useState<Record<string, number>>({ lol: 10, ow: 10, sc: 3, battlerite: 10 });
  const [playerSuggestions, setPlayerSuggestions] = useState<string[]>([]);
  const [playerSuggestionsLoading, setPlayerSuggestionsLoading] = useState(false);
  const [playerSuggestionsIndex, setPlayerSuggestionsIndex] = useState(0);
  const [playerInputFocused, setPlayerInputFocused] = useState(false);
  const [addPlayerError, setAddPlayerError] = useState<string | null>(null);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const [averageRatingsByPlayer, setAverageRatingsByPlayer] = useState<Record<string, number>>({});
  const [scPlacementsGame, setScPlacementsGame] = useState<SharedGame | null>(null);
  const [scPlacements, setScPlacements] = useState<Record<string, number>>({});
  const [scPlacementsError, setScPlacementsError] = useState<string | null>(null);
  const playerInputRef = useRef<HTMLInputElement>(null);
  const playerInputContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPlayers(loadTeamBuilderPlayers());
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
        setMinRequiredByGame(data.minRequiredByGame ?? { lol: 10, ow: 10, sc: 3, battlerite: 10 });
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
    const minRequired = minRequiredByGame[game.gameType] ?? 10;
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
    const minRequired = game ? (minRequiredByGame[game.gameType] ?? 10) : 10;
    if (validateUserCount < minRequired) {
      setResultBlockedMessage(`Result submission requires at least ${minRequired} registered players (${validateUserCount} currently).`);
      setTimeout(() => setResultBlockedMessage(null), 5000);
      return;
    }
    if (!game) return;
    {
      const regSet = new Set((registeredUserNames ?? []).map((n) => String(n).trim().toLowerCase()));
      const allReg = [...game.teamA, ...game.teamB].every(
        (p) => (p.name ?? "").trim() === "" || regSet.has((p.name ?? "").trim().toLowerCase())
      );
      if (!allReg) {
        setResultBlockedMessage("All players in the game must have an account to submit results.");
        setTimeout(() => setResultBlockedMessage(null), 5000);
        return;
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

  const isCreatorOfAnyActiveGame = activeSharedGames.some(
    (g) => g.createdById && session?.user?.id && g.createdById === session.user.id
  );
  const hasActiveSharedGame = Boolean(session?.user && activeSharedGames.length > 0);
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";
  const [hideSharedGamesOnlyView, setHideSharedGamesOnlyView] = useState(false);
  useEffect(() => {
    if (activeSharedGames.length === 0) setHideSharedGamesOnlyView(false);
  }, [activeSharedGames.length]);
  const showOnlySharedGames = Boolean(
    session?.user && activeSharedGames.length > 0 && !isCreatorOfAnyActiveGame && !hideSharedGamesOnlyView
  );

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
      <Box
        sx={{
          minHeight: "calc(100vh - 8rem)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          py: 4,
        }}
      >
        <Typography variant="h4" sx={{ mb: 3, color: "text.primary", textAlign: "center" }}>
          Team Builder
        </Typography>
        <Box sx={{ width: "100%", maxWidth: 640, mx: "auto" }}>
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
            const minRequiredThisGame = minRequiredByGame[game.gameType] ?? 10;
            const canSubmitThisGame =
              validateUserCount >= minRequiredThisGame &&
              (game.gameType === "sc" ? registeredInGame >= 3 : allPlayersRegistered);
            const gameLabel = GAMES.find((g) => g.value === game.gameType)?.label ?? game.gameType;
            const teamAScore = game.teamA.reduce((s, p) => s + (p.rating ?? 0), 0);
            const teamBScore = game.teamB.reduce((s, p) => s + (p.rating ?? 0), 0);
            return (
              <Card
                key={game.id}
                sx={{
                  border: "2px solid",
                  borderColor: "rgba(103,232,249,0.3)",
                  bgcolor: "rgba(26,26,26,0.95)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                }}
              >
                <CardContent sx={{ py: 3, px: 3 }}>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                    {gameLabel} · Season {game.season} · by {game.createdByName}
                  </Typography>
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <Box sx={{ p: 2, borderRadius: 1, bgcolor: "rgba(103,232,249,0.08)", border: "1px solid rgba(103,232,249,0.25)" }}>
                      <Typography
                        component="span"
                        sx={{
                          display: "inline-block",
                          px: 1.5,
                          py: 0.5,
                          mb: 1.5,
                          fontSize: "0.7rem",
                          fontWeight: 800,
                          letterSpacing: "0.2em",
                          color: "#0f0f0f",
                          bgcolor: "#67e8f9",
                          borderRadius: 1,
                          textTransform: "uppercase",
                        }}
                      >
                        Team Yin
                      </Typography>
                      <Typography variant="subtitle1" sx={{ color: "#67e8f9", fontWeight: 700, mb: 1 }}>{game.gameType === "sc" ? "" : `— ${teamAScore} pts`}</Typography>
                      <ul className="list-none p-0 m-0 space-y-1">
                        {game.teamA.map((p) => (
                          <li key={p.id} className="flex justify-between text-sm">
                            <span className="text-neutral-200">{p.name}</span>
                            {game.gameType !== "sc" && <span className="font-semibold text-cyan-200">{p.rating ?? "—"}</span>}
                          </li>
                        ))}
                      </ul>
                    </Box>
                    <Box sx={{ p: 2, borderRadius: 1, bgcolor: "rgba(249,168,212,0.08)", border: "1px solid rgba(249,168,212,0.25)" }}>
                      <Typography
                        component="span"
                        sx={{
                          display: "inline-block",
                          px: 1.5,
                          py: 0.5,
                          mb: 1.5,
                          fontSize: "0.7rem",
                          fontWeight: 800,
                          letterSpacing: "0.2em",
                          color: "#0f0f0f",
                          bgcolor: "#f9a8d4",
                          borderRadius: 1,
                          textTransform: "uppercase",
                        }}
                      >
                        Team Yang
                      </Typography>
                      <Typography variant="subtitle1" sx={{ color: "#f9a8d4", fontWeight: 700, mb: 1 }}>{game.gameType === "sc" ? "" : `— ${teamBScore} pts`}</Typography>
                      <ul className="list-none p-0 m-0 space-y-1">
                        {game.teamB.map((p) => (
                          <li key={p.id} className="flex justify-between text-sm">
                            <span className="text-neutral-200">{p.name}</span>
                            {game.gameType !== "sc" && <span className="font-semibold text-pink-200">{p.rating ?? "—"}</span>}
                          </li>
                        ))}
                      </ul>
                    </Box>
                  </div>
                  <div className="flex gap-2">
                    {canSubmitThisGame ? (
                      game.gameType === "sc" ? (
                        <Button
                          fullWidth
                          variant="contained"
                          size="large"
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
                            fullWidth
                            variant="contained"
                            size="large"
                            disabled={!canYin}
                            onClick={() => openConfirmSharedResult(game.id, "yin")}
                            sx={{
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
                            fullWidth
                            variant="contained"
                            size="large"
                            disabled={!canYang}
                            onClick={() => openConfirmSharedResult(game.id, "yang")}
                            sx={{
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
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, width: "100%" }}>
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
                          {validateUserCount < minRequiredThisGame
                            ? `Result submission requires at least ${minRequiredThisGame} registered players (${validateUserCount} currently).`
                            : game.gameType === "sc"
                              ? "At least 3 players in the game must have an account to submit results."
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
                  </div>
                </CardContent>
              </Card>
            );
          })}
          <Box sx={{ textAlign: "center", mt: 2 }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setHideSharedGamesOnlyView(true)}
              sx={{
                borderColor: "rgba(255,255,255,0.3)",
                color: "text.secondary",
                "&:hover": { borderColor: "rgba(255,255,255,0.5)", bgcolor: "rgba(255,255,255,0.06)" },
              }}
            >
              Continue to team builder
            </Button>
          </Box>
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
        <div className="flex items-center gap-4">
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
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "text.primary" }}>
            Game
          </Typography>
          <ToggleButtonGroup
            value={selectedGame}
            exclusive
            onChange={(_, value) => value != null && setSelectedGame(value)}
            size="small"
            sx={{
              "& .MuiToggleButtonGroup-grouped": { border: 1 },
              "& .MuiToggleButton-root": {
                px: 2,
                py: 0.75,
                textTransform: "none",
                fontWeight: 600,
                "&.Mui-selected": {
                  bgcolor: "rgba(103,232,249,0.25)",
                  color: "#67e8f9",
                  "&:hover": { bgcolor: "rgba(103,232,249,0.35)" },
                },
              },
            }}
          >
            {GAMES.map((g) => (
              <ToggleButton key={g.value} value={g.value} aria-label={g.label}>
                {g.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
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
              color="error"
              startIcon={<RefreshIcon />}
              onClick={resetPlayers}
            >
              Reset
            </Button>
          </div>

          <div className="space-y-1">
            {players.map((p) => {
              const playerKey = p.name.trim().toLowerCase();
              const avgRating = playerKey ? averageRatingsByPlayer[playerKey] : undefined;
              return (
              <div
                key={p.id}
                className="flex items-center gap-2 py-1 px-2 rounded bg-cyan-500/5 border border-cyan-500/20"
              >
                <Box sx={{ width: 700, flexShrink: 0, display: "flex", alignItems: "center", gap: 1 }}>
                  <TextField
                    value={p.name}
                    onChange={(e) => handleNameChange(p.id, e.target.value)}
                    size="small"
                    sx={{
                      flex: 1,
                      minWidth: 0,
                      "& .MuiInputBase-root": { height: 32 },
                      "& .MuiInputBase-input": { py: 0.5, fontSize: "0.875rem" },
                    }}
                  />
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
        <Box
          sx={{
            width: "100%",
            mb: 4,
            py: 4,
            px: 0,
            bgcolor: "rgba(0,0,0,0.25)",
            borderRadius: 2,
            border: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <Typography variant="h5" sx={{ mb: 3, color: "text.primary", textAlign: "center", fontWeight: 600 }}>
            Games waiting for result
          </Typography>
          <Box sx={{ width: "100%" }}>
            <div className="grid grid-cols-1 gap-4" style={{ width: "100%" }}>
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
                const minRequiredThisGame2 = minRequiredByGame[game.gameType] ?? 10;
                const canSubmitThisGame2 =
                  validateUserCount >= minRequiredThisGame2 &&
                  (game.gameType === "sc" ? registeredInGame2 >= 3 : allPlayersRegistered2);
                const gameLabel = GAMES.find((g) => g.value === game.gameType)?.label ?? game.gameType;
                const teamAScore = game.teamA.reduce((s, p) => s + (p.rating ?? 0), 0);
                const teamBScore = game.teamB.reduce((s, p) => s + (p.rating ?? 0), 0);
                return (
                  <Card
                    key={game.id}
                    sx={{
                      border: "2px solid",
                      borderColor: "rgba(255,255,255,0.15)",
                      bgcolor: "rgba(26,26,26,0.8)",
                      boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                    }}
                  >
                    <CardContent sx={{ py: 3, px: 3 }}>
                      <Typography variant="body2" color="text.secondary" display="block" sx={{ mb: 2 }}>
                        {gameLabel} · Season {game.season} · by {game.createdByName}
                      </Typography>
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <Box sx={{ p: 2.5, borderRadius: 1, bgcolor: "rgba(103,232,249,0.1)", border: "1px solid rgba(103,232,249,0.3)" }}>
                          <Typography
                            component="span"
                            sx={{
                              display: "inline-block",
                              px: 1.5,
                              py: 0.5,
                              mb: 1.5,
                              fontSize: "0.7rem",
                              fontWeight: 800,
                              letterSpacing: "0.2em",
                              color: "#0f0f0f",
                              bgcolor: "#67e8f9",
                              borderRadius: 1,
                              textTransform: "uppercase",
                            }}
                          >
                            Team Yin
                          </Typography>
                          <Typography variant="subtitle1" sx={{ color: "#67e8f9", fontWeight: 700, mb: 1 }}>{game.gameType === "sc" ? "" : `— ${teamAScore} pts`}</Typography>
                          <ul className="list-none p-0 m-0 space-y-1 text-neutral-300">
                            {game.teamA.map((p) => (
                              <li key={p.id} className="flex justify-between text-base">
                                <span>{p.name}</span>
                                {game.gameType !== "sc" && <span className="font-semibold text-cyan-200">{p.rating ?? "—"}</span>}
                              </li>
                            ))}
                          </ul>
                        </Box>
                        <Box sx={{ p: 2.5, borderRadius: 1, bgcolor: "rgba(249,168,212,0.1)", border: "1px solid rgba(249,168,212,0.3)" }}>
                          <Typography
                            component="span"
                            sx={{
                              display: "inline-block",
                              px: 1.5,
                              py: 0.5,
                              mb: 1.5,
                              fontSize: "0.7rem",
                              fontWeight: 800,
                              letterSpacing: "0.2em",
                              color: "#0f0f0f",
                              bgcolor: "#f9a8d4",
                              borderRadius: 1,
                              textTransform: "uppercase",
                            }}
                          >
                            Team Yang
                          </Typography>
                          <Typography variant="subtitle1" sx={{ color: "#f9a8d4", fontWeight: 700, mb: 1 }}>{game.gameType === "sc" ? "" : `— ${teamBScore} pts`}</Typography>
                          <ul className="list-none p-0 m-0 space-y-1 text-neutral-300">
                            {game.teamB.map((p) => (
                              <li key={p.id} className="flex justify-between text-base">
                                <span>{p.name}</span>
                                {game.gameType !== "sc" && <span className="font-semibold text-pink-200">{p.rating ?? "—"}</span>}
                              </li>
                            ))}
                          </ul>
                        </Box>
                      </div>
                      <div className="flex gap-2">
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
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </Box>
        </Box>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card sx={{ border: "2px solid", borderColor: "rgba(103,232,249,0.4)", background: "rgba(103,232,249,0.03)" }}>
          <CardContent sx={{ py: 2 }}>
            <div className="flex justify-between items-center mb-2">
              <Typography variant="subtitle1" fontWeight={600} sx={{ color: "#67e8f9" }}>
                Yin{selectedGame !== "sc" ? ` — ${result.teamAScore}` : ""}
              </Typography>
            </div>
            <Divider sx={{ my: 1.5, borderColor: "rgba(103,232,249,0.2)" }} />
            <ul className="space-y-0.5">
              {result.teamA.map((p) => (
                <li key={p.id} className="flex justify-between text-sm">
                  <span>{p.name}</span>
                  {selectedGame !== "sc" && <span className="font-medium">{p.rating}</span>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card sx={{ border: "2px solid", borderColor: "rgba(249,168,212,0.4)", background: "rgba(249,168,212,0.03)" }}>
          <CardContent sx={{ py: 2 }}>
            <div className="flex justify-between items-center mb-2">
              <Typography variant="subtitle1" fontWeight={600} sx={{ color: "#f9a8d4" }}>
                Yang{selectedGame !== "sc" ? ` — ${result.teamBScore}` : ""}
              </Typography>
            </div>
            <Divider sx={{ my: 1.5, borderColor: "rgba(249,168,212,0.2)" }} />
            <ul className="space-y-0.5">
              {result.teamB.map((p) => (
                <li key={p.id} className="flex justify-between text-sm">
                  <span>{p.name}</span>
                  {selectedGame !== "sc" && <span className="font-medium">{p.rating}</span>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
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
            Enter each player&apos;s placement. Use 1 for 1st, 2 for 2nd, 3 for 3rd, 4 for 4th. Each number 1–4 must be used exactly once.
          </Typography>
          {scPlacementsGame && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {[...scPlacementsGame.teamA, ...scPlacementsGame.teamB]
                .filter((p) => (p.name ?? "").trim())
                .map((p) => {
                  const name = (p.name ?? "").trim();
                  return (
                    <Box key={p.id} sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <Typography sx={{ flex: 1, color: "text.primary" }} noWrap>
                        {name}
                      </Typography>
                      <FormControl size="small" sx={{ minWidth: 100 }}>
                        <InputLabel>Place</InputLabel>
                        <Select
                          value={scPlacements[name] ?? ""}
                          label="Place"
                          onChange={(e) =>
                            setScPlacements((prev) => ({
                              ...prev,
                              [name]: Number(e.target.value) as number,
                            }))
                          }
                        >
                          <MenuItem value={1}>1st</MenuItem>
                          <MenuItem value={2}>2nd</MenuItem>
                          <MenuItem value={3}>3rd</MenuItem>
                          <MenuItem value={4}>4th</MenuItem>
                        </Select>
                      </FormControl>
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
