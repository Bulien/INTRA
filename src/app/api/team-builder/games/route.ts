import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_GAMES = ["lol", "ow", "battlerite"];

function checkTeamBuilderGame() {
  const client = prisma as unknown as { teamBuilderGame?: unknown };
  if (!client.teamBuilderGame) {
    return NextResponse.json(
      { error: "Shared games not available. Stop the dev server, run: npx prisma generate, then restart." },
      { status: 503 }
    );
  }
  return null;
}

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const err = checkTeamBuilderGame();
  if (err) return err;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "pending";

  const games = await prisma.teamBuilderGame.findMany({
    where: { status },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true, username: true } } },
  });

  const userName = (session.user.name ?? session.user.email ?? "").trim().toLowerCase();
  const filtered = games.filter((g) => {
    const teamA = JSON.parse(g.teamA) as { name: string }[];
    const teamB = JSON.parse(g.teamB) as { name: string }[];
    const names = [...teamA, ...teamB].map((p) => (p.name ?? "").trim().toLowerCase());
    return names.includes(userName);
  });

  return NextResponse.json({
    games: filtered.map((g) => ({
      id: g.id,
      gameType: g.gameType,
      season: g.season,
      teamA: JSON.parse(g.teamA),
      teamB: JSON.parse(g.teamB),
      status: g.status,
      winner: g.winner,
      createdAt: g.createdAt,
      createdById: g.createdById,
      createdByName: (g.createdBy as { name?: string }).name ?? (g.createdBy as { username?: string }).username ?? "Someone",
    })),
  });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const err = checkTeamBuilderGame();
  if (err) return err;

  const body = await req.json();
  const { gameType, season, teamA, teamB } = body;

  if (!VALID_GAMES.includes(gameType) || typeof season !== "number" || season < 1) {
    return NextResponse.json({ error: "Invalid gameType or season" }, { status: 400 });
  }
  if (!Array.isArray(teamA) || !Array.isArray(teamB) || teamA.length === 0 || teamB.length === 0) {
    return NextResponse.json({ error: "teamA and teamB must be non-empty arrays" }, { status: 400 });
  }

  const game = await prisma.teamBuilderGame.create({
    data: {
      gameType,
      season,
      createdById: session.user.id,
      teamA: JSON.stringify(teamA),
      teamB: JSON.stringify(teamB),
    },
  });

  return NextResponse.json({
    id: game.id,
    gameType: game.gameType,
    season: game.season,
    teamA: JSON.parse(game.teamA),
    teamB: JSON.parse(game.teamB),
    createdAt: game.createdAt,
    createdById: game.createdById,
    createdByName: (session.user.name ?? (session.user as { email?: string }).email) ?? "You",
  });
}
