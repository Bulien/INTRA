"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  IconButton,
  Paper,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import RefreshIcon from "@mui/icons-material/Refresh";
import FlagIcon from "@mui/icons-material/Flag";
import { sanitizeDisplayName } from "@/lib/sanitizeInput";

export interface RankRow {
  id: string;
  playerName: string;
  scores: (number | null)[];
}

async function fetchData(
  gameType: string,
  season: number
): Promise<{
  players: RankRow[];
  maxSeason: number;
  validatedGameIndices: number[];
  validatedPlayerIds: string[];
}> {
  const res = await fetch(
    `/api/ranking/${gameType}?season=${season}`,
    { cache: "no-store" }
  );
  if (!res.ok) return { players: [], maxSeason: 1, validatedGameIndices: [], validatedPlayerIds: [] };
  const data = await res.json();
  return {
    players: data.players ?? [],
    maxSeason: data.maxSeason ?? 1,
    validatedGameIndices: data.validatedGameIndices ?? [],
    validatedPlayerIds: data.validatedPlayerIds ?? [],
  };
}

async function saveData(
  gameType: string,
  season: number,
  rows: RankRow[],
  validatedGameIndices?: number[],
  validatedPlayerIds?: string[]
): Promise<void> {
  const body: {
    season: number;
    players: RankRow[];
    validatedGameIndices?: number[];
    validatedPlayerIds?: string[];
  } = { season, players: rows };
  if (validatedGameIndices !== undefined) body.validatedGameIndices = validatedGameIndices;
  if (validatedPlayerIds !== undefined) body.validatedPlayerIds = validatedPlayerIds;
  await fetch(`/api/ranking/${gameType}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const SCORE_01_GAMES = ["lol", "ow", "battlerite"];
const SCORE_1_4_GAMES = ["sc"];

function clampScore(gameType: string, value: number | null): number | null {
  if (value === null || value === undefined || isNaN(value)) return null;
  if (SCORE_1_4_GAMES.includes(gameType)) {
    const n = Math.round(value);
    if (n >= 1 && n <= 4) return n;
    return Math.max(1, Math.min(4, n));
  }
  if (SCORE_01_GAMES.includes(gameType)) {
    const n = Math.round(value);
    if (n === 0 || n === 1) return n;
    return n >= 1 ? 1 : 0;
  }
  return value;
}

/** When user types in score field, treat a single valid digit as replacing the whole value. */
function parseScoreInput(gameType: string, value: string): number | null {
  if (value === "") return null;
  const trimmed = value.trim();
  if (SCORE_01_GAMES.includes(gameType)) {
    const last = trimmed.slice(-1);
    if (last === "0") return 0;
    if (last === "1") return 1;
    return clampScore(gameType, parseFloat(trimmed));
  }
  if (SCORE_1_4_GAMES.includes(gameType)) {
    const last = trimmed.slice(-1);
    const n = parseInt(last, 10);
    if (n >= 1 && n <= 4) return n;
    return clampScore(gameType, parseFloat(trimmed));
  }
  const parsed = parseFloat(trimmed);
  return parsed === undefined || isNaN(parsed) ? null : parsed;
}

function scoreInputProps(gameType: string) {
  const base = { maxLength: 1, inputMode: "numeric" as const };
  if (SCORE_1_4_GAMES.includes(gameType)) {
    return { ...base, min: 1, max: 4, step: 1 };
  }
  if (SCORE_01_GAMES.includes(gameType)) {
    return { ...base, min: 0, max: 1, step: 1 };
  }
  return { ...base, step: 1 };
}

export function RankingClient({
  gameType,
  gameName,
  isAdmin = false,
}: {
  gameType: string;
  gameName: string;
  isAdmin?: boolean;
}) {
  const [rows, setRows] = useState<RankRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [season, setSeason] = useState(1);
  const [maxSeason, setMaxSeason] = useState(1);
  const [validatedGameIndices, setValidatedGameIndices] = useState<number[]>([]);
  const [validatedPlayerIds, setValidatedPlayerIds] = useState<string[]>([]);
  const lastPlayerNameInputRef = useRef<HTMLInputElement>(null);
  const shouldFocusNewPlayerRef = useRef(false);
  const initialSeasonSetRef = useRef(false);

  const gameCount =
    rows.length > 0 ? Math.max(1, ...rows.map((r) => r.scores.length)) : 1;
  const isSeasonLocked = season < maxSeason;

  const load = useCallback(async (seasonToLoad?: number) => {
    setLoading(true);
    const s = seasonToLoad ?? season;
    const data = await fetchData(gameType, s);
    setMaxSeason(data.maxSeason);
    if (!initialSeasonSetRef.current && data.maxSeason >= 1) {
      initialSeasonSetRef.current = true;
      setSeason(data.maxSeason);
      const dataLatest = await fetchData(gameType, data.maxSeason);
      setRows(dataLatest.players);
      setValidatedGameIndices(dataLatest.validatedGameIndices);
      setValidatedPlayerIds(dataLatest.validatedPlayerIds);
    } else {
      setRows(data.players);
      setValidatedGameIndices(data.validatedGameIndices);
      setValidatedPlayerIds(data.validatedPlayerIds);
    }
    setLoading(false);
  }, [gameType, season]);

  useEffect(() => {
    load();

    const handleUpdate = (e: Event) => {
      const ce = e as CustomEvent;
      if (!ce.detail || ce.detail.gameType === gameType) load();
    };
    window.addEventListener("rankingUpdated", handleUpdate);
    return () => window.removeEventListener("rankingUpdated", handleUpdate);
  }, [gameType, season, load]);

  const persist = useCallback(
    async (
      next: RankRow[],
      validatedGame?: number[],
      validatedPlayer?: string[]
    ) => {
      setRows(next);
      if (validatedGame !== undefined) setValidatedGameIndices(validatedGame);
      if (validatedPlayer !== undefined) setValidatedPlayerIds(validatedPlayer);
      setSaving(true);
      try {
        await saveData(
          gameType,
          season,
          next,
          validatedGame,
          validatedPlayer
        );
      } finally {
        setSaving(false);
      }
    },
    [gameType, season]
  );

  const validateRow = useCallback(
    (gameIdx: number) => {
      const next = [...validatedGameIndices, gameIdx].filter(
        (v, i, a) => a.indexOf(v) === i
      ).sort((a, b) => a - b);
      persist(rows, next, validatedPlayerIds);
    },
    [gameType, season, rows, validatedGameIndices, validatedPlayerIds, persist]
  );

  const unvalidateRow = useCallback(
    (gameIdx: number) => {
      const next = validatedGameIndices.filter((i) => i !== gameIdx);
      persist(rows, next, validatedPlayerIds);
    },
    [gameType, season, rows, validatedGameIndices, validatedPlayerIds, persist]
  );

  const validatePlayer = useCallback(
    (playerId: string) => {
      if (validatedPlayerIds.includes(playerId)) return;
      persist(rows, validatedGameIndices, [...validatedPlayerIds, playerId]);
    },
    [rows, validatedGameIndices, validatedPlayerIds, persist]
  );

  const unvalidatePlayer = useCallback(
    (playerId: string) => {
      persist(
        rows,
        validatedGameIndices,
        validatedPlayerIds.filter((id) => id !== playerId)
      );
    },
    [rows, validatedGameIndices, validatedPlayerIds, persist]
  );

  const endSeason = useCallback(async () => {
    if (
      !confirm(
        `End Season ${season} and start Season ${season + 1}? You can still view past seasons from the dropdown.`
      )
    )
      return;
    try {
      const res = await fetch(`/api/ranking/${gameType}/end-season`, {
        method: "POST",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.maxSeason != null) {
        const nextSeason = data.maxSeason;
        setMaxSeason(nextSeason);
        setSeason(nextSeason);
        const fresh = await fetchData(gameType, nextSeason);
        setRows(fresh.players);
      }
    } catch (e) {
      console.error("Failed to end season:", e);
    }
  }, [gameType, season]);

  const deleteCurrentSeason = useCallback(async () => {
    if (
      !confirm(
        `Delete Season ${maxSeason} and all its data? The current season will become Season ${maxSeason - 1}. This cannot be undone.`
      )
    )
      return;
    try {
      const res = await fetch(`/api/ranking/${gameType}/delete-current-season`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Failed to delete season");
        return;
      }
      const data = await res.json();
      if (data.maxSeason != null) {
        setMaxSeason(data.maxSeason);
        setSeason(data.maxSeason);
        load(data.maxSeason);
      }
      window.dispatchEvent(new CustomEvent("rankingUpdated", { detail: { gameType } }));
    } catch (e) {
      console.error("Failed to delete current season:", e);
      alert("Failed to delete season");
    }
  }, [gameType, maxSeason, load]);

  const addPlayer = () => {
    const id = crypto.randomUUID();
    const cols = Math.max(1, rows[0]?.scores.length ?? gameCount);
    shouldFocusNewPlayerRef.current = true;
    persist([
      ...rows,
      { id, playerName: "", scores: Array(cols).fill(null) },
    ]);
  };

  const addPlayerAndValidateCurrent = useCallback(
    (currentPlayerId: string) => {
      const id = crypto.randomUUID();
      const cols = Math.max(1, rows[0]?.scores.length ?? gameCount);
      shouldFocusNewPlayerRef.current = true;
      const nextRows = [
        ...rows,
        { id, playerName: "", scores: Array(cols).fill(null) },
      ];
      const nextValidatedPlayerIds = validatedPlayerIds.includes(currentPlayerId)
        ? validatedPlayerIds
        : [...validatedPlayerIds, currentPlayerId];
      persist(nextRows, validatedGameIndices, nextValidatedPlayerIds);
    },
    [rows, validatedGameIndices, validatedPlayerIds, persist]
  );

  useEffect(() => {
    if (!shouldFocusNewPlayerRef.current || rows.length === 0) return;
    shouldFocusNewPlayerRef.current = false;
    const id = setTimeout(() => lastPlayerNameInputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [rows.length]);

  const addGame = () => {
    persist(rows.map((r) => ({ ...r, scores: [...r.scores, null] })));
  };

  const removeGame = (gameIdx: number) => {
    const nextRows = rows.map((r) => ({
      ...r,
      scores: r.scores.filter((_, i) => i !== gameIdx),
    }));
    const nextValidated = validatedGameIndices
      .filter((i) => i !== gameIdx)
      .map((i) => (i > gameIdx ? i - 1 : i));
    persist(nextRows, nextValidated, validatedPlayerIds);
  };

  const updatePlayerName = (rowId: string, name: string) => {
    const safe = sanitizeDisplayName(name);
    persist(rows.map((r) => (r.id === rowId ? { ...r, playerName: safe } : r)));
  };

  const updateScore = (rowId: string, gameIdx: number, value: string) => {
    persist(
      rows.map((r) => {
        if (r.id !== rowId) return r;
        const next = [...r.scores];
        next[gameIdx] = parseScoreInput(gameType, value);
        return { ...r, scores: next };
      })
    );
  };

  const removePlayer = (rowId: string) => {
    persist(rows.filter((r) => r.id !== rowId));
  };

  const resetRanking = () => {
    if (
      confirm(
        `Reset all ranking data for ${gameName} Season ${season}? This cannot be undone.`
      )
    ) {
      persist([], [], []);
    }
  };

  const maxCols = Math.max(1, ...rows.map((r) => r.scores.length), gameCount);
  const normalizedRows = rows.map((r) => {
    const scores = [
      ...r.scores,
      ...Array(Math.max(0, maxCols - r.scores.length)).fill(null),
    ].slice(0, maxCols);
    return { ...r, scores };
  });

  const playerAverages = normalizedRows.map((r) => {
    const valid = r.scores.filter((s) => s !== null && !isNaN(s as number)) as number[];
    if (!valid.length) return 0;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
  });

  const exportCsv = () => {
    const header = ["Game", ...normalizedRows.map((r) => r.playerName || "(unnamed)")];
    const totalRow = ["total", ...playerAverages.map((a) => a.toFixed(2).replace(".", ","))];
    const gameRows = Array.from({ length: maxCols }, (_, gi) => [
      String(gi + 1),
      ...normalizedRows.map((r) => {
        const v = r.scores[gi];
        return v === null || v === undefined ? "" : String(v);
      }),
    ]);
    const lines = [header, totalRow, ...gameRows].map((r) => r.join("\t"));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${gameType}-season-${season}-ranking.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <div className="flex items-center gap-2 mb-6">
        <Typography variant="h4" sx={{ color: "text.primary" }}>
          {gameName}
        </Typography>
        {saving && <CircularProgress size={16} />}
      </div>

      <div className="flex flex-wrap gap-2 items-center mb-4">
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Season</InputLabel>
          <Select
            value={season}
            label="Season"
            onChange={(e) => setSeason(Number(e.target.value))}
          >
            {Array.from({ length: maxSeason }, (_, i) => i + 1).map((s) => (
              <MenuItem key={s} value={s}>
                Season {s}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {isAdmin && (
          <>
            <Button variant="contained" startIcon={<AddIcon />} onClick={addPlayer}>
              Add player
            </Button>
            <Button variant="outlined" size="small" onClick={addGame}>
              Add game
            </Button>
            <Button variant="outlined" startIcon={<FileDownloadIcon />} onClick={exportCsv}>
              Export CSV
            </Button>
            <Button
              variant="outlined"
              color="primary"
              size="small"
              startIcon={<FlagIcon />}
              onClick={endSeason}
              title="End current season and start the next one"
            >
              End season
            </Button>
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<RefreshIcon />}
              onClick={resetRanking}
            >
              Reset
            </Button>
            <Button
              variant="outlined"
              color="warning"
              size="small"
              onClick={deleteCurrentSeason}
              title="Delete current season and go back to previous"
            >
              Delete current season
            </Button>
          </>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <CircularProgress />
        </div>
      ) : (
        <TableContainer
          component={Paper}
          sx={{
            border: "1px solid",
            borderColor: "rgba(103,232,249,0.2)",
            borderRadius: 1,
            overflow: "auto",
            width: "100%",
          }}
        >
          <Table
            size="small"
            sx={{
              width: "100%",
              tableLayout: "fixed",
              minWidth: 400,
            }}
          >
            <TableHead>
              <TableRow sx={{ bgcolor: "rgba(103,232,249,0.1)" }}>
                {isAdmin && <TableCell sx={{ width: 40, minWidth: 40, maxWidth: 40, py: 1 }} />}
                <TableCell sx={{ fontWeight: 700, fontSize: "0.85rem", py: 1, width: 56, minWidth: 52 }}>
                  Game
                </TableCell>
                {normalizedRows.map((r, index) => {
                  const isPlayerValidated = validatedPlayerIds.includes(r.id);
                  return (
                    <TableCell key={r.id} align="center" sx={{ fontWeight: 700, fontSize: "0.85rem", py: 1 }}>
                      <div className="flex items-center justify-center gap-1">
                        {!isAdmin ? (
                          <Typography variant="body2" sx={{ fontSize: "0.8rem", flex: 1, textAlign: "center" }}>
                            {r.playerName || "\u00a0"}
                          </Typography>
                        ) : isPlayerValidated ? (
                          <>
                            <Typography variant="body2" sx={{ fontSize: "0.8rem", flex: 1, textAlign: "center" }}>
                              {r.playerName || "\u00a0"}
                            </Typography>
                            <IconButton
                              size="small"
                              onClick={() => unvalidatePlayer(r.id)}
                              title="Edit player name"
                              color="primary"
                              sx={{ p: 0.25, flexShrink: 0 }}
                            >
                              <EditIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </>
                        ) : (
                          <>
                            <TextField
                              inputRef={index === normalizedRows.length - 1 ? lastPlayerNameInputRef : undefined}
                              value={r.playerName}
                              onChange={(e) => updatePlayerName(r.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  addPlayerAndValidateCurrent(r.id);
                                }
                              }}
                              placeholder="Name"
                              size="small"
                              fullWidth
                              sx={{
                                minWidth: 0,
                                "& .MuiInputBase-root": { height: 28 },
                                "& .MuiInputBase-input": { py: 0.5, fontSize: "0.8rem", textAlign: "center" },
                              }}
                            />
                            <IconButton
                              size="small"
                              onClick={() => validatePlayer(r.id)}
                              title="Validate and lock in"
                              color="success"
                              sx={{ p: 0.25, flexShrink: 0 }}
                            >
                              <CheckIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                            <IconButton size="small" onClick={() => removePlayer(r.id)} color="error" sx={{ p: 0.25, flexShrink: 0 }}>
                              <DeleteIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </>
                        )}
                      </div>
                    </TableCell>
                  );
                })}
                {normalizedRows.length === 0 && (
                  <TableCell sx={{ fontWeight: 700, fontSize: "0.85rem", py: 1 }}>
                    (No players)
                  </TableCell>
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {/* Total / averages row */}
              <TableRow sx={{ bgcolor: "rgba(249,168,212,0.06)", "&:hover": { bgcolor: "rgba(249,168,212,0.1)" } }}>
                {isAdmin && <TableCell sx={{ width: 40, minWidth: 40, maxWidth: 40, py: 0.5, bgcolor: "rgba(103,232,249,0.08)" }} />}
                <TableCell sx={{ fontWeight: 700, fontSize: "0.85rem", py: 0.5, bgcolor: "rgba(103,232,249,0.08)", width: 56, minWidth: 52 }}>
                  total
                </TableCell>
                {normalizedRows.map((_, idx) => (
                  <TableCell
                    key={idx}
                    align="center"
                    sx={{ fontWeight: 700, fontSize: "0.85rem", py: 0.5, bgcolor: "rgba(103,232,249,0.08)", color: "#67e8f9" }}
                  >
                    {playerAverages[idx].toFixed(2).replace(".", ",")}
                  </TableCell>
                ))}
                {normalizedRows.length === 0 && (
                  <TableCell align="center" sx={{ fontWeight: 700, fontSize: "0.85rem", py: 0.5, bgcolor: "rgba(103,232,249,0.08)" }}>-</TableCell>
                )}
              </TableRow>
              {/* Game rows */}
              {Array.from({ length: maxCols }, (_, gameIdx) => {
                const isRowValidated = validatedGameIndices.includes(gameIdx);
                const isRowLocked = isSeasonLocked || isRowValidated || !isAdmin;
                return (
                  <TableRow
                    key={gameIdx}
                    sx={{ bgcolor: gameIdx % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent", "&:hover": { bgcolor: "rgba(255,255,255,0.05)" } }}
                  >
                    {isAdmin && (
                      <TableCell sx={{ width: 40, minWidth: 40, maxWidth: 40, py: 0.5, bgcolor: gameIdx % 2 === 0 ? "rgba(103,232,249,0.04)" : "rgba(249,168,212,0.04)", verticalAlign: "middle" }}>
                        {!isSeasonLocked && (
                          isRowValidated ? (
                            <IconButton
                              size="small"
                              onClick={() => unvalidateRow(gameIdx)}
                              title="Edit this row"
                              color="primary"
                              sx={{ p: 0.25 }}
                            >
                              <EditIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          ) : (
                            <IconButton
                              size="small"
                              onClick={() => validateRow(gameIdx)}
                              title="Validate and lock this row"
                              color="success"
                              sx={{ p: 0.25 }}
                            >
                              <CheckIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          )
                        )}
                      </TableCell>
                    )}
                    <TableCell sx={{ fontWeight: 600, fontSize: "0.85rem", py: 0.5, bgcolor: gameIdx % 2 === 0 ? "rgba(103,232,249,0.06)" : "rgba(249,168,212,0.06)", width: 56, minWidth: 52 }}>
                      <div className="flex items-center gap-1">
                        <span>{gameIdx + 1}</span>
                        {isAdmin && maxCols > 1 && !isRowLocked && (
                          <IconButton size="small" onClick={() => removeGame(gameIdx)} sx={{ p: 0.25 }}>
                            <DeleteIcon sx={{ fontSize: 12 }} />
                          </IconButton>
                        )}
                      </div>
                    </TableCell>
                    {normalizedRows.map((r) => (
                      <TableCell key={r.id} sx={{ py: 0.5 }}>
                        {isRowLocked ? (
                          <Typography variant="body2" sx={{ textAlign: "center", py: 0.5, fontSize: "0.8rem" }}>
                            {r.scores[gameIdx] === null || r.scores[gameIdx] === undefined ? "" : String(r.scores[gameIdx])}
                          </Typography>
                        ) : (
                          <TextField
                            type="text"
                            inputMode="numeric"
                            value={r.scores[gameIdx] === null ? "" : String(r.scores[gameIdx])}
                            onChange={(e) => updateScore(r.id, gameIdx, e.target.value)}
                            onKeyDown={(e) => {
                              if ([".", ",", "e", "E", "-", "+"].includes(e.key)) e.preventDefault();
                            }}
                            size="small"
                            fullWidth
                            inputProps={scoreInputProps(gameType)}
                            sx={{
                              minWidth: 0,
                              "& .MuiInputBase-root": { height: 28 },
                              "& .MuiInputBase-input": { py: 0.5, fontSize: "0.8rem", textAlign: "center" },
                            }}
                          />
                        )}
                      </TableCell>
                    ))}
                    {normalizedRows.length === 0 && <TableCell sx={{ py: 0.5 }}>-</TableCell>}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
