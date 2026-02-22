"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Typography,
} from "@mui/material";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import { ProfileSkeleton } from "@/components/ProfileSkeleton";

type TeamPlayer = { name: string; rating?: number };

type ScPlacement = { playerName: string; placement: number };

type GameHistoryEntry = {
  id: string;
  gameType: string;
  gameLabel: string;
  season: number;
  winner: string | null;
  createdAt: string;
  createdByName: string;
  userTeam: "yin" | "yang";
  userWon: boolean | null;
  teamYin: TeamPlayer[];
  teamYang: TeamPlayer[];
  scPlacements?: ScPlacement[];
  eloDelta?: number | null;
};

async function fetchUserGameHistory(
  username: string
): Promise<{ games: GameHistoryEntry[]; notFound?: boolean }> {
  const res = await fetch(`/api/users/${encodeURIComponent(username)}/game-history`, { cache: "no-store" });
  if (res.status === 404) return { games: [], notFound: true };
  if (!res.ok) return { games: [] };
  const data = await res.json();
  return { games: data.games ?? [] };
}

const GAME_HISTORY_PAGE_SIZE = 10;

const GAME_FILTERS = [
  { value: "all", label: "All" },
  { value: "lol", label: "LoL" },
  { value: "ow", label: "Overwatch" },
  { value: "sc", label: "Survival Chaos" },
  { value: "battlerite", label: "Battlerite" },
];

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export default function UserGameHistoryPage() {
  const params = useParams();
  const username = typeof params?.username === "string" ? params.username : "";
  const [games, setGames] = useState<GameHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [gameFilter, setGameFilter] = useState<string>("all");
  const [displayLimit, setDisplayLimit] = useState(GAME_HISTORY_PAGE_SIZE);

  useEffect(() => {
    if (!username) {
      setLoading(false);
      return;
    }
    fetchUserGameHistory(username)
      .then(({ games: list, notFound: nf }) => {
        setGames(list);
        if (nf) setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [username]);

  useEffect(() => {
    setDisplayLimit(GAME_HISTORY_PAGE_SIZE);
  }, [gameFilter]);

  if (loading) {
    return <ProfileSkeleton />;
  }

  if (notFound) {
    return (
      <Box sx={{ py: 4, textAlign: "center" }}>
        <Typography variant="h5" sx={{ mb: 2, color: "text.primary" }}>
          User not found
        </Typography>
        <Link href="/search" className="text-cyan-300 hover:text-cyan-200 font-medium">
          Search for a user
        </Link>
      </Box>
    );
  }

  const filteredGames =
    gameFilter === "all" ? games : games.filter((g) => g.gameType === gameFilter);
  const displayedGames = filteredGames.slice(0, displayLimit);
  const hasMore = filteredGames.length > displayLimit;

  return (
    <Box sx={{ pb: 6 }}>
      <Typography variant="h5" sx={{ mb: 2, color: "text.primary", fontWeight: 700 }}>
        Game history
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Completed games this user participated in (result submitted).
      </Typography>

      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center", mb: 3 }}>
        {GAME_FILTERS.map((g) => {
          const isSelected = gameFilter === g.value;
          return (
            <Box
              key={g.value}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={`${g.label}${isSelected ? " (selected)" : ""}`}
              onClick={() => setGameFilter(g.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setGameFilter(g.value);
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
                transition: "border-color 0.2s, background-color 0.2s, color 0.2s",
                "&:hover": {
                  borderColor: isSelected ? "#22c55e" : "rgba(34,197,94,0.4)",
                  bgcolor: isSelected ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.08)",
                },
              }}
            >
              {g.label}
            </Box>
          );
        })}
      </Box>

      {games.length === 0 ? (
        <Typography color="text.secondary">No games recorded yet.</Typography>
      ) : filteredGames.length === 0 ? (
        <Typography color="text.secondary">No games for this filter.</Typography>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {displayedGames.map((g) => (
            <Card
              key={g.id}
              sx={{
                border: "2px solid",
                borderColor:
                  g.userWon === true
                    ? "rgba(34, 197, 94, 0.7)"
                    : g.userWon === false
                      ? "rgba(239, 68, 68, 0.7)"
                      : "rgba(255,255,255,0.1)",
                bgcolor:
                  g.userWon === true
                    ? "rgba(34, 197, 94, 0.08)"
                    : g.userWon === false
                      ? "rgba(239, 68, 68, 0.08)"
                      : "rgba(26,26,26,0.8)",
                borderRadius: 2,
                boxShadow:
                  g.userWon === true
                    ? "0 0 16px rgba(34, 197, 94, 0.35)"
                    : g.userWon === false
                      ? "0 0 16px rgba(239, 68, 68, 0.35)"
                      : "none",
                "&:hover": {
                  borderColor:
                    g.userWon === true
                      ? "rgba(34, 197, 94, 0.9)"
                      : g.userWon === false
                        ? "rgba(239, 68, 68, 0.9)"
                        : "rgba(103, 232, 249, 0.4)",
                  boxShadow:
                    g.userWon === true
                      ? "0 0 20px rgba(34, 197, 94, 0.45)"
                      : g.userWon === false
                        ? "0 0 20px rgba(239, 68, 68, 0.45)"
                        : "none",
                },
              }}
            >
              <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2, mb: 1.5 }}>
                  <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5 }}>
                    <SportsEsportsIcon sx={{ color: "#67e8f9", fontSize: 22 }} />
                    <Link
                      href={`/team-builder?game=${g.id}`}
                      className="text-cyan-200 hover:text-cyan-100 hover:underline"
                      style={{ textDecoration: "none" }}
                    >
                      <Typography component="span" variant="subtitle1" sx={{ fontWeight: 700, color: "#67e8f9" }}>
                        {g.gameLabel}
                      </Typography>
                    </Link>
                    <Chip label={`S${g.season}`} size="small" sx={{ bgcolor: "rgba(255,255,255,0.08)" }} />
                    {g.userWon === true && (
                      <Chip label="Won" size="small" sx={{ bgcolor: "rgba(34, 197, 94, 0.2)", color: "#86efac" }} />
                    )}
                    {g.userWon === false && (
                      <Chip label="Lost" size="small" sx={{ bgcolor: "rgba(239, 68, 68, 0.2)", color: "#fca5a5" }} />
                    )}
                    {g.gameType !== "sc" && g.eloDelta != null && (
                      <Typography
                        component="span"
                        variant="caption"
                        sx={{
                          fontWeight: 700,
                          color: g.eloDelta >= 0 ? "#86efac" : "#fca5a5",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {g.eloDelta >= 0 ? "+" : ""}{g.eloDelta} Elo
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(g.createdAt)}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                  {g.gameType === "sc" ? (
                    (g.scPlacements?.length ?? 0) > 0 ? (
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                        {(g.scPlacements ?? []).map(({ playerName, placement }) => {
                          const label = placement === 1 ? "1st" : placement === 2 ? "2nd" : placement === 3 ? "3rd" : `${placement}th`;
                          return (
                            <Box
                              key={`${playerName}-${placement}`}
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1.5,
                                py: 0.5,
                                px: 1.25,
                                borderRadius: 1,
                                bgcolor: "rgba(255,255,255,0.04)",
                              }}
                            >
                              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", minWidth: 28 }}>
                                {label}
                              </Typography>
                              <Link
                                href={`/profile/${encodeURIComponent(playerName)}`}
                                style={{ textDecoration: "none", color: "#67e8f9", fontWeight: 500, fontSize: "0.875rem" }}
                                className="hover:underline"
                              >
                                {playerName || "—"}
                              </Link>
                            </Box>
                          );
                        })}
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Results not in ranking yet
                      </Typography>
                    )
                  ) : (
                    <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 1.5 }}>
                      <Box
                        sx={{
                          flex: 1,
                          minWidth: 0,
                          p: 1.25,
                          borderRadius: 1.5,
                          bgcolor: "rgba(103, 232, 249, 0.06)",
                          border: "1px solid rgba(103, 232, 249, 0.2)",
                        }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: 700, color: "#67e8f9", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.75 }}>
                          Yin
                        </Typography>
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                          {(g.teamYin ?? []).map((p, i) => (
                            <Link
                              key={i}
                              href={`/profile/${encodeURIComponent(p.name)}`}
                              style={{ textDecoration: "none" }}
                              className="hover:underline"
                            >
                              <Chip
                                label={p.name || "—"}
                                size="small"
                                sx={{
                                  height: 24,
                                  fontSize: "0.8125rem",
                                  bgcolor: "rgba(103, 232, 249, 0.12)",
                                  color: "#a5f3fc",
                                  border: "none",
                                  "&:hover": { bgcolor: "rgba(103, 232, 249, 0.2)" },
                                }}
                              />
                            </Link>
                          ))}
                        </Box>
                      </Box>
                      <Box
                        sx={{
                          flex: 1,
                          minWidth: 0,
                          p: 1.25,
                          borderRadius: 1.5,
                          bgcolor: "rgba(249, 168, 212, 0.06)",
                          border: "1px solid rgba(249, 168, 212, 0.2)",
                        }}
                      >
                        <Typography variant="caption" sx={{ fontWeight: 700, color: "#f9a8d4", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", mb: 0.75 }}>
                          Yang
                        </Typography>
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                          {(g.teamYang ?? []).map((p, i) => (
                            <Link
                              key={i}
                              href={`/profile/${encodeURIComponent(p.name)}`}
                              style={{ textDecoration: "none" }}
                              className="hover:underline"
                            >
                              <Chip
                                label={p.name || "—"}
                                size="small"
                                sx={{
                                  height: 24,
                                  fontSize: "0.8125rem",
                                  bgcolor: "rgba(249, 168, 212, 0.12)",
                                  color: "#fbcfe8",
                                  border: "none",
                                  "&:hover": { bgcolor: "rgba(249, 168, 212, 0.2)" },
                                }}
                              />
                            </Link>
                          ))}
                        </Box>
                      </Box>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          ))}
          {hasMore && (
            <Button
              variant="outlined"
              onClick={() => setDisplayLimit((prev) => prev + GAME_HISTORY_PAGE_SIZE)}
              sx={{
                mt: 1,
                borderColor: "rgba(103,232,249,0.5)",
                color: "#67e8f9",
                "&:hover": { borderColor: "#67e8f9", bgcolor: "rgba(103,232,249,0.08)" },
              }}
            >
              Load 10 more games
            </Button>
          )}
        </Box>
      )}
    </Box>
  );
}
