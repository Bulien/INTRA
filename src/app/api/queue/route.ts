import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getElosForPlayers, balanceTeams, type PlayerWithElo } from "@/lib/queueMatchmaking";

const GAME_TYPES = ["lol", "ow", "sc", "battlerite"] as const;
const QUEUE_MATCH_GAMES = ["lol", "ow"] as const;
const GAME_LABELS: Record<string, string> = {
  lol: "League of Legends",
  ow: "Overwatch",
  sc: "Survival Chaos",
  battlerite: "Battlerite",
};

export type QueuedPlayer = {
  id: string;
  name: string | null;
  username: string | null;
  gameType: string;
  joinedAt: string;
};

/** If 10 in queue for lol or ow, create a balanced match and remove them from queue. Returns { gameId, matchedUserIds } or null. */
async function tryCreateQueueMatch(
  gameType: "lol" | "ow"
): Promise<{ gameId: string; matchedUserIds: string[] } | null> {
  const entries = await prisma.queueEntry.findMany({
    where: { gameType },
    orderBy: { joinedAt: "asc" },
    take: 10,
    include: { user: { select: { id: true, name: true, username: true } } },
  });
  if (entries.length < 10) return null;

  const userIds = entries.map((e) => (e.user as { id: string }).id);
  const displayNames = entries.map((e) => {
    const u = e.user as { name: string | null; username: string | null };
    return (u.name ?? u.username ?? "?").trim() || "?";
  });

  const gameSeason = await prisma.gameSeason.findUnique({ where: { gameType } }).catch(() => null);
  const season = gameSeason?.maxSeason ?? 1;

  const elos = await getElosForPlayers(gameType, season, displayNames);
  const playersWithElo: PlayerWithElo[] = userIds.map((id, i) => ({
    userId: id,
    displayName: displayNames[i],
    elo: Math.round(elos[(displayNames[i] ?? "").trim().toLowerCase()] ?? 1000),
  }));

  const { teamA, teamB } = balanceTeams(playersWithElo);

  const teamAPayload = teamA.map((p) => ({ id: p.userId, name: p.displayName, rating: p.elo }));
  const teamBPayload = teamB.map((p) => ({ id: p.userId, name: p.displayName, rating: p.elo }));

  const game = await prisma.teamBuilderGame.create({
    data: {
      gameType,
      season,
      createdById: userIds[0],
      teamA: JSON.stringify(teamAPayload),
      teamB: JSON.stringify(teamBPayload),
      source: "ranked_queue",
    },
  });

  await prisma.queueEntry.deleteMany({
    where: { userId: { in: userIds } },
  });

  return { gameId: game.id, matchedUserIds: userIds };
}

/** GET: current user's queue entry (if any) + all queued players grouped by game. When 10 in queue for lol/ow, creates a match and returns recentlyMatchedGameId for matched users. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  let recentlyMatchedGameId: string | null = null;

  for (const gameType of QUEUE_MATCH_GAMES) {
    const count = await prisma.queueEntry.count({ where: { gameType } });
    if (count >= 10) {
      try {
        const result = await tryCreateQueueMatch(gameType);
        if (result) {
          if (result.matchedUserIds.includes(session.user.id)) {
            recentlyMatchedGameId = result.gameId;
          }
        } else {
          console.warn("[queue] tryCreateQueueMatch returned null for", gameType, "(entries may have been taken by another request)");
        }
      } catch (err) {
        console.error("[queue] Matchmaking failed for", gameType, err);
      }
      break;
    }
  }

  const [myEntry, allEntries] = await Promise.all([
    prisma.queueEntry.findUnique({
      where: { userId: session.user.id },
      select: { gameType: true, joinedAt: true },
    }),
    prisma.queueEntry.findMany({
      orderBy: { joinedAt: "asc" },
      include: {
        user: { select: { id: true, name: true, username: true } },
      },
    }),
  ]);

  const playersByGame: Record<string, QueuedPlayer[]> = {};
  for (const g of GAME_TYPES) {
    playersByGame[g] = [];
  }
  for (const e of allEntries) {
    const u = e.user as { id: string; name: string | null; username: string | null };
    playersByGame[e.gameType].push({
      id: u.id,
      name: u.name ?? null,
      username: u.username ?? null,
      gameType: e.gameType,
      joinedAt: e.joinedAt.toISOString(),
    });
  }

  let matchedGame: { id: string; gameType: string; season: number; teamA: unknown; teamB: unknown; status: string; createdAt: string } | null = null;
  if (recentlyMatchedGameId) {
    const g = await prisma.teamBuilderGame.findUnique({
      where: { id: recentlyMatchedGameId },
    });
    if (g) {
      matchedGame = {
        id: g.id,
        gameType: g.gameType,
        season: g.season,
        teamA: JSON.parse(g.teamA),
        teamB: JSON.parse(g.teamB),
        status: g.status,
        createdAt: g.createdAt.toISOString(),
      };
    }
  }

  return NextResponse.json({
    myEntry: myEntry
      ? { gameType: myEntry.gameType, joinedAt: myEntry.joinedAt.toISOString(), label: GAME_LABELS[myEntry.gameType] ?? myEntry.gameType }
      : null,
    playersByGame,
    gameLabels: GAME_LABELS,
    recentlyMatchedGameId,
    matchedGame,
  });
}
