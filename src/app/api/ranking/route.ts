import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const gameType = searchParams.get("game") ?? "lol";

  const validGames = ["lol", "ow", "sc", "battlerite"];
  if (!validGames.includes(gameType)) {
    return NextResponse.json({ error: "Invalid game type" }, { status: 400 });
  }

  const results = await prisma.gameResult.findMany({
    where: { gameType },
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });

  // Aggregate by user: average score
  const byUser = new Map<
    string,
    { userId: string; name: string; scores: number[]; avg: number; count: number }
  >();

  for (const r of results) {
    const key = r.userId;
    if (!byUser.has(key)) {
      byUser.set(key, {
        userId: r.userId,
        name: r.user.name ?? r.user.email ?? "Unknown",
        scores: [],
        avg: 0,
        count: 0,
      });
    }
    const u = byUser.get(key)!;
    u.scores.push(r.score);
    u.count += 1;
  }

  for (const u of byUser.values()) {
    u.avg = u.scores.reduce((a, b) => a + b, 0) / u.scores.length;
  }

  const ranking = [...byUser.values()]
    .sort((a, b) => b.avg - a.avg)
    .map((u, i) => ({ rank: i + 1, ...u }));

  return NextResponse.json({ ranking });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { gameType, score } = body;

  const validGames = ["lol", "ow", "sc", "battlerite"];
  if (!validGames.includes(gameType) || typeof score !== "number") {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  if (score < 0 || score > 100) {
    return NextResponse.json({ error: "Score must be 0-100" }, { status: 400 });
  }

  await prisma.gameResult.create({
    data: {
      userId: session.user.id,
      gameType,
      score,
    },
  });

  return NextResponse.json({ success: true });
}
