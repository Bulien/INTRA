"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Box, Card, CardContent, Chip, Typography } from "@mui/material";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import { ProfileSkeleton } from "@/components/ProfileSkeleton";

type TeamPlayer = { name: string; rating?: number };

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
};

async function fetchGameHistory(): Promise<GameHistoryEntry[]> {
  const res = await fetch("/api/profile/game-history", { cache: "no-store" });
  if (!res.ok) return [];
  const data = await res.json();
  return data.games ?? [];
}

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

  return (
    <Box sx={{ pb: 6 }}>
      <Typography variant="h5" sx={{ mb: 2, color: "text.primary", fontWeight: 700 }}>
        Game history
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Completed games you participated in (result submitted).
      </Typography>

      {games.length === 0 ? (
        <Typography color="text.secondary">No games recorded yet.</Typography>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {games.map((g) => (
            <Card
              key={g.id}
              sx={{
                border: "1px solid",
                borderColor: "rgba(255,255,255,0.1)",
                bgcolor: "rgba(26,26,26,0.8)",
                borderRadius: 2,
                "&:hover": { borderColor: "rgba(103, 232, 249, 0.4)" },
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
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}
    </Box>
  );
}
