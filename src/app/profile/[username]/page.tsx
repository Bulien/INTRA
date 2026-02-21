"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Box, Typography, CircularProgress } from "@mui/material";
import { ProfileStatsView, type ProfileStats } from "@/components/ProfileStatsView";

async function fetchUserStats(username: string): Promise<ProfileStats | null> {
  const res = await fetch(`/api/users/${encodeURIComponent(username)}/stats`, { cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export default function PublicProfilePage() {
  const params = useParams();
  const username = typeof params?.username === "string" ? params.username : "";
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!username) {
      setLoading(false);
      return;
    }
    fetchUserStats(username)
      .then((data) => {
        if (data) setStats(data);
        else setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "40vh" }}>
        <CircularProgress size={40} sx={{ color: "#67e8f9" }} />
      </Box>
    );
  }

  if (notFound || !stats) {
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

  return <ProfileStatsView stats={stats} isOwnProfile={false} />;
}
