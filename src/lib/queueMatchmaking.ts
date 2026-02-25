import { prisma } from "@/lib/prisma";
import { replayElo, BASE_ELO } from "@/lib/eloReplay";

const TEAM_GAMES = ["lol", "ow"] as const;

function normalizeName(s: string): string {
  return (s ?? "").trim().toLowerCase();
}

export type PlayerWithElo = {
  userId: string;
  displayName: string;
  elo: number;
};

/**
 * Get current ELO for each player name by replaying all submitted games for gameType/season.
 */
export async function getElosForPlayers(
  gameType: string,
  season: number,
  playerNames: string[]
): Promise<Record<string, number>> {
  if (!TEAM_GAMES.includes(gameType as (typeof TEAM_GAMES)[number])) {
    return Object.fromEntries(playerNames.map((n) => [normalizeName(n), BASE_ELO]));
  }
  const teamGames = await prisma.teamBuilderGame.findMany({
    where: { gameType, season, status: "result_submitted" },
    orderBy: { createdAt: "asc" },
    select: { id: true, teamA: true, teamB: true, winner: true, createdAt: true },
  });
  const replayGames = teamGames.map((g) => {
    const teamA = (JSON.parse(g.teamA) as { name?: string }[]).map((p) => (p.name ?? "").trim()).filter(Boolean);
    const teamB = (JSON.parse(g.teamB) as { name?: string }[]).map((p) => (p.name ?? "").trim()).filter(Boolean);
    return {
      id: g.id,
      gameType,
      season,
      teamA,
      teamB,
      winner: g.winner as "yin" | "yang" | null,
      createdAt: g.createdAt,
    };
  });
  const { elos } = replayElo(replayGames);
  return elos;
}

/**
 * Balance 10 players into two teams of 5 so that total ELO is as equal as possible.
 * Uses optimal split (minimizes |sumA - sumB|) over all 5-vs-5 splits.
 * Returns { teamA: PlayerWithElo[], teamB: PlayerWithElo[] }.
 */
export function balanceTeams(players: PlayerWithElo[]): {
  teamA: PlayerWithElo[];
  teamB: PlayerWithElo[];
} {
  if (players.length !== 10) {
    const mid = Math.ceil(players.length / 2);
    return {
      teamA: players.slice(0, mid),
      teamB: players.slice(mid),
    };
  }
  const total = players.reduce((s, p) => s + p.elo, 0);
  const targetHalf = total / 2;
  let bestDiff = Infinity;
  let bestTeamA: PlayerWithElo[] = [];

  function choose(n: number, start: number, teamA: PlayerWithElo[], sumA: number): void {
    if (n === 0) {
      const diff = Math.abs(sumA - targetHalf);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestTeamA = [...teamA];
      }
      return;
    }
    for (let i = start; i <= players.length - n; i++) {
      teamA.push(players[i]);
      choose(n - 1, i + 1, teamA, sumA + players[i].elo);
      teamA.pop();
    }
  }
  choose(5, 0, [], 0);

  const setA = new Set(bestTeamA);
  const teamB = players.filter((p) => !setA.has(p));
  return { teamA: bestTeamA, teamB };
}
