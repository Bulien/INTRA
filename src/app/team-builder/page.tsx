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

  useEffect(() => {
    setPlayers(loadTeamBuilderPlayers());
  }, []);

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

  const handleTeamWin = useCallback(async (team: "yin" | "yang") => {
    const winningTeam = team === "yin" ? result.teamA : result.teamB;
    const losingTeam = team === "yin" ? result.teamB : result.teamA;
    const winningNames = winningTeam.map((p) => p.name);
    const losingNames = losingTeam.map((p) => p.name);
    await recordWin(selectedGame, maxSeason, winningNames, losingNames);

    const message = `${team === "yin" ? "Yin" : "Yang"} win recorded for ${GAMES.find((g) => g.value === selectedGame)?.label || selectedGame}!\nWinners: ${winningNames.join(", ")}\nLosers: ${losingNames.join(", ")}`;
    alert(message);
  }, [result, selectedGame, maxSeason]);

  const isOdd = players.length % 2 !== 0;

  const [confirmWinOpen, setConfirmWinOpen] = useState(false);
  const [confirmWinTeam, setConfirmWinTeam] = useState<"yin" | "yang" | null>(null);

  const openConfirmWin = (team: "yin" | "yang") => {
    setConfirmWinTeam(team);
    setConfirmWinOpen(true);
  };

  const closeConfirmWin = () => {
    setConfirmWinOpen(false);
    setConfirmWinTeam(null);
  };

  const onConfirmWin = useCallback(async () => {
    if (!confirmWinTeam) return;
    await handleTeamWin(confirmWinTeam);
    closeConfirmWin();
  }, [confirmWinTeam, handleTeamWin]);

  const [chronoSeconds, setChronoSeconds] = useState(0);
  const [chronoRunning, setChronoRunning] = useState(true);
  useEffect(() => {
    if (!chronoRunning) return;
    const id = setInterval(() => setChronoSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [chronoRunning]);
  const chronoDisplay = `${Math.floor(chronoSeconds / 60)}:${String(chronoSeconds % 60).padStart(2, "0")}`;

  return (
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
      <div className="flex items-start gap-4 mb-3">
        <div className="flex-1">
          <Typography variant="h4" sx={{ mb: 0.5, color: "text.primary" }}>
            Team Builder
          </Typography>
        </div>
        <div className="flex items-center gap-3">
          <Typography variant="body2" color="text.secondary">
            Season {maxSeason} (current)
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Game:
          </Typography>
          <Autocomplete
            value={GAMES.find((g) => g.value === selectedGame) || GAMES[0]}
            onChange={(_, newValue) => {
              if (newValue) setSelectedGame(newValue.value);
            }}
            options={GAMES}
            getOptionLabel={(option) => option.label}
            size="small"
            sx={{ minWidth: 140 }}
            renderInput={(params) => (
              <TextField {...params} variant="outlined" size="small" />
            )}
          />
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
        <Box sx={{ mb: 2 }}>
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
        </Box>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card sx={{ border: "2px solid", borderColor: "rgba(103,232,249,0.4)", background: "rgba(103,232,249,0.03)" }}>
          <CardContent sx={{ py: 2 }}>
            <div className="flex justify-between items-center mb-2">
              <Typography variant="subtitle1" fontWeight={600} sx={{ color: "#67e8f9" }}>
                Yin — {result.teamAScore}
              </Typography>
              <Button
                size="medium"
                variant="contained"
                startIcon={<EmojiEventsIcon />}
                onClick={() => openConfirmWin("yin")}
                sx={{
                  bgcolor: "#67e8f9",
                  color: "#0f0f0f",
                  border: "2px solid rgba(255,255,255,0.5)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                  fontWeight: 700,
                  px: 2,
                  "&:hover": {
                    bgcolor: "#22d3ee",
                    boxShadow: "0 4px 12px rgba(103,232,249,0.4)",
                    borderColor: "rgba(255,255,255,0.8)",
                  },
                }}
              >
                Yin Won
              </Button>
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
              <Button
                size="medium"
                variant="contained"
                startIcon={<EmojiEventsIcon />}
                onClick={() => openConfirmWin("yang")}
                sx={{
                  bgcolor: "#f9a8d4",
                  color: "#0f0f0f",
                  border: "2px solid rgba(255,255,255,0.5)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                  fontWeight: 700,
                  px: 2,
                  "&:hover": {
                    bgcolor: "#f472b6",
                    boxShadow: "0 4px 12px rgba(249,168,212,0.4)",
                    borderColor: "rgba(255,255,255,0.8)",
                  },
                }}
              >
                Yang Won
              </Button>
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
            Record <strong>{confirmWinTeam === "yin" ? "Yin" : "Yang"}</strong> as winner for{" "}
            {GAMES.find((g) => g.value === selectedGame)?.label ?? selectedGame}?
          </Typography>
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
    </Box>
  );
}
