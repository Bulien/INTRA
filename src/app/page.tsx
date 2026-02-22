"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Box, Card, CardContent, Typography, Button, Skeleton } from "@mui/material";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { computeElo } from "@/lib/elo";

const GAMES = [
  { slug: "lol", name: "League of Legends", accent: "linear-gradient(135deg, #67e8f9 0%, #22d3ee 100%)" },
  { slug: "ow", name: "Overwatch", accent: "linear-gradient(135deg, #f9a8d4 0%, #f472b6 100%)" },
  { slug: "sc", name: "Survival Chaos", accent: "linear-gradient(135deg, #a5f3fc 0%, #67e8f9 50%, #f9a8d4 100%)" },
  { slug: "battlerite", name: "Battlerite", accent: "linear-gradient(135deg, #fbcfe8 0%, #f9a8d4 100%)" },
];

type RankingPlayer = {
  id: string;
  playerName: string;
  scores: (number | null)[];
};

async function fetchRanking(game: string, season: number) {
  const res = await fetch(`/api/ranking/${game}?season=${season}`, {
    cache: "no-store",
  });
  if (!res.ok) return { players: [] as RankingPlayer[], maxSeason: 1 };
  const data = await res.json();
  return {
    players: (data.players ?? []) as RankingPlayer[],
    maxSeason: data.maxSeason ?? 1,
  };
}

/** Compute stats for ranking preview. For SC: placements 1–4 (games, avg place). For others: wins/losses (games, elo). */
function playerStats(
  scores: (number | null)[],
  gameSlug: string
): { games: number; avg: number; elo: number | null } {
  if (gameSlug === "sc") {
    const placementScores = scores.filter((s): s is number => s !== null && s >= 1 && s <= 4);
    const games = placementScores.length;
    const avg =
      games > 0
        ? Math.round((placementScores.reduce((a, b) => a + b, 0) / games) * 10) / 10
        : 999; // no games → sort last
    return { games, avg, elo: null };
  }
  const wins = scores.filter((s) => s === 1).length;
  const losses = scores.filter((s) => s === 0).length;
  const games = wins + losses;
  const elo = computeElo(wins, losses);
  return { games, avg: elo, elo }; // avg used as sort key (higher = better)
}

