import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const GAME_LABELS: Record<string, string> = {
  lol: "League of Legends",
  ow: "Overwatch",
  sc: "Survival Chaos",
  battlerite: "Battlerite",
};

function normalizeName(s: string): string {
  return (s ?? "").trim().toLowerCase();
}

export type TeamPlayer = { name: string; rating?: number };

export type ScPlacement = { playerName: string; placement: number };

export type UserGameHistoryEntry = {
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
  scPlacements?: ScPlacement[];
};

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

  const userName = normalizeName((user.name ?? user.username ?? "").trim() || username);

  const games = await prisma.teamBuilderGame.findMany({
    where: { status: "result_submitted" },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true, username: true } } },
  });

  // For SC: get game index per season (order by createdAt) and ranking scores per player
  const scGamesBySeason = new Map<number, { id: string; createdAt: Date }[]>();
  for (const g of games) {
    if (g.gameType !== "sc") continue;
    const list = scGamesBySeason.get(g.season) ?? [];
    list.push({ id: g.id, createdAt: g.createdAt });
    scGamesBySeason.set(g.season, list);
  }
  for (const list of scGamesBySeason.values()) {
    list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
  const scGameIndexById = new Map<string, number>();
  for (const [, list] of scGamesBySeason) {
    list.forEach((item, index) => scGameIndexById.set(item.id, index));
  }
  const scSeasons = [...scGamesBySeason.keys()];
  const rankingPlayersSc =
    scSeasons.length > 0
      ? await prisma.rankingPlayer.findMany({
          where: { gameType: "sc", season: { in: scSeasons } },
          select: { name: true, season: true, scores: true },
        })
      : [];
  const scoresBySeasonAndName = new Map<string, (number | null)[]>();
  for (const r of rankingPlayersSc) {
    let scores: (number | null)[];
    try {
      scores = JSON.parse(r.scores) as (number | null)[];
    } catch {
      scores = [];
    }
    scoresBySeasonAndName.set(`${r.season}:${normalizeName(r.name)}`, scores);
  }

  const result: UserGameHistoryEntry[] = [];

  for (const g of games) {
    const teamA = JSON.parse(g.teamA) as { name: string; rating?: number }[];
    const teamB = JSON.parse(g.teamB) as { name: string; rating?: number }[];
    const inA = teamA.some((p) => normalizeName(p.name) === userName);
    const inB = teamB.some((p) => normalizeName(p.name) === userName);
    if (!inA && !inB) continue;

    const userTeam: "yin" | "yang" = inA ? "yin" : "yang";
    const isSc = g.gameType === "sc";

    const by = g.createdBy as { name?: string; username?: string } | undefined;
    const name = (by?.name ?? by?.username ?? "Someone").trim() || "Someone";

    const teamYin = teamA.map((p) => ({ name: (p.name ?? "").trim(), rating: p.rating }));
    const teamYang = teamB.map((p) => ({ name: (p.name ?? "").trim(), rating: p.rating }));

    let scPlacements: { playerName: string; placement: number }[] | undefined;
    if (g.gameType === "sc") {
      const gameIndex = scGameIndexById.get(g.id) ?? 0;
      const allPlayers = [...teamA, ...teamB].map((p) => (p.name ?? "").trim()).filter(Boolean);
      const placements: { playerName: string; placement: number }[] = [];
      for (const playerName of allPlayers) {
        const scores = scoresBySeasonAndName.get(`${g.season}:${normalizeName(playerName)}`);
        const placement = scores?.[gameIndex] ?? null;
        if (placement != null && placement >= 1 && placement <= 4) {
          placements.push({ playerName, placement });
        }
      }
      scPlacements = placements.length > 0 ? placements.sort((a, b) => a.placement - b.placement) : undefined;
    }

    // SC: 1st/2nd = won, 3rd/4th = lost; non-SC: use team winner
    let userWon: boolean | null;
    if (isSc && scPlacements) {
      const userPlacement = scPlacements.find((p) => normalizeName(p.playerName) === userName)?.placement;
      userWon = userPlacement === 1 || userPlacement === 2 ? true : userPlacement === 3 || userPlacement === 4 ? false : null;
    } else {
      userWon = g.winner == null ? null : (inA && g.winner === "yin") || (inB && g.winner === "yang");
    }

    result.push({
      id: g.id,
      gameType: g.gameType,
      gameLabel: GAME_LABELS[g.gameType] ?? g.gameType,
      season: g.season,
      winner: g.winner,
      createdAt: g.createdAt.toISOString(),
      createdByName: name,
      userTeam,
      userWon,
      teamYin,
      teamYang,
      scPlacements,
    });
  }

  return NextResponse.json({ games: result });
}
