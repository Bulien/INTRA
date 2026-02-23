import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const GAME_TYPES = ["lol", "ow", "sc", "battlerite"] as const;
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

/** GET: current user's queue entry (if any) + all queued players grouped by game */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
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
    const displayName = (u.name ?? u.username ?? "?").trim() || "?";
    playersByGame[e.gameType].push({
      id: u.id,
      name: u.name ?? null,
      username: u.username ?? null,
      gameType: e.gameType,
      joinedAt: e.joinedAt.toISOString(),
    });
  }

  return NextResponse.json({
    myEntry: myEntry
      ? { gameType: myEntry.gameType, joinedAt: myEntry.joinedAt.toISOString(), label: GAME_LABELS[myEntry.gameType] ?? myEntry.gameType }
      : null,
    playersByGame,
    gameLabels: GAME_LABELS,
  });
}