export default function HomePage() {
  const router = useRouter();
  const [data, setData] = useState<Record<string, { players: RankingPlayer[]; maxSeason: number }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out: Record<string, { players: RankingPlayer[]; maxSeason: number }> = {};
      for (const g of GAMES) {
        const first = await fetchRanking(g.slug, 1);
        const latest = await fetchRanking(g.slug, first.maxSeason);
        if (!cancelled) out[g.slug] = { players: latest.players, maxSeason: first.maxSeason };
      }
      if (!cancelled) {
        setData(out);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Box sx={{ pb: 6 }}>
      {/* Hero header */}
      <Box
        sx={{
          mb: 5,
          p: 3,
          borderRadius: 2,
          background: "linear-gradient(145deg, rgba(103,232,249,0.08) 0%, rgba(249,168,212,0.06) 40%, rgba(0,0,0,0.25) 100%)",
          border: "1px solid",
          borderColor: "rgba(103,232,249,0.2)",
          position: "relative",
          overflow: "hidden",
          boxShadow: "0 0 60px -12px rgba(103,232,249,0.15), 0 0 40px -12px rgba(249,168,212,0.1)",
        }}
      >
        <Typography
          variant="h3"
          sx={{
            color: "text.primary",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            mb: 1,
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 1.5,
          }}
        >
          <img src="/yin-yang.png" alt="" aria-hidden className="opacity-90 block mix-blend-multiply" style={{ height: 40, width: 40, background: 'transparent' }} />
          INTRA
        </Typography>
        <Typography
          variant="body1"
          sx={{ color: "text.secondary", maxWidth: 480, position: "relative" }}
        >
          Puez pas la merdeeee
        </Typography>
      </Box>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {GAMES.map((g) => (
            <Card
              key={g.slug}
              sx={{
                border: "1px solid",
                borderColor: "rgba(255,255,255,0.08)",
                borderRadius: 2,
                background: "rgba(26, 26, 26, 0.8)",
              }}
            >
              <Box sx={{ height: 4, borderRadius: "8px 8px 0 0", background: g.accent }} />
              <CardContent sx={{ pt: 2, pb: 2.5, "&:last-child": { pb: 2.5 } }}>
                <div className="flex items-center justify-between mb-3">
                  <Skeleton variant="text" width={140} height={32} />
                  <Skeleton variant="rounded" width={56} height={24} sx={{ borderRadius: 1 }} />
                </div>
                <ul className="space-y-0">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <li key={i} className="flex items-center justify-between py-1.5 px-2 rounded-md gap-3">
                      <span className="flex items-center gap-2 min-w-0 flex-1">
                        <Skeleton variant="text" width={20} height={20} />
                        <Skeleton variant="text" width={80 + (i % 3) * 20} height={20} sx={{ maxWidth: 160 }} />
                      </span>
                      <Skeleton variant="text" width={48} height={18} />
                      <Skeleton variant="text" width={36} height={18} />
                    </li>
                  ))}
                </ul>
                <Skeleton variant="rounded" width={100} height={32} sx={{ mt: 2, borderRadius: 1 }} />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {GAMES.map((g) => {
            const d = data[g.slug];
            const players = d?.players ?? [];
            const lowerIsBetter = g.slug === "sc"; // SC: lowest avg placement = best
            const withAvg = players
              .map((p) => ({ ...p, ...playerStats(p.scores, g.slug) }))
              .filter((p) => p.playerName?.trim())
              .filter((p) => p.games > 0) // only players with at least one game in this mode
              .sort((a, b) => (lowerIsBetter ? a.avg - b.avg : b.avg - a.avg))
              .slice(0, 10);
            return (
              <Card
                key={g.slug}
                component={Link}
                href={`/ranking/${g.slug}`}
                sx={{
                  textDecoration: "none",
                  border: "1px solid",
                  borderColor: "rgba(255,255,255,0.08)",
                  borderRadius: 2,
                  background: "rgba(26, 26, 26, 0.8)",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.3), 0 0 40px -8px rgba(103,232,249,0.06), 0 0 30px -8px rgba(249,168,212,0.05)",
                  transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
                  "&:hover": {
                    transform: "translateY(-2px)",
                    boxShadow: "0 12px 32px rgba(0,0,0,0.35), 0 0 50px -8px rgba(103,232,249,0.2), 0 0 40px -8px rgba(249,168,212,0.12)",
                    borderColor: "rgba(103,232,249,0.4)",
                  },
                }}
              >
                <Box
                  sx={{
                    height: 4,
                    borderRadius: "8px 8px 0 0",
                    background: g.accent,
                  }}
                />
                <CardContent sx={{ pt: 2, pb: 2.5, "&:last-child": { pb: 2.5 } }}>
                  <div className="flex items-center justify-between mb-3">
                    <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 700 }}>
                      {g.name}
                    </Typography>
                    {d && (
                      <Typography
                        variant="caption"
                        sx={{
                          px: 1.5,
                          py: 0.5,
                          borderRadius: 1,
                          bgcolor: "rgba(103,232,249,0.2)",
                          color: "#67e8f9",
                          fontWeight: 600,
                        }}
                      >
                        Season {d.maxSeason}
                      </Typography>
                    )}
                  </div>
                  {withAvg.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                      No results yet
                    </Typography>
                  ) : (
                    <ul className="space-y-0">
                      {withAvg.map((p, i) => (
                        <li
                          key={p.id}
                          className="flex items-center justify-between py-1.5 px-2 rounded-md gap-3"
                          style={{
                            backgroundColor: i < 3 ? "rgba(255,255,255,0.03)" : "transparent",
                          }}
                        >
                          <span className="flex items-center gap-2 min-w-0 flex-1">
                            {i === 0 && <EmojiEventsIcon sx={{ fontSize: 20, color: "#fbbf24" }} />}
                            {i === 1 && <EmojiEventsIcon sx={{ fontSize: 18, color: "#9ca3af" }} />}
                            {i === 2 && <EmojiEventsIcon sx={{ fontSize: 16, color: "#b45309" }} />}
                            {i > 2 && (
                              <span style={{ width: 20, textAlign: "center", fontSize: "0.75rem" }} className="text-neutral-500">
                                {i + 1}
                              </span>
                            )}
                            <button
                              type="button"
                              className="font-medium truncate text-cyan-200 hover:text-cyan-100 hover:underline text-left bg-transparent border-0 cursor-pointer p-0"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (p.playerName?.trim()) router.push(`/profile/${encodeURIComponent(p.playerName.trim())}`);
                              }}
                            >
                              {p.playerName || "—"}
                            </button>
                          </span>
                          <Typography
                            component="span"
                            sx={{
                              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                              fontSize: "0.8rem",
                              color: "text.secondary",
                              flexShrink: 0,
                            }}
                          >
                            {p.games} games
                          </Typography>
                          <Typography
                            component="span"
                            sx={{
                              fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                              fontSize: "0.875rem",
                              fontWeight: 600,
                              letterSpacing: "0.02em",
                              color: g.slug === "sc" ? "#a5f3fc" : p.elo !== null ? "#a5f3fc" : "text.secondary",
                              flexShrink: 0,
                            }}
                          >
                            {g.slug === "sc" ? (p.games > 0 ? `Avg ${Number(p.avg).toFixed(1)}` : "—") : (p.elo !== null ? p.elo : "—")}
                          </Typography>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Button
                    component="span"
                    size="small"
                    endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
                    sx={{
                      mt: 2,
                      color: "#67e8f9",
                      "&:hover": { bgcolor: "rgba(103,232,249,0.15)" },
                    }}
                  >
                    Full ranking
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </Box>
  );
}
