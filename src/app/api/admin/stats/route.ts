import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function isAdmin(session: { user?: { role?: string } } | null): boolean {
  return (session?.user as { role?: string } | undefined)?.role === "admin";
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  if (!isAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [totalUsers, usersLast7d, usersLast30d, bannedCount, totalGames, gamesLast7d, gamesLast30d, totalResults, resultsLast7d, allUsers, allGames, allResults] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.user.count({ where: { bannedUntil: { gt: now } } }),
    prisma.teamBuilderGame.count(),
    prisma.teamBuilderGame.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.teamBuilderGame.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.gameResult.count(),
    prisma.gameResult.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    prisma.user.findMany({ select: { createdAt: true } }),
    prisma.teamBuilderGame.findMany({ select: { createdAt: true } }),
    prisma.gameResult.findMany({ select: { createdAt: true } }),
  ]);

  const usersByDay = new Map<string, number>();
  for (const u of allUsers) {
    const key = toDateKey(u.createdAt);
    usersByDay.set(key, (usersByDay.get(key) ?? 0) + 1);
  }
  const gamesByDay = new Map<string, number>();
  for (const g of allGames) {
    const key = toDateKey(g.createdAt);
    gamesByDay.set(key, (gamesByDay.get(key) ?? 0) + 1);
  }
  const resultsByDay = new Map<string, number>();
  for (const r of allResults) {
    const key = toDateKey(r.createdAt);
    resultsByDay.set(key, (resultsByDay.get(key) ?? 0) + 1);
  }

  const sortedDates = Array.from(
    new Set([...usersByDay.keys(), ...gamesByDay.keys(), ...resultsByDay.keys()])
  ).sort();

  const usersOverTime = sortedDates.map((date) => ({ date, count: usersByDay.get(date) ?? 0 }));
  const gamesOverTime = sortedDates.map((date) => ({ date, count: gamesByDay.get(date) ?? 0 }));
  const resultsOverTime = sortedDates.map((date) => ({ date, count: resultsByDay.get(date) ?? 0 }));

  return NextResponse.json({
    kpis: {
      totalUsers,
      usersLast7d,
      usersLast30d,
      bannedCount,
      totalGames,
      gamesLast7d,
      gamesLast30d,
      totalResults,
      resultsLast7d,
    },
    usersOverTime,
    gamesOverTime,
    resultsOverTime,
  });
}
