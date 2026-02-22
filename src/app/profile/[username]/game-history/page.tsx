"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Typography,
} from "@mui/material";
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

async function fetchUserGameHistory(
  username: string
): Promise<{ games: GameHistoryEntry[]; notFound?: boolean }> {
  const res = await fetch(`/api/users/${encodeURIComponent(username)}/game-history`, { cache: "no-store" });
  if (res.status === 404) return { games: [], notFound: true };
  if (!res.ok) return { games: [] };
  const data = await res.json();
  return { games: data.games ?? [] };
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

export default function UserGameHistoryPage() {
  const params = useParams();
  const username = typeof params?.username === "string" ? params.username : "";
  const [games, setGames] = useState<GameHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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

  return (
    <Box sx={{ pb: 6 }}>
      <Typography variant="h5" sx={{ mb: 2, color: "text.primary", fontWeight: 700 }}>
        Game history
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Completed games this user participated in (result submitted).
      </Typography>

      {games.length === 0 ? (
        <Typography color="text.secondary">No games recorded yet.</Typography>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {games.map((g) => (
            <Card
              key={g.id}
              component={Link}
              href={`/team-builder?game=${g.id}`}
              sx={{
                border: "1px solid",
                borderColor: "rgba(255,255,255,0.1)",
                bgcolor: "rgba(26,26,26,0.8)",
                borderRadius: 2,
                textDecoration: "none",
                color: "inherit",
                "&:hover": { borderColor: "rgba(103, 232, 249, 0.4)" },
              }}
            >
              <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
                <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5, mb: 1 }}>
                  <SportsEsportsIcon sx={{ color: "#67e8f9", fontSize: 22 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#67e8f9" }}>
                    {g.gameLabel}
                  </Typography>
                  <Chip label={`S${g.season}`} size="small" sx={{ bgcolor: "rgba(255,255,255,0.08)" }} />
                  <Chip
                    label={g.userTeam === "yin" ? "Yin" : "Yang"}
                    size="small"
                    sx={{
                      bgcolor: g.userTeam === "yin" ? "rgba(34, 197, 94, 0.2)" : "rgba(234, 179, 8, 0.2)",
                      color: g.userTeam === "yin" ? "#86efac" : "#fbbf24",
                    }}
                  />
                  {g.userWon === true && (
                    <Chip label="Won" size="small" sx={{ bgcolor: "rgba(34, 197, 94, 0.2)", color: "#86efac" }} />
                  )}
                  {g.userWon === false && (
                    <Chip label="Lost" size="small" sx={{ bgcolor: "rgba(239, 68, 68, 0.2)", color: "#fca5a5" }} />
                  )}
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  {formatDate(g.createdAt)} · Created by {g.createdByName}
                </Typography>
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
