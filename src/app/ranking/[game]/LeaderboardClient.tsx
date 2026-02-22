"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { Box, Skeleton, Typography } from "@mui/material";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import { computeElo } from "@/lib/elo";

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

function computeStats(scores: (number | null)[], gameType: string) {
  if (gameType === "sc") {
    const placementScores = scores.filter((s) => s !== null && s >= 1 && s <= 4) as number[];
    const games = placementScores.length;
    const avgPlace =
      games > 0
        ? Math.round((placementScores.reduce((a, b) => a + b, 0) / games) * 10) / 10
        : 0;
    return { wins: 0, losses: 0, games, winrate: 0, avgPlace, elo: 0, isSc: true };
  }
  const wins = scores.filter((s) => s === 1).length;
  const losses = scores.filter((s) => s === 0).length;
  const games = wins + losses;
  const winrate = games > 0 ? Math.round((wins / games) * 100) : 0;
  const elo = computeElo(wins, losses);
  return { wins, losses, games, winrate, avgPlace: 0, elo, isSc: false };
}

type RowWithStats = PlayerRow & {
  wins: number;
  losses: number;
  games: number;
  winrate: number;
  avgPlace: number;
  elo: number;
  isSc: boolean;
};

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
        ...computeStats(p.scores, gameType),
      })) as RowWithStats[];
      list.sort((a, b) =>
        gameType === "sc"
          ? (a.avgPlace || 999) - (b.avgPlace || 999) || (a.playerName || "").localeCompare(b.playerName || "")
          : b.elo - a.elo || (a.playerName || "").localeCompare(b.playerName || "")
      );
      setPlayers(list);
    } else {
      const list = (data.players ?? []).map((p) => ({
        ...p,
        ...computeStats(p.scores, gameType),
      })) as RowWithStats[];
      list.sort((a, b) =>
        gameType === "sc"
          ? (a.avgPlace || 999) - (b.avgPlace || 999) || (a.playerName || "").localeCompare(b.playerName || "")
          : b.elo - a.elo || (a.playerName || "").localeCompare(b.playerName || "")
      );
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
        <Box sx={{ display: "flex", flexDirection: "column", flex: 1, gap: 0, pr: 1 }}>
          {Array.from({ length: 14 }).map((_, i) => (
            <Box
              key={i}
              sx={{
                display: "grid",
                gridTemplateColumns: gameType === "sc" ? "56px 1fr 80px 80px" : "56px 1fr 72px 72px 80px",
                gap: 2,
                alignItems: "center",
                py: 1.5,
                px: 2,
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <Skeleton variant="text" width={36} height={24} sx={{ flexShrink: 0 }} />
              <Skeleton variant="text" width={140} height={24} sx={{ maxWidth: "100%" }} />
              <Skeleton variant="text" width={48} height={20} />
              <Skeleton variant="text" width={48} height={20} />
              {gameType !== "sc" && <Skeleton variant="text" width={40} height={20} />}
            </Box>
          ))}
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
              const isSc = gameType === "sc";
              return (
                <Box
                  key={p.id}
                  sx={{
                    display: "grid",
                    gridTemplateColumns: isSc ? "56px 1fr 80px 80px" : "56px 1fr 72px 72px 80px",
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
                  <Link
                    href={`/profile/${encodeURIComponent(p.playerName || "")}`}
                    className="font-semibold text-cyan-200 hover:text-cyan-100 hover:underline truncate block"
                    style={{ color: "inherit", textDecoration: "none" }}
                  >
                    {p.playerName || "—"}
                  </Link>
                  {isSc ? (
                    <>
                      <Typography variant="body2" sx={{ color: "text.secondary", fontVariantNumeric: "tabular-nums" }}>
                        {p.games} games
                      </Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ color: "#67e8f9", fontVariantNumeric: "tabular-nums" }}>
                        Avg {p.avgPlace || "—"}
                      </Typography>
                    </>
                  ) : (
                    <>
                      <Typography variant="body2" sx={{ color: "#86efac", fontVariantNumeric: "tabular-nums" }}>
                        {p.wins} W
                      </Typography>
                      <Typography variant="body2" sx={{ color: "#fca5a5", fontVariantNumeric: "tabular-nums" }}>
                        {p.losses} L
                      </Typography>
                      <Typography variant="body2" fontWeight={600} sx={{ color: "#67e8f9", fontVariantNumeric: "tabular-nums" }}>
                        {p.elo}
                      </Typography>
                    </>
                  )}
                </Box>
              );
            })
          )}
        </Box>
      )}
    </Box>
  );
}
