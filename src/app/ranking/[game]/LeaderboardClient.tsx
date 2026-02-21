"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Box, Typography, CircularProgress } from "@mui/material";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";

type PlayerRow = {
  id: string;
  playerName: string;
  scores: (number | null)[];
};

async function fetchLeaderboard(
  gameType: string,
  season: number
): Promise<{ players: PlayerRow[]; maxSeason: number }> {
  const res = await fetch(`/api/ranking/${gameType}?season=${season}`, {
    cache: "no-store",
  });
  if (!res.ok) return { players: [], maxSeason: 1 };
  const data = await res.json();
  return {
    players: data.players ?? [],
    maxSeason: data.maxSeason ?? 1,
  };
}

function computeStats(scores: (number | null)[]) {
  const wins = scores.filter((s) => s === 1).length;
  const losses = scores.filter((s) => s === 0).length;
  const games = wins + losses;
  const winrate = games > 0 ? Math.round((wins / games) * 100) : 0;
  return { wins, losses, games, winrate };
}

type RowWithStats = PlayerRow & { wins: number; losses: number; games: number; winrate: number };

export function LeaderboardClient({
  gameType,
  gameName,
}: {
  gameType: string;
  gameName: string;
}) {
  const [players, setPlayers] = useState<RowWithStats[]>([]);
  const [season, setSeason] = useState(1);
  const [maxSeason, setMaxSeason] = useState(1);
  const [loading, setLoading] = useState(true);
  const initialLoadRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    const useSeason = initialLoadRef.current ? Math.min(Math.max(1, season), 999) : 1;
    const data = await fetchLeaderboard(gameType, useSeason);
    setMaxSeason(data.maxSeason);
    if (!initialLoadRef.current) {
      initialLoadRef.current = true;
      const latestSeason = data.maxSeason;
      setSeason(latestSeason);
      const latest = latestSeason !== useSeason ? await fetchLeaderboard(gameType, latestSeason) : data;
      const list = (latest.players ?? []).map((p) => ({
        ...p,
        ...computeStats(p.scores),
      })) as RowWithStats[];
      list.sort((a, b) => b.wins - a.wins || (a.playerName || "").localeCompare(b.playerName || ""));
      setPlayers(list);
    } else {
      const list = (data.players ?? []).map((p) => ({
        ...p,
        ...computeStats(p.scores),
      })) as RowWithStats[];
      list.sort((a, b) => b.wins - a.wins || (a.playerName || "").localeCompare(b.playerName || ""));
      setPlayers(list);
    }
    setLoading(false);
  }, [gameType, season]);

  useEffect(() => {
    load();
    const handleUpdate = (e: Event) => {
      const ce = e as CustomEvent<{ gameType?: string }>;
      if (!ce.detail?.gameType || ce.detail.gameType === gameType) load();
    };
    window.addEventListener("rankingUpdated", handleUpdate);
    return () => window.removeEventListener("rankingUpdated", handleUpdate);
  }, [gameType, season, load]);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 120px)",
        minHeight: 400,
        overflow: "hidden",
      }}
    >
      <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <Typography variant="h4" sx={{ color: "text.primary", fontWeight: 700 }}>
          {gameName}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Season {season}
        </Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", flex: 1, py: 8 }}>
          <CircularProgress sx={{ color: "#67e8f9" }} />
        </Box>
      ) : (
        <Box
          sx={{
            flex: 1,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 0,
            pr: 1,
          }}
        >
          {players.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
              No players yet. Play team builder and submit results to appear here.
            </Typography>
          ) : (
            players.map((p, index) => {
              const rank = index + 1;
              return (
                <Box
                  key={p.id}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "56px 1fr 72px 72px 80px",
                    gap: 2,
                    alignItems: "center",
                    py: 1.5,
                    px: 2,
                    borderRadius: 1,
                    bgcolor: rank <= 3 ? "rgba(103,232,249,0.06)" : "transparent",
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                    "&:hover": { bgcolor: "rgba(255,255,255,0.03)" },
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    {rank <= 3 && (
                      <EmojiEventsIcon
                        sx={{
                          fontSize: 20,
                          color: rank === 1 ? "#fbbf24" : rank === 2 ? "#94a3b8" : "#b45309",
                        }}
                      />
                    )}
                    <Typography variant="body1" fontWeight={700} sx={{ color: "text.primary", fontVariantNumeric: "tabular-nums" }}>
                      #{rank}
                    </Typography>
                  </Box>
                  <Typography variant="body1" fontWeight={600} sx={{ color: "text.primary" }} noWrap>
                    {p.playerName || "—"}
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#86efac", fontVariantNumeric: "tabular-nums" }}>
                    {p.wins} W
                  </Typography>
                  <Typography variant="body2" sx={{ color: "#fca5a5", fontVariantNumeric: "tabular-nums" }}>
                    {p.losses} L
                  </Typography>
                  <Typography variant="body2" fontWeight={600} sx={{ color: "#67e8f9", fontVariantNumeric: "tabular-nums" }}>
                    {p.winrate}%
                  </Typography>
                </Box>
              );
            })
          )}
        </Box>
      )}
    </Box>
  );
}
