import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { replayElo, BASE_ELO } from "@/lib/eloReplay";
import { scRating } from "@/lib/scRating";

const GAME_TYPES = ["lol", "ow", "sc", "battlerite"] as const;
const TEAM_GAMES = ["lol", "ow", "battlerite"] as const;
const GAME_LABELS: Record<string, string> = {
  lol: "League of Legends",
  ow: "Overwatch",
  sc: "Survival Chaos",
  battlerite: "Battlerite",
};

function normalizeName(s: string): string {
  return (s ?? "").trim().toLowerCase();
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const userName = normalizeName(session.user.name ?? session.user.email ?? "");
  if (!userName) {
    return NextResponse.json({ byGame: {}, favoriteTeammates: [], totalGames: 0 });
  }

  const byGame: Record<
    string,
    { gamesPlayed: number; wins: number; losses: number; winrate: number | null; elo: number | null; eloTeamBuilder: number | null; eloQueue: number | null; label: string; averageRating: number | null; averagePlacement: number | null; rank: number | null; rankTeamBuilder: number | null; rankQueue: number | null }
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
    let gamesPlayed: number;
    let wins: number;
    let losses: number;
    let winrate: number | null;
    let averagePlacement: number | null = null;
    if (gameType === "sc") {
      const placementScores = scores.filter((s): s is number => s !== null && typeof s === "number" && s >= 1 && s <= 4);
      gamesPlayed = placementScores.length;
      wins = 0;
      losses = 0;
      winrate = null;
      averagePlacement = gamesPlayed > 0 ? Math.round((placementScores.reduce((a, b) => a + b, 0) / gamesPlayed) * 10) / 10 : null;
    } else {
      wins = scores.filter((s) => s === 1).length;
      losses = scores.filter((s) => s === 0).length;
      gamesPlayed = wins + losses;
      winrate = gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : null;
    }

    // Ladder rank: same sort as leaderboard (SC by avgPlace asc, team games by match-based Elo desc)
    let replayElos: Record<string, number> = {};
    let replayElosTeamBuilder: Record<string, number> = {};
    let replayElosQueue: Record<string, number> = {};
    if (TEAM_GAMES.includes(gameType as (typeof TEAM_GAMES)[number])) {
      const toReplayGames = (games: { teamA: string; teamB: string; winner: string | null; createdAt: Date }[]) =>
        games.map((g) => {
          const teamA = (JSON.parse(g.teamA) as { name?: string }[]).map((p) => (p.name ?? "").trim()).filter(Boolean);
          const teamB = (JSON.parse(g.teamB) as { name?: string }[]).map((p) => (p.name ?? "").trim()).filter(Boolean);
          return {
            id: "",
            gameType,
            season,
            teamA,
            teamB,
            winner: g.winner as "yin" | "yang" | null,
            createdAt: g.createdAt,
          };
        });
      const [teamGamesAll, teamGamesTB, teamGamesQueue] = await Promise.all([
        prisma.teamBuilderGame.findMany({
          where: { gameType, season, status: "result_submitted" },
          orderBy: { createdAt: "asc" },
          select: { id: true, teamA: true, teamB: true, winner: true, createdAt: true },
        }),
        prisma.teamBuilderGame.findMany({
          where: { gameType, season, status: "result_submitted", source: "team_builder" },
          orderBy: { createdAt: "asc" },
          select: { teamA: true, teamB: true, winner: true, createdAt: true },
        }),
        prisma.teamBuilderGame.findMany({
          where: { gameType, season, status: "result_submitted", source: "ranked_queue" },
          orderBy: { createdAt: "asc" },
          select: { teamA: true, teamB: true, winner: true, createdAt: true },
        }),
      ]);
      const replayGamesAll = teamGamesAll.map((g) => ({
        id: g.id,
        gameType,
        season,
        teamA: (JSON.parse(g.teamA) as { name?: string }[]).map((p) => (p.name ?? "").trim()).filter(Boolean),
        teamB: (JSON.parse(g.teamB) as { name?: string }[]).map((p) => (p.name ?? "").trim()).filter(Boolean),
        winner: g.winner as "yin" | "yang" | null,
        createdAt: g.createdAt,
      }));
      replayElos = replayElo(replayGamesAll).elos;
      replayElosTeamBuilder = replayElo(toReplayGames(teamGamesTB)).elos;
      replayElosQueue = replayElo(toReplayGames(teamGamesQueue)).elos;
    }

    const withSortKey = players.map((p) => {
      const s = (JSON.parse(p.scores || "[]") as (number | null)[]);
      if (gameType === "sc") {
        const placeScores = s.filter((x): x is number => x !== null && x >= 1 && x <= 4);
        const sortKey = placeScores.length > 0 ? scRating(placeScores) : 999;
        return { name: p.name, sortKey, nameLower: normalizeName(p.name) };
      }
      const sortKey = replayElos[normalizeName(p.name)] ?? BASE_ELO;
      return { name: p.name, sortKey, nameLower: normalizeName(p.name) };
    });
    if (gameType === "sc") {
      withSortKey.sort((a, b) => a.sortKey - b.sortKey || (a.name ?? "").localeCompare(b.name ?? ""));
    } else {
      withSortKey.sort((a, b) => b.sortKey - a.sortKey || (a.name ?? "").localeCompare(b.name ?? ""));
    }
    const rankIndex = withSortKey.findIndex((p) => p.nameLower === userName);
    const rank = rankIndex >= 0 ? rankIndex + 1 : null;

    let rankTeamBuilder: number | null = null;
    let rankQueue: number | null = null;
    if (TEAM_GAMES.includes(gameType as (typeof TEAM_GAMES)[number])) {
      const withSortKeyTB = players.map((p) => ({
        name: p.name,
        sortKey: replayElosTeamBuilder[normalizeName(p.name)] ?? BASE_ELO,
        nameLower: normalizeName(p.name),
      }));
      withSortKeyTB.sort((a, b) => b.sortKey - a.sortKey || (a.name ?? "").localeCompare(b.name ?? ""));
      const idxTB = withSortKeyTB.findIndex((p) => p.nameLower === userName);
      rankTeamBuilder = idxTB >= 0 ? idxTB + 1 : null;

      const withSortKeyQueue = players.map((p) => ({
        name: p.name,
        sortKey: replayElosQueue[normalizeName(p.name)] ?? BASE_ELO,
        nameLower: normalizeName(p.name),
      }));
      withSortKeyQueue.sort((a, b) => b.sortKey - a.sortKey || (a.name ?? "").localeCompare(b.name ?? ""));
      const idxQueue = withSortKeyQueue.findIndex((p) => p.nameLower === userName);
      rankQueue = idxQueue >= 0 ? idxQueue + 1 : null;
    }

    const elo = gameType === "sc" ? null : (replayElos[userName] ?? (gamesPlayed > 0 ? BASE_ELO : null));
    const eloTeamBuilder = gameType === "sc" ? null : (replayElosTeamBuilder[userName] ?? null);
    const eloQueue = gameType === "sc" ? null : (replayElosQueue[userName] ?? null);
    byGame[gameType] = {
      gamesPlayed,
      wins,
      losses,
      winrate,
      elo,
      eloTeamBuilder,
      eloQueue,
      label: GAME_LABELS[gameType] ?? gameType,
      averageRating: gameType === "sc" ? null : (avgByGame[gameType] ?? null),
      averagePlacement: gameType === "sc" ? averagePlacement : null,
      rank,
      rankTeamBuilder,
      rankQueue,
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
    userName: session.user.name ?? session.user.email ?? "User",
  });
}
