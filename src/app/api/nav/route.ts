import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ONLINE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/** Shape of one ongoing game for the nav (visible to all users). */
export type OngoingGameNav = {
  id: string;
  gameType: string;
  source: string;
  teamA: string[];
  teamB: string[];
};

/**
 * GET: Combined nav data in one round-trip:
 * - ongoingGames: all pending games (for everyone), with team names
 * - pendingGamesCount, ongoingQueueMatchId, pendingGameIds (current user)
 * - online users (updates current user's lastSeenAt)
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({
      pendingGamesCount: 0,
      pendingTeamBuilderCount: 0,
      ongoingQueueMatchId: null,
      pendingGameIds: [],
      ongoingGames: [],
      online: [],
    });
  }

  const userName = (session.user.name ?? session.user.email ?? "").trim().toLowerCase();
  const now = new Date();
  const since = new Date(now.getTime() - ONLINE_WINDOW_MS);

  const [pendingResult, onlineResult] = await Promise.all([
    (async () => {
      const client = prisma as unknown as { teamBuilderGame?: unknown };
      if (!client.teamBuilderGame) {
        return {
          count: 0,
          pendingTeamBuilderCount: 0,
          queueMatchId: null as string | null,
          pendingGameIds: [] as string[],
          ongoingGames: [] as OngoingGameNav[],
        };
      }
      try {
        const games = await prisma.teamBuilderGame.findMany({
          where: { status: "pending" },
          select: { id: true, gameType: true, teamA: true, teamB: true, source: true },
          orderBy: { createdAt: "desc" },
          take: 50,
        });
        const ongoingGames: OngoingGameNav[] = games.map((g) => {
          const teamA = JSON.parse(g.teamA) as { name?: string }[];
          const teamB = JSON.parse(g.teamB) as { name?: string }[];
          return {
            id: g.id,
            gameType: g.gameType,
            source: g.source ?? "team_builder",
            teamA: teamA.map((p) => (p.name ?? "").trim() || "—"),
            teamB: teamB.map((p) => (p.name ?? "").trim() || "—"),
          };
        });
        const filtered = games.filter((g) => {
          const teamA = JSON.parse(g.teamA) as { name?: string }[];
          const teamB = JSON.parse(g.teamB) as { name?: string }[];
          const names = [...teamA, ...teamB].map((p) => (p.name ?? "").trim().toLowerCase());
          return names.includes(userName);
        });
        const teamBuilderGames = filtered.filter((g) => (g.source ?? "team_builder") !== "ranked_queue");
        const queueGame = filtered.find((g) => (g.source ?? "team_builder") === "ranked_queue");
        const pendingGameIds = [...teamBuilderGames.map((g) => g.id), ...(queueGame ? [queueGame.id] : [])];
        return {
          count: pendingGameIds.length,
          pendingTeamBuilderCount: teamBuilderGames.length,
          queueMatchId: queueGame?.id ?? null,
          pendingGameIds,
          ongoingGames,
        };
      } catch {
        return {
          count: 0,
          pendingTeamBuilderCount: 0,
          queueMatchId: null as string | null,
          pendingGameIds: [] as string[],
          ongoingGames: [] as OngoingGameNav[],
        };
      }
    })(),
    (async () => {
      try {
        await prisma.user.update({
          where: { id: session.user.id },
          data: { lastSeenAt: now },
        });
      } catch {
        return [];
      }
      try {
        const users = await prisma.user.findMany({
          where: { lastSeenAt: { gte: since } },
          select: { id: true, name: true, username: true },
          orderBy: { lastSeenAt: "desc" },
        });
        return users.map((u) => ({ id: u.id, name: u.name ?? null, username: u.username ?? null }));
      } catch {
        return [];
      }
    })(),
  ]);

  return NextResponse.json({
    pendingGamesCount: pendingResult.count,
    pendingTeamBuilderCount: pendingResult.pendingTeamBuilderCount ?? 0,
    ongoingQueueMatchId: pendingResult.queueMatchId,
    pendingGameIds: pendingResult.pendingGameIds ?? [],
    ongoingGames: pendingResult.ongoingGames ?? [],
    online: onlineResult,
  });
}
