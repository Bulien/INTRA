"use client";

import { useState, useCallback, useEffect, useRef } from "react";
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
  Autocomplete,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import RefreshIcon from "@mui/icons-material/Refresh";
import ShuffleIcon from "@mui/icons-material/Shuffle";
import { sanitizeDisplayName } from "@/lib/sanitizeInput";

const GAMES = [
  { value: "lol", label: "LoL" },
  { value: "ow", label: "Overwatch" },
  { value: "battlerite", label: "Battlerite" },
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
): Promise<SharedGame | null> {
  const res = await fetch("/api/team-builder/games", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gameType, season, teamA, teamB }),
  });
  if (!res.ok) return null;
  return res.json();
}

async function submitSharedGameResult(
  gameId: string,
  winner: "yin" | "yang"
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`/api/team-builder/games/${gameId}/result`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ winner }),
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
  const [finishingGameId, setFinishingGameId] = useState<string | null>(null);
  const [canValidate, setCanValidate] = useState(false);
  const [validateUserCount, setValidateUserCount] = useState(0);

  useEffect(() => {
    setPlayers(loadTeamBuilderPlayers());
  }, []);

  const fetchCanValidate = useCallback(() => {
    fetch("/api/team-builder/can-validate", { cache: "no-store" })
      .then((res) => res.ok ? res.json() : { canValidate: false, userCount: 0 })
      .then((data) => {
        setCanValidate(Boolean(data.canValidate));
        setValidateUserCount(Number(data.userCount) || 0);
      })
      .catch(() => { setCanValidate(false); setValidateUserCount(0); });
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

  const addPlayer = useCallback(() => {
    const name = newName.trim();
    if (!name) return;

    const capitalized = capitalizeFirst(name);

    const existing = existingPlayers.find(
      (p) => p.toLowerCase() === capitalized.toLowerCase()
    );

    const id = crypto.randomUUID();
    const fromRegistered = [...existingPlayers, ...registeredUserNames].find(
      (p) => p.toLowerCase() === capitalized.toLowerCase()
    );
    setPlayers((prev) => [...prev, { id, name: fromRegistered || capitalized, rating: 5 }]);
    setNewName("");
  }, [newName, existingPlayers, registeredUserNames]);

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
    setCreatingGame(true);
    try {
      const game = await createSharedGame(
        selectedGame,
        maxSeason,
        result.teamA,
        result.teamB
      );
      if (game) {
        setActiveSharedGames((prev) => [game, ...prev]);
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

  const isOdd = players.length % 2 !== 0;

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
    if (!canValidate) {
      setResultBlockedMessage(`Result submission requires at least 10 registered players (${validateUserCount} currently).`);
      setTimeout(() => setResultBlockedMessage(null), 5000);
      return;
    }
    const game = activeSharedGames.find((g) => g.id === gameId);
    if (game) {
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
            const canSubmitThisGame = canValidate && allPlayersRegistered;
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
                      <Typography variant="subtitle1" sx={{ color: "#67e8f9", fontWeight: 700, mb: 1 }}>— {teamAScore} pts</Typography>
                      <ul className="list-none p-0 m-0 space-y-1">
                        {game.teamA.map((p) => (
                          <li key={p.id} className="flex justify-between text-sm">
                            <span className="text-neutral-200">{p.name}</span>
                            <span className="font-semibold text-cyan-200">{p.rating ?? "—"}</span>
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
                      <Typography variant="subtitle1" sx={{ color: "#f9a8d4", fontWeight: 700, mb: 1 }}>— {teamBScore} pts</Typography>
                      <ul className="list-none p-0 m-0 space-y-1">
                        {game.teamB.map((p) => (
                          <li key={p.id} className="flex justify-between text-sm">
                            <span className="text-neutral-200">{p.name}</span>
                            <span className="font-semibold text-pink-200">{p.rating ?? "—"}</span>
                          </li>
                        ))}
                      </ul>
                    </Box>
                  </div>
                  <div className="flex gap-2">
                    {canSubmitThisGame ? (
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
                    ) : (
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, width: "100%" }}>
                        <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
                          {!canValidate
                            ? `Result submission requires at least 10 registered players (${validateUserCount} currently).`
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
            <Autocomplete
              freeSolo
              value={newName}
              onChange={(_, value) => setNewName(sanitizeDisplayName(value ?? ""))}
              onInputChange={(_, value) => setNewName(sanitizeDisplayName(value ?? ""))}
              options={[...new Set([...existingPlayers, ...registeredUserNames])]}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Player name"
                  variant="outlined"
                  size="small"
                  sx={{ minWidth: 200 }}
                />
              )}
            />
            <Button type="submit" variant="contained" startIcon={<AddIcon />} sx={{ bgcolor: "#67e8f9", color: "#0f0f0f", "&:hover": { bgcolor: "#22d3ee" } }}>
              Add player
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card sx={{ mb: 4, border: "1px solid", borderColor: "divider" }}>
        <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
          <div className="flex justify-between items-center mb-2">
            <Typography variant="subtitle1" fontWeight={600}>
              Players ({players.length})
            </Typography>
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

          {isOdd && (
            <Typography variant="body2" sx={{ mb: 1, color: "#a3a3a3" }}>
              Odd number of players — one team will have an extra member.
            </Typography>
          )}

          <div className="space-y-1">
            {players.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-2 py-1 px-2 rounded bg-cyan-500/5 border border-cyan-500/20"
              >
                <TextField
                  value={p.name}
                  onChange={(e) => handleNameChange(p.id, e.target.value)}
                  size="small"
                  sx={{
                    flex: 1,
                    minWidth: 100,
                    "& .MuiInputBase-root": { height: 32 },
                    "& .MuiInputBase-input": { py: 0.5, fontSize: "0.875rem" },
                  }}
                />
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
                <IconButton size="small" onClick={() => removePlayer(p.id)} color="error" sx={{ p: 0.5 }}>
                  <DeleteIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {players.length >= 2 && (
        <Box sx={{ mb: 2, display: "flex", gap: 2, flexWrap: "wrap" }}>
          <Button
            variant="outlined"
            startIcon={<ShuffleIcon />}
            onClick={refillTeams}
            sx={{
              borderColor: "rgba(103,232,249,0.5)",
              color: "#67e8f9",
              "&:hover": { borderColor: "#67e8f9", bgcolor: "rgba(103,232,249,0.1)" },
            }}
          >
            Refill teams
          </Button>
          {session?.user && (
            <Button
              variant="contained"
              disabled={creatingGame || hasActiveSharedGame}
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
                const canSubmitThisGame2 = canValidate && allPlayersRegistered2;
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
                          <Typography variant="subtitle1" sx={{ color: "#67e8f9", fontWeight: 700, mb: 1 }}>— {teamAScore} pts</Typography>
                          <ul className="list-none p-0 m-0 space-y-1 text-neutral-300">
                            {game.teamA.map((p) => (
                              <li key={p.id} className="flex justify-between text-base">
                                <span>{p.name}</span>
                                <span className="font-semibold text-cyan-200">{p.rating ?? "—"}</span>
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
                          <Typography variant="subtitle1" sx={{ color: "#f9a8d4", fontWeight: 700, mb: 1 }}>— {teamBScore} pts</Typography>
                          <ul className="list-none p-0 m-0 space-y-1 text-neutral-300">
                            {game.teamB.map((p) => (
                              <li key={p.id} className="flex justify-between text-base">
                                <span>{p.name}</span>
                                <span className="font-semibold text-pink-200">{p.rating ?? "—"}</span>
                              </li>
                            ))}
                          </ul>
                        </Box>
                      </div>
                      <div className="flex gap-2">
                        {canSubmitThisGame2 ? (
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
                        ) : (
                          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, flex: 1 }}>
                            <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
                              {!canValidate
                                ? `Result submission requires at least 10 registered players (${validateUserCount} currently).`
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
                Yin — {result.teamAScore}
              </Typography>
            </div>
            <Divider sx={{ my: 1.5, borderColor: "rgba(103,232,249,0.2)" }} />
            <ul className="space-y-0.5">
              {result.teamA.map((p) => (
                <li key={p.id} className="flex justify-between text-sm">
                  <span>{p.name}</span>
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
                  <span>{p.name}</span>
                  <span className="font-medium">{p.rating}</span>
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
    </>
  );
}
