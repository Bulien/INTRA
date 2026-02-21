"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Box, Typography, CircularProgress } from "@mui/material";
import { ProfileStatsView, type ProfileStats } from "@/components/ProfileStatsView";

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

  const displayStats: ProfileStats = {
    byGame: stats?.byGame ?? {},
    favoriteTeammates: stats?.favoriteTeammates ?? [],
    mostFrequentTeammates: stats?.mostFrequentTeammates ?? [],
    totalGames: stats?.totalGames ?? 0,
    userName: stats?.userName ?? session.user?.name ?? session.user?.email ?? "User",
  };

  return <ProfileStatsView stats={displayStats} isOwnProfile />;
}
