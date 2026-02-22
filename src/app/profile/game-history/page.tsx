"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Box, Button, Card, CardContent, Chip, Typography } from "@mui/material";
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
};

async function fetchGameHistory(): Promise<GameHistoryEntry[]> {
  const res = await fetch("/api/profile/game-history", { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return data.games ?? [];
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

export default function ProfileGameHistoryPage() {
  const { data: session, status } = useSession();
  const [games, setGames] = useState<GameHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [gameFilter, setGameFilter] = useState<string>("all");
  const [displayLimit, setDisplayLimit] = useState(GAME_HISTORY_PAGE_SIZE);

  useEffect(() => {
    if (status === "unauthenticated") {
      setLoading(false);
      return;
    }
    if (status !== "authenticated") return;
    fetchGameHistory()
      .then(setGames)
      .finally(() => setLoading(false));
  }, [status]);

  useEffect(() => {
    setDisplayLimit(GAME_HISTORY_PAGE_SIZE);
  }, [gameFilter]);

  if (status === "loading" || loading) {
    return <ProfileSkeleton />;
  }

  if (!session?.user) {
    return (
      <Box sx={{ py: 4, textAlign: "center" }}>
        <Typography variant="h5" sx={{ mb: 2, color: "text.primary" }}>
          Sign in to view your game history
        </Typography>
        <Link href="/login" className="text-cyan-300 hover:text-cyan-200 font-medium">
          Go to login
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
        Completed games you participated in (result submitted).
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
                  </Box>
                  <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(g.createdAt)}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
                  {g.gameType === "sc" ? (
                    (g.scPlacements?.length ?? 0) > 0 ? (
                      (g.scPlacements ?? []).map(({ playerName, placement }) => {
                        const label = placement === 1 ? "1st" : placement === 2 ? "2nd" : placement === 3 ? "3rd" : `${placement}th`;
                        return (
                          <Box key={`${playerName}-${placement}`} sx={{ display: "flex", alignItems: "baseline" }}>
                            <Box component="span" sx={{ width: 36, flexShrink: 0 }}>
                              <Typography component="span" variant="body2" color="text.secondary" fontWeight={600}>
                                {label}:
                              </Typography>
                            </Box>
                            <Typography component="span" variant="body2" color="text.secondary">
                              <Link
                                href={`/profile/${encodeURIComponent(playerName)}`}
                                className="text-cyan-200 hover:text-cyan-100 hover:underline"
                              >
                                {playerName || "—"}
                              </Link>
                            </Typography>
                          </Box>
                        );
                      })
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Results not in ranking yet
                      </Typography>
                    )
                  ) : (
                    <>
                      <Box sx={{ display: "flex", alignItems: "baseline" }}>
                        <Box component="span" sx={{ width: 44, flexShrink: 0 }}>
                          <Typography component="span" variant="body2" color="text.secondary" fontWeight={600}>
                            Yin:
                          </Typography>
                        </Box>
                        <Typography component="span" variant="body2" color="text.secondary">
                          {(g.teamYin ?? []).map((p, i) => (
                            <span key={i}>
                              <Link
                                href={`/profile/${encodeURIComponent(p.name)}`}
                                className="text-cyan-200 hover:text-cyan-100 hover:underline"
                              >
                                {p.name || "—"}
                              </Link>
                              {i < (g.teamYin ?? []).length - 1 && ", "}
                            </span>
                          ))}
                        </Typography>
                      </Box>
                      <Box sx={{ display: "flex", alignItems: "baseline" }}>
                        <Box component="span" sx={{ width: 44, flexShrink: 0 }}>
                          <Typography component="span" variant="body2" color="text.secondary" fontWeight={600}>
                            Yang:
                          </Typography>
                        </Box>
                        <Typography component="span" variant="body2" color="text.secondary">
                          {(g.teamYang ?? []).map((p, i) => (
                            <span key={i}>
                              <Link
                                href={`/profile/${encodeURIComponent(p.name)}`}
                                className="text-cyan-200 hover:text-cyan-100 hover:underline"
                              >
                                {p.name || "—"}
                              </Link>
                              {i < (g.teamYang ?? []).length - 1 && ", "}
                            </span>
                          ))}
                        </Typography>
                      </Box>
                    </>
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
