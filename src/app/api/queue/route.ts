import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getElosForPlayers, balanceTeams, type PlayerWithElo } from "@/lib/queueMatchmaking";

const GAME_TYPES = ["lol", "ow", "sc", "battlerite"] as const;
/** Games that support queue matchmaking: lol/ow = 10 players (5v5), battlerite = 6 players (3v3). */
const QUEUE_MATCH_CONFIG: Record<string, number> = {
  lol: 10,
  ow: 10,
  battlerite: 6,
};
const QUEUE_MATCH_GAMES = ["lol", "ow", "battlerite"] as const;
const GAME_LABELS: Record<string, string> = {
  lol: "League of Legends",
  ow: "Overwatch",
  sc: "Survival Chaos",
  battlerite: "Battlerite",
};

/** Same as api/online: users with lastSeenAt within this window are "online". */
const ONLINE_WINDOW_MS = 5 * 60 * 1000;

export type QueuedPlayer = {
  id: string;
  name: string | null;
  username: string | null;
  gameType: string;
  joinedAt: string;
};

/** If enough players in queue (10 for lol/ow, 6 for battlerite), create a balanced match and remove them from queue. Returns { gameId, matchedUserIds } or null. */
async function tryCreateQueueMatch(
  gameType: "lol" | "ow" | "battlerite"
): Promise<{ gameId: string; matchedUserIds: string[] } | null> {
  const required = QUEUE_MATCH_CONFIG[gameType] ?? 10;
  const teamSize = required / 2;

  const entries = await prisma.queueEntry.findMany({
    where: { gameType },
    orderBy: { joinedAt: "asc" },
    take: required,
    include: { user: { select: { id: true, name: true, username: true } } },
  });
  if (entries.length < required) return null;

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

  const { teamA, teamB } = balanceTeams(playersWithElo, teamSize);

  const teamAPayload = teamA.map((p) => ({ id: p.userId, name: p.displayName, rating: p.elo }));
  const teamBPayload = teamB.map((p) => ({ id: p.userId, name: p.displayName, rating: p.elo }));

  const now = new Date();
  const acceptDeadline = new Date(now.getTime() + 30 * 1000);
  const initialDraftState =
    gameType === "battlerite"
      ? {
          phase: "accept" as const,
          round: 1,
          acceptDeadline: acceptDeadline.toISOString(),
          acceptedUserIds: [] as string[],
          bansTeamA: [null, null, null] as (string | null)[],
          bansTeamB: [null, null, null] as (string | null)[],
          picksTeamA: [null, null, null] as (string | null)[],
          picksTeamB: [null, null, null] as (string | null)[],
          lockInTeamA: [false, false, false],
          lockInTeamB: [false, false, false],
          selectionTeamA: null as string | null,
          selectionTeamB: null as string | null,
        }
      : undefined;

  const game = await prisma.teamBuilderGame.create({
    data: {
      gameType,
      season,
      createdById: userIds[0],
      teamA: JSON.stringify(teamAPayload),
      teamB: JSON.stringify(teamBPayload),
      source: "ranked_queue",
      ...(initialDraftState && { draftState: initialDraftState as object }),
    },
  });

  await prisma.queueEntry.deleteMany({
    where: { userId: { in: userIds } },
  });

  return { gameId: game.id, matchedUserIds: userIds };
}

/** GET: current user's queue entry (if any) + all queued players grouped by game. When enough in queue (10 for lol/ow, 6 for battlerite), creates a match and returns recentlyMatchedGameId for matched users. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  // Keep current user marked online (same as /api/nav, /api/online)
  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { lastSeenAt: new Date() },
    });
  } catch {
    // lastSeenAt column may not exist yet
  }

  // Run matchmaking first so seeded/offline users can still pop (e.g. pop-queue.mjs).
  // Clean up offline users after, so the queue list stays accurate.
  let recentlyMatchedGameId: string | null = null;

  for (const gameType of QUEUE_MATCH_GAMES) {
    const required = QUEUE_MATCH_CONFIG[gameType] ?? 10;
    const count = await prisma.queueEntry.count({ where: { gameType } });
    if (count >= required) {
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

  // Auto-leave queue for users who are no longer online (after matchmaking so pop-queue still works)
  const since = new Date(Date.now() - ONLINE_WINDOW_MS);
  try {
    await prisma.queueEntry.deleteMany({
      where: {
        user: {
          OR: [{ lastSeenAt: null }, { lastSeenAt: { lt: since } }],
        },
      },
    });
  } catch {
    // lastSeenAt may not exist on User in older DBs; ignore
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

  let matchedGame: { id: string; gameType: string; season: number; teamA: unknown; teamB: unknown; status: string; createdAt: string; draftState?: unknown } | null = null;
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
        ...(g.draftState && { draftState: g.draftState as object }),
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
