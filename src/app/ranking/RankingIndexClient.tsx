"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Box, Typography } from "@mui/material";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";

type PlayerRow = {
  id: string;
  playerName: string;
  scores: (number | null)[];
  elo?: number;
};

async function fetchTopPlayers(
  game: string,
  source?: "ranked_queue"
): Promise<{ rank: number; name: string; elo: number }[]> {
  const params = new URLSearchParams({ season: "1" });
  if (source) params.set("source", source);
  const res = await fetch(`/api/ranking/${game}?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  const data = await res.json();
  const players: PlayerRow[] = data.players ?? [];
  const withElo = players
    .filter((p) => p.elo != null)
    .map((p) => ({ name: p.playerName, elo: p.elo as number }));
  withElo.sort((a, b) => b.elo - a.elo);
  return withElo.slice(0, 5).map((p, i) => ({ rank: i + 1, name: p.name, elo: p.elo }));
}

export default function RankingIndexClient() {
  const [customTop, setCustomTop] = useState<{ rank: number; name: string; elo: number }[]>([]);
  const [queueTop, setQueueTop] = useState<{ rank: number; name: string; elo: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchTopPlayers("lol"),
      fetchTopPlayers("lol", "ranked_queue"),
    ]).then(([custom, queue]) => {
      if (!cancelled) {
        setCustomTop(custom);
        setQueueTop(queue);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  return (
    <Box
      sx={{
        minHeight: "calc(100vh - 10rem)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        py: 4,
        px: 2,
      }}
    >
      <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.5)", letterSpacing: 1, mb: 1 }}>
        Ranking
      </Typography>
      <Typography variant="h4" sx={{ color: "text.primary", fontWeight: 700, mb: 1, textAlign: "center" }}>
        Choose a ladder
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4, textAlign: "center", maxWidth: 420 }}>
        Team builder games or queue matchmaking.
      </Typography>

      <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 3, alignItems: "stretch", width: "100%", maxWidth: 560 }}>
        <Link href="/ranking/rankedcustom" className="no-underline flex-1" style={{ minWidth: 0 }}>
          <Box
            sx={{
              p: 3,
              borderRadius: 3,
              border: "2px solid rgba(59, 130, 246, 0.4)",
              bgcolor: "rgba(59, 130, 246, 0.08)",
              height: "100%",
              transition: "border-color 0.2s, background-color 0.2s",
              "&:hover": { borderColor: "rgba(59, 130, 246, 0.7)", bgcolor: "rgba(59, 130, 246, 0.12)" },
            }}
          >
            <Typography variant="overline" sx={{ color: "#93c5fd", letterSpacing: 0.5, fontWeight: 700 }}>
              Ranked Custom
            </Typography>
            <Typography variant="h6" sx={{ color: "#fff", fontWeight: 600, mt: 0.5, mb: 2 }}>
              Team builder games
            </Typography>
            {loading ? (
              <Typography variant="body2" color="text.secondary">Loading…</Typography>
            ) : customTop.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No data yet</Typography>
            ) : (
              <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none" }}>
                {customTop.map((p) => (
                  <Box key={p.name} sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 0.5 }}>
                    <Box sx={{ width: 24, textAlign: "center" }}>
                      {p.rank === 1 ? <EmojiEventsIcon sx={{ fontSize: 18, color: "#fbbf24" }} /> : <Typography variant="caption" color="text.secondary">{p.rank}</Typography>}
                    </Box>
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.9)", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</Typography>
                    <Typography variant="caption" sx={{ color: "#93c5fd", fontFamily: "monospace", ml: "auto" }}>{p.elo}</Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Link>

        <Link href="/ranking/rankedqueue" className="no-underline flex-1" style={{ minWidth: 0 }}>
          <Box
            sx={{
              p: 3,
              borderRadius: 3,
              border: "2px solid rgba(251, 191, 36, 0.45)",
              bgcolor: "rgba(251, 191, 36, 0.08)",
              height: "100%",
              transition: "border-color 0.2s, background-color 0.2s",
              "&:hover": { borderColor: "rgba(251, 191, 36, 0.75)", bgcolor: "rgba(251, 191, 36, 0.12)" },
            }}
          >
            <Typography variant="overline" sx={{ color: "#fcd34d", letterSpacing: 0.5, fontWeight: 700 }}>
              Ranked Queue
            </Typography>
            <Typography variant="h6" sx={{ color: "#fff", fontWeight: 600, mt: 0.5, mb: 2 }}>
              Queue matchmaking
            </Typography>
            {loading ? (
              <Typography variant="body2" color="text.secondary">Loading…</Typography>
            ) : queueTop.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No data yet</Typography>
            ) : (
              <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none" }}>
                {queueTop.map((p) => (
                  <Box key={p.name} sx={{ display: "flex", alignItems: "center", gap: 1.5, py: 0.5 }}>
                    <Box sx={{ width: 24, textAlign: "center" }}>
                      {p.rank === 1 ? <EmojiEventsIcon sx={{ fontSize: 18, color: "#fbbf24" }} /> : <Typography variant="caption" color="text.secondary">{p.rank}</Typography>}
                    </Box>
                    <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.9)", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</Typography>
                    <Typography variant="caption" sx={{ color: "#fcd34d", fontFamily: "monospace", ml: "auto" }}>{p.elo}</Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Link>
      </Box>
    </Box>
  );
}
