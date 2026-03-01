import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_GAMES = ["lol", "ow", "sc", "battlerite"] as const;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const client = prisma as unknown as { teamBuilderGame?: { findMany: (args: unknown) => Promise<{ teamA: string; teamB: string }[]> } };
  if (client.teamBuilderGame) {
    const pending = await client.teamBuilderGame.findMany({
      where: { status: "pending" },
      select: { teamA: true, teamB: true },
    });
    const userName = (session.user.name ?? session.user.email ?? "").trim().toLowerCase();
    const userId = session.user.id;
    const isInAnyGame = pending.some((g) => {
      const teamA = JSON.parse(g.teamA) as { id?: string; name?: string }[];
      const teamB = JSON.parse(g.teamB) as { id?: string; name?: string }[];
      const names = [...teamA, ...teamB].map((p) => (p.name ?? "").trim().toLowerCase()).filter(Boolean);
      const ids = [...teamA, ...teamB].map((p) => p.id).filter(Boolean);
      return names.includes(userName) || ids.includes(userId);
    });
    if (isInAnyGame) {
      return NextResponse.json(
        { error: "You are already in a game. Finish or leave it before joining the queue." },
        { status: 400 }
      );
    }
  }

  const body = await req.json().catch(() => ({}));
  const gameType = typeof body.gameType === "string" ? body.gameType.toLowerCase() : "";
  if (!VALID_GAMES.includes(gameType as (typeof VALID_GAMES)[number])) {
    return NextResponse.json({ error: "Invalid gameType. Use: lol, ow, sc, battlerite" }, { status: 400 });
  }

  await prisma.queueEntry.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, gameType },
    update: { gameType, joinedAt: new Date() },
  });

  return NextResponse.json({ success: true, gameType });
}
