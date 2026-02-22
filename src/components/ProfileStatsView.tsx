"use client";

import Link from "next/link";
import {
  Box,
  Card,
  CardContent,
  Typography,
} from "@mui/material";
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents";
import GroupsIcon from "@mui/icons-material/Groups";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";

export type GameStats = {
  gamesPlayed: number;
  wins: number;
  losses: number;
  winrate: number | null;
  label: string;
  averageRating?: number | null;
  averagePlacement?: number | null;
  rank?: number | null;
};

export type FavoriteTeammate = {
  name: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  winrate: number;
};

export type ProfileStats = {
  byGame: Record<string, GameStats>;
  favoriteTeammates: FavoriteTeammate[];
  mostFrequentTeammates: { name: string; count: number }[];
  totalGames: number;
  userName: string;
};

type ProfileStatsViewProps = {
  stats: ProfileStats;
  isOwnProfile?: boolean;
};

export function ProfileStatsView({ stats, isOwnProfile = true }: ProfileStatsViewProps) {
  const byGame = stats.byGame ?? {};
  const favoriteTeammates = stats.favoriteTeammates ?? [];
  const mostFrequentTeammates = stats.mostFrequentTeammates ?? [];
  const totalGames = stats.totalGames ?? 0;
  const userName = stats.userName ?? "User";

  const youThey = isOwnProfile ? "you" : "they";

  return (
    <Box sx={{ pb: 6 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          flexWrap: "wrap",
          mb: 3,
          pb: 2,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <Box
          sx={{
            px: 2,
            py: 1,
            borderRadius: 2,
            bgcolor: "rgba(103, 232, 249, 0.08)",
            border: "1px solid rgba(103, 232, 249, 0.25)",
            display: "inline-flex",
            alignItems: "center",
            gap: 1.5,
          }}
        >
          <SportsEsportsIcon sx={{ color: "#67e8f9", fontSize: 28 }} />
          <Typography
            component="span"
            variant="h5"
            sx={{
              color: "#67e8f9",
              fontWeight: 700,
              letterSpacing: "0.02em",
            }}
          >
            {userName || "Player"}
          </Typography>
          {isOwnProfile && (
            <Typography
              component="span"
              variant="caption"
              sx={{
                color: "text.secondary",
                fontSize: "0.7rem",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                opacity: 0.9,
              }}
            >
              Your profile
            </Typography>
          )}
        </Box>
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
        <SportsEsportsIcon sx={{ color: "#67e8f9", fontSize: 28 }} />
        <Typography variant="h6" sx={{ color: "text.primary", fontWeight: 600 }}>
          Total games played: {totalGames}
        </Typography>
      </Box>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" style={{ marginBottom: 32 }}>
        {Object.entries(byGame).map(([gameKey, g]) => (
          <Card
            key={gameKey}
            sx={{
              border: "1px solid",
              borderColor: "rgba(255,255,255,0.1)",
              bgcolor: "rgba(26,26,26,0.8)",
              borderRadius: 2,
              display: "flex",
              flexDirection: "column",
              "&:hover": { borderColor: "rgba(103,232,249,0.25)" },
            }}
          >
            <CardContent sx={{ py: 2, px: 2, "&:last-child": { pb: 2 }, flex: 1, display: "flex", flexDirection: "column" }}>
              <Box
                component="dl"
                sx={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr",
                  columnGap: 1.5,
                  rowGap: 0.75,
                  alignItems: "baseline",
                  m: 0,
                  flex: 1,
                  "& > dt": { color: "text.secondary", fontSize: "0.8125rem", minWidth: 0 },
                  "& > dd": { m: 0, fontSize: "0.8125rem", fontWeight: 600 },
                }}
              >
                <Box component="dt" sx={{ gridColumn: "1 / -1", color: "#67e8f9 !important", fontWeight: 700, fontSize: "0.9375rem !important", mb: 0.25 }}>
                  {g.label}
                </Box>
                {g.rank != null && (
                  <>
                    <Box component="dt">Rank</Box>
                    <Box component="dd" sx={{ color: "#a5f3fc" }}>#{g.rank}</Box>
                  </>
                )}
                <Box component="dt">Games</Box>
                <Box component="dd" sx={{ color: "#e5e5e5" }}>{g.gamesPlayed}</Box>
                {gameKey === "sc" ? (
                  g.averagePlacement != null && (
                    <>
                      <Box component="dt">Avg placement</Box>
                      <Box component="dd" sx={{ color: "#e5e5e5" }}>{g.averagePlacement}</Box>
                    </>
                  )
                ) : (
                  <>
                    <Box component="dt">Wins</Box>
                    <Box component="dd" sx={{ color: "#86efac" }}>{g.wins}</Box>
                    <Box component="dt">Losses</Box>
                    <Box component="dd" sx={{ color: "#fca5a5" }}>{g.losses}</Box>
                    {g.winrate !== null && (
                      <>
                        <Box component="dt">Winrate</Box>
                        <Box component="dd" sx={{ color: "#a5f3fc", display: "flex", alignItems: "center", gap: 0.5 }}>
                          <EmojiEventsIcon sx={{ fontSize: 14, color: "#fbbf24" }} />
                          {g.winrate}%
                        </Box>
                      </>
                    )}
                    {g.averageRating != null && (
                      <>
                        <Box component="dt">Avg rating</Box>
                        <Box component="dd" sx={{ color: "#e5e5e5" }}>{g.averageRating}</Box>
                      </>
                    )}
                  </>
                )}
              </Box>
              {gameKey === "sc" && g.averagePlacement != null && (
                <Box sx={{ mt: 1.5, height: 4, borderRadius: 2, bgcolor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                  <Box
                    sx={{
                      width: `${Math.max(0, ((4 - g.averagePlacement) / 3) * 100)}%`,
                      height: "100%",
                      bgcolor: "#67e8f9",
                      borderRadius: 2,
                    }}
                  />
                </Box>
              )}
              {gameKey !== "sc" && g.winrate != null && (
                <Box sx={{ mt: 1.5, height: 4, borderRadius: 2, bgcolor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                  <Box sx={{ width: `${Math.min(100, g.winrate)}%`, height: "100%", bgcolor: "#22c55e", borderRadius: 2 }} />
                </Box>
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
                    Teammates {youThey} win the most with
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
                        <td className="py-1.5 px-2 font-medium">
                          <Link href={`/profile/${encodeURIComponent(t.name)}`} className="text-cyan-200 hover:text-cyan-100 hover:underline">
                            {t.name}
                          </Link>
                        </td>
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
              No team builder games yet — play shared games to see who {youThey} team up with most.
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
                    Teammates {youThey}&apos;ve been in the same team with the most
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
                        <td className="py-1.5 px-2 font-medium">
                          <Link href={`/profile/${encodeURIComponent(t.name)}`} className="text-cyan-200 hover:text-cyan-100 hover:underline">
                            {t.name}
                          </Link>
                        </td>
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
