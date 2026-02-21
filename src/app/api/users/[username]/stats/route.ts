import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const GAME_TYPES = ["lol", "ow", "sc", "battlerite"] as const;
const GAME_LABELS: Record<string, string> = {
  lol: "League of Legends",
  ow: "Overwatch",
  sc: "Survival Chaos",
  battlerite: "Battlerite",
};

function normalizeName(s: string): string {
  return (s ?? "").trim().toLowerCase();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username: usernameParam } = await params;
  const username = decodeURIComponent(usernameParam).trim();
  if (!username) {
    return NextResponse.json({ error: "Username required" }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: { equals: username, mode: "insensitive" } },
        { name: { equals: username, mode: "insensitive" } },
      ],
    },
    select: { username: true, name: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const displayName = (user.name ?? user.username ?? "").trim() || username;
  const userName = normalizeName(displayName);

  const byGame: Record<
    string,
    { gamesPlayed: number; wins: number; losses: number; winrate: number | null; label: string; averageRating: number | null }
  > = {};

  const avgRows = await (prisma as unknown as {
    playerGameRating: {
      groupBy: (args: { by: ["gameType"]; where: { playerName: string }; _avg: { rating: true } }) => Promise<{ gameType: string; _avg: { rating: number | null } }[]>;
    };
  }).playerGameRating.groupBy({
    by: ["gameType"],
    where: { playerName: userName },
    _avg: { rating: true },
  }).catch(() => []);
  const avgByGame: Record<string, number> = {};
  for (const r of avgRows) {
    if (r._avg?.rating != null) avgByGame[r.gameType] = Math.round(r._avg.rating * 10) / 10;
  }

  for (const gameType of GAME_TYPES) {
    const gameSeason = await prisma.gameSeason.findUnique({ where: { gameType } }).catch(() => null);
    const season = gameSeason?.maxSeason ?? 1;
    const players = await (prisma as unknown as { rankingPlayer: { findMany: (q: unknown) => Promise<{ name: string; scores: string }[]> } })
      .rankingPlayer.findMany({
        where: { gameType, season },
        select: { name: true, scores: true },
      })
      .catch(() => []);

    const me = players.find((p) => normalizeName(p.name) === userName);
    const scores: (number | null)[] = me ? (JSON.parse(me.scores || "[]") as (number | null)[]) : [];
    const wins = scores.filter((s) => s === 1).length;
    const losses = scores.filter((s) => s === 0).length;
    const gamesPlayed = wins + losses;
    const winrate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : null;

    byGame[gameType] = {
      gamesPlayed,
      wins,
      losses,
      winrate,
      label: GAME_LABELS[gameType] ?? gameType,
      averageRating: avgByGame[gameType] ?? null,
    };
  }

  const totalGames = Object.values(byGame).reduce((s, g) => s + g.gamesPlayed, 0);

  const teamBuilderGamesAll = await (prisma as unknown as { teamBuilderGame: { findMany: (q: unknown) => Promise<{ teamA: string; teamB: string; winner: string | null }[]> } })
    .teamBuilderGame.findMany({
      where: { status: { in: ["pending", "result_submitted"] } },
      select: { teamA: true, teamB: true, winner: true },
    })
    .catch(() => []);

  const teammateCount = new Map<string, number>();
  const teammateWinsLosses = new Map<string, { wins: number; losses: number }>();

  for (const g of teamBuilderGamesAll) {
    const teamA = JSON.parse(g.teamA) as { name: string }[];
    const teamB = JSON.parse(g.teamB) as { name: string }[];
    const inA = teamA.some((p) => normalizeName(p.name) === userName);
    const inB = teamB.some((p) => normalizeName(p.name) === userName);
    const myTeam = inA ? teamA : inB ? teamB : null;
    if (!myTeam) continue;

    const won = (inA && g.winner === "yin") || (inB && g.winner === "yang");

    for (const p of myTeam) {
      const n = normalizeName(p.name ?? "");
      if (!n || n === userName) continue;
      const key = (p.name ?? "").trim() || n;
      teammateCount.set(key, (teammateCount.get(key) ?? 0) + 1);
      if (g.winner === "yin" || g.winner === "yang") {
        const cur = teammateWinsLosses.get(key) ?? { wins: 0, losses: 0 };
        if (won) cur.wins += 1;
        else cur.losses += 1;
        teammateWinsLosses.set(key, cur);
      }
    }
  }

  const favoriteTeammates = Array.from(teammateWinsLosses.entries())
    .filter(([, wl]) => wl.wins + wl.losses >= 1)
    .map(([name, wl]) => {
      const games = wl.wins + wl.losses;
      const winrate = games > 0 ? Math.round((wl.wins / games) * 100) : 0;
      return { name, wins: wl.wins, losses: wl.losses, gamesPlayed: games, winrate };
    })
    .sort((a, b) => b.winrate - a.winrate || b.gamesPlayed - a.gamesPlayed)
    .slice(0, 15);

  const mostFrequentTeammates = Array.from(teammateCount.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  return NextResponse.json({
    byGame,
    favoriteTeammates,
    mostFrequentTeammates,
    totalGames,
    userName: displayName || username,
  });
}
