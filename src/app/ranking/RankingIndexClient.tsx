"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Box, Typography } from "@mui/material";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";

type PlayerRow = {
  id: string;
  playerName: string;
  scores: (number | null)[];
  elo?: number;
};

const GAMES = [
  { slug: "lol", name: "League of Legends" },
  { slug: "ow", name: "Overwatch" },
  { slug: "sc", name: "Survival Chaos" },
  { slug: "battlerite", name: "Battlerite" },
];

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
  const { data: session } = useSession();
  const currentUserName = (session?.user?.name ?? session?.user?.email ?? "").trim().toLowerCase();

  const [customByGame, setCustomByGame] = useState<Record<string, { rank: number; name: string; elo: number }[]>>({});
  const [queueByGame, setQueueByGame] = useState<Record<string, { rank: number; name: string; elo: number }[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      Promise.all(GAMES.map((g) => fetchTopPlayers(g.slug).then((list) => ({ slug: g.slug, list })))),
      Promise.all(GAMES.map((g) => fetchTopPlayers(g.slug, "ranked_queue").then((list) => ({ slug: g.slug, list })))),
    ]).then(([customResults, queueResults]) => {
      if (cancelled) return;
      const custom: Record<string, { rank: number; name: string; elo: number }[]> = {};
      const queue: Record<string, { rank: number; name: string; elo: number }[]> = {};
      customResults.forEach(({ slug, list }) => { custom[slug] = list; });
      queueResults.forEach(({ slug, list }) => { queue[slug] = list; });
      setCustomByGame(custom);
      setQueueByGame(queue);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  function PlayerList({
    list,
    accentColor,
    isQueue,
  }: {
    list: { rank: number; name: string; elo: number }[];
    accentColor: string;
    isQueue: boolean;
  }) {
    return (
      <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none" }}>
        {list.map((p) => {
          const isYou = currentUserName && (p.name ?? "").trim().toLowerCase() === currentUserName;
          return (
            <Box
              key={p.name}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                py: 0.5,
                px: 1,
                borderRadius: 1,
                ...(isYou ? { border: "1px solid rgba(251, 191, 36, 0.6)", bgcolor: "rgba(251, 191, 36, 0.08)" } : {}),
              }}
            >
              <Box sx={{ width: 24, textAlign: "center", flexShrink: 0 }}>
                {p.rank === 1 ? (
                  <EmojiEventsIcon sx={{ fontSize: 18, color: "#fbbf24" }} />
                ) : (
                  <Typography variant="caption" color="text.secondary">{p.rank}</Typography>
                )}
              </Box>
              <Typography
                variant="body2"
                sx={{
                  color: isYou ? "#fcd34d" : "rgba(255,255,255,0.9)",
                  fontWeight: isYou ? 600 : 400,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {p.name}
              </Typography>
              <Typography variant="caption" sx={{ color: accentColor, fontFamily: "monospace", ml: "auto", flexShrink: 0 }}>
                {p.elo}
              </Typography>
            </Box>
          );
        })}
      </Box>
    );
  }

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
      <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 3, alignItems: "stretch", width: "100%", maxWidth: 640, mt: 4 }}>
        <Link href="/ranking/rankedcustom" className="no-underline flex-1" style={{ minWidth: 0 }}>
          <Box
            sx={{
              borderRadius: 3,
              border: "2px solid rgba(59, 130, 246, 0.4)",
              bgcolor: "rgba(59, 130, 246, 0.08)",
              height: "100%",
              overflow: "hidden",
              transition: "border-color 0.2s, background-color 0.2s",
              "&:hover": { borderColor: "rgba(59, 130, 246, 0.7)", bgcolor: "rgba(59, 130, 246, 0.12)" },
            }}
          >
            <Box sx={{ px: 2.5, py: 2, bgcolor: "rgba(59, 130, 246, 0.15)", borderBottom: "1px solid rgba(59, 130, 246, 0.25)" }}>
              <Typography variant="h6" sx={{ color: "#93c5fd", fontWeight: 700, fontSize: "1.25rem", lineHeight: 1.3 }}>
                Custom leaderboard
              </Typography>
              <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.85)", fontWeight: 600, mt: 0.5, fontSize: "0.875rem" }}>
                Team builder games
              </Typography>
            </Box>
            <Box sx={{ p: 2.5 }}>
            {loading ? (
              <Typography variant="body2" color="text.secondary">Loading…</Typography>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                {GAMES.filter((g) => customByGame[g.slug]?.length).map((g) => (
                  <Box key={g.slug} sx={{ borderBottom: "1px solid rgba(255,255,255,0.06)", pb: 2, "&:last-of-type": { borderBottom: "none", pb: 0 } }}>
                    <Typography variant="subtitle1" sx={{ color: "#e0f2fe", fontWeight: 700, mb: 1, fontSize: "1rem" }}>
                      {g.name}
                    </Typography>
                    <PlayerList list={customByGame[g.slug]} accentColor="#93c5fd" isQueue={false} />
                  </Box>
                ))}
                {!GAMES.some((g) => customByGame[g.slug]?.length) && (
                  <Typography variant="body2" color="text.secondary">No data yet</Typography>
                )}
              </Box>
            )}
            </Box>
          </Box>
        </Link>

        <Link href="/ranking/rankedqueue" className="no-underline flex-1" style={{ minWidth: 0 }}>
          <Box
            sx={{
              borderRadius: 3,
              border: "2px solid rgba(251, 191, 36, 0.45)",
              bgcolor: "rgba(251, 191, 36, 0.08)",
              height: "100%",
              overflow: "hidden",
              transition: "border-color 0.2s, background-color 0.2s",
              "&:hover": { borderColor: "rgba(251, 191, 36, 0.75)", bgcolor: "rgba(251, 191, 36, 0.12)" },
            }}
          >
            <Box sx={{ px: 2.5, py: 2, bgcolor: "rgba(251, 191, 36, 0.15)", borderBottom: "1px solid rgba(251, 191, 36, 0.25)" }}>
              <Typography variant="h6" sx={{ color: "#fcd34d", fontWeight: 700, fontSize: "1.25rem", lineHeight: 1.3 }}>
                Ranked leaderboard
              </Typography>
              <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.85)", fontWeight: 600, mt: 0.5, fontSize: "0.875rem" }}>
                Queue games
              </Typography>
            </Box>
            <Box sx={{ p: 2.5 }}>
            {loading ? (
              <Typography variant="body2" color="text.secondary">Loading…</Typography>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
                {GAMES.filter((g) => queueByGame[g.slug]?.length).map((g) => (
                  <Box key={g.slug} sx={{ borderBottom: "1px solid rgba(255,255,255,0.06)", pb: 2, "&:last-of-type": { borderBottom: "none", pb: 0 } }}>
                    <Typography variant="subtitle1" sx={{ color: "#fef3c7", fontWeight: 700, mb: 1, fontSize: "1rem" }}>
                      {g.name}
                    </Typography>
                    <PlayerList list={queueByGame[g.slug]} accentColor="#fcd34d" isQueue={true} />
                  </Box>
                ))}
                {!GAMES.some((g) => queueByGame[g.slug]?.length) && (
                  <Typography variant="body2" color="text.secondary">No data yet</Typography>
                )}
              </Box>
            )}
            </Box>
          </Box>
        </Link>
      </Box>
    </Box>
  );
}
