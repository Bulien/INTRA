"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
} from "@mui/material";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import GroupsIcon from "@mui/icons-material/Groups";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";

type GameStats = {
  gamesPlayed: number;
  wins: number;
  losses: number;
  winrate: number | null;
  label: string;
};

type FavoriteTeammate = {
  name: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  winrate: number;
};

type ProfileStats = {
  byGame: Record<string, GameStats>;
  favoriteTeammates: FavoriteTeammate[];
  mostFrequentTeammates: { name: string; count: number }[];
  totalGames: number;
  userName: string;
};

async function fetchProfileStats(): Promise<ProfileStats | null> {
  const res = await fetch("/api/profile/stats", { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      setLoading(false);
      return;
    }
    if (status !== "authenticated") return;
    fetchProfileStats()
      .then(setStats)
      .finally(() => setLoading(false));
  }, [status]);

  if (status === "loading" || loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "40vh" }}>
        <CircularProgress size={40} sx={{ color: "#67e8f9" }} />
      </Box>
    );
  }

  if (!session?.user) {
    return (
      <Box sx={{ py: 4, textAlign: "center" }}>
        <Typography variant="h5" sx={{ mb: 2, color: "text.primary" }}>
          Sign in to view your profile
        </Typography>
        <Link href="/login" className="text-cyan-300 hover:text-cyan-200 font-medium">
          Go to login
        </Link>
      </Box>
    );
  }

  const byGame = stats?.byGame ?? {};
  const favoriteTeammates = stats?.favoriteTeammates ?? [];
  const mostFrequentTeammates = stats?.mostFrequentTeammates ?? [];
  const totalGames = stats?.totalGames ?? 0;
  const userName = stats?.userName ?? session.user?.name ?? session.user?.email ?? "User";

  return (
    <Box sx={{ pb: 6 }}>
      <Typography variant="h4" sx={{ mb: 1, color: "text.primary", fontWeight: 700 }}>
        Profile
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        {userName}
      </Typography>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
        <SportsEsportsIcon sx={{ color: "#67e8f9", fontSize: 28 }} />
        <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 600 }}>
          Total games played: {totalGames}
        </Typography>
      </Box>

      <Typography variant="h6" sx={{ mb: 2, color: "text.primary", fontWeight: 600 }}>
        By game
      </Typography>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ marginBottom: 32 }}>
        {Object.entries(byGame).map(([gameType, g]) => (
          <Card
            key={gameType}
            sx={{
              border: "1px solid",
              borderColor: "rgba(255,255,255,0.1)",
              bgcolor: "rgba(26,26,26,0.8)",
              borderRadius: 2,
            }}
          >
            <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#67e8f9", mb: 1.5 }}>
                {g.label}
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  Games: <strong style={{ color: "#e5e5e5" }}>{g.gamesPlayed}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Wins: <strong style={{ color: "#86efac" }}>{g.wins}</strong>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Losses: <strong style={{ color: "#fca5a5" }}>{g.losses}</strong>
                </Typography>
                {g.winrate !== null && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <EmojiEventsIcon sx={{ fontSize: 18, color: "#fbbf24" }} />
                    <Typography variant="body2" sx={{ fontWeight: 600, color: "#a5f3fc" }}>
                      Winrate: {g.winrate}%
                    </Typography>
                  </Box>
                )}
              </Box>
              {g.gamesPlayed === 0 && (
                <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }}>
                  No games recorded yet
                </Typography>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Box>
          <Typography variant="h6" sx={{ mb: 2, color: "text.primary", fontWeight: 600 }}>
            Favorite teammates
          </Typography>
          {favoriteTeammates.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
              No completed shared games yet — submit results to see winrates with teammates.
            </Typography>
          ) : (
            <Card
              sx={{
                border: "1px solid",
                borderColor: "rgba(103,232,249,0.25)",
                bgcolor: "rgba(26,26,26,0.8)",
                borderRadius: 2,
              }}
            >
              <CardContent sx={{ py: 2, px: 0, "&:last-child": { pb: 2 } }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, px: 2 }}>
                  <EmojiEventsIcon sx={{ color: "#fbbf24", fontSize: 22 }} />
                  <Typography variant="body2" color="text.secondary">
                    Teammates you win the most with
                  </Typography>
                </Box>
            <table className="w-full text-left border-collapse" style={{ tableLayout: "fixed" }}>
              <thead>
                <tr className="border-b border-white/10 text-neutral-400 text-sm">
                  <th className="py-2 px-2 font-semibold">#</th>
                  <th className="py-2 px-2 font-semibold">Name</th>
                  <th className="py-2 px-2 font-semibold text-right">Games</th>
                  <th className="py-2 px-2 font-semibold text-right">W</th>
                  <th className="py-2 px-2 font-semibold text-right">L</th>
                  <th className="py-2 px-2 font-semibold text-right">Winrate</th>
                </tr>
              </thead>
              <tbody>
                {favoriteTeammates.map((t, i) => (
                  <tr key={t.name} className="border-b border-white/5 text-neutral-200">
                    <td className="py-1.5 px-2 text-neutral-500">{i + 1}</td>
                    <td className="py-1.5 px-2 font-medium">{t.name}</td>
                    <td className="py-1.5 px-2 text-right">{t.gamesPlayed}</td>
                    <td className="py-1.5 px-2 text-right text-green-400">{t.wins}</td>
                    <td className="py-1.5 px-2 text-right text-red-400">{t.losses}</td>
                    <td className="py-1.5 px-2 text-right font-semibold text-cyan-200">{t.winrate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
          )}
        </Box>

        <Box>
          <Typography variant="h6" sx={{ mb: 2, color: "text.primary", fontWeight: 600 }}>
            Most frequent teammates
          </Typography>
          {mostFrequentTeammates.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
              No team builder games yet — play shared games to see who you team up with most.
            </Typography>
          ) : (
            <Card
              sx={{
                border: "1px solid",
                borderColor: "rgba(249,168,212,0.2)",
                bgcolor: "rgba(26,26,26,0.8)",
                borderRadius: 2,
              }}
            >
              <CardContent sx={{ py: 2, px: 0, "&:last-child": { pb: 2 } }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, px: 2 }}>
                  <GroupsIcon sx={{ color: "#f9a8d4", fontSize: 22 }} />
                  <Typography variant="body2" color="text.secondary">
                    Teammates you&apos;ve been in the same team with the most
                  </Typography>
                </Box>
            <table className="w-full text-left border-collapse" style={{ tableLayout: "fixed" }}>
              <thead>
                <tr className="border-b border-white/10 text-neutral-400 text-sm">
                  <th className="py-2 px-2 font-semibold">#</th>
                  <th className="py-2 px-2 font-semibold">Name</th>
                  <th className="py-2 px-2 font-semibold text-right">Games together</th>
                </tr>
              </thead>
              <tbody>
                {mostFrequentTeammates.map((t, i) => (
                  <tr key={t.name} className="border-b border-white/5 text-neutral-200">
                    <td className="py-1.5 px-2 text-neutral-500">{i + 1}</td>
                    <td className="py-1.5 px-2 font-medium">{t.name}</td>
                    <td className="py-1.5 px-2 text-right font-semibold text-cyan-200">{t.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
          )}
        </Box>
      </div>
    </Box>
  );
}
