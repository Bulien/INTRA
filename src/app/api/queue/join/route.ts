import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_GAMES = ["lol", "ow", "sc", "battlerite"] as const;

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
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
