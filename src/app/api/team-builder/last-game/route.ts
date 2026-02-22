import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_GAMES = ["lol", "ow", "sc", "battlerite"];

function checkTeamBuilderGame() {
  const client = prisma as unknown as { teamBuilderGame?: unknown };
  if (!client.teamBuilderGame) {
    return NextResponse.json(
      { error: "Shared games not available." },
      { status: 503 }
    );
  }
  return null;
}

/** GET ?gameType=lol - returns the last submitted game for that game type (most recent result_submitted). */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const err = checkTeamBuilderGame();
  if (err) return err;

  const { searchParams } = new URL(req.url);
  const gameType = searchParams.get("gameType") ?? "";
  if (!VALID_GAMES.includes(gameType)) {
    return NextResponse.json({ error: "Invalid gameType" }, { status: 400 });
  }

  const g = await prisma.teamBuilderGame.findFirst({
    where: { gameType, status: "result_submitted" },
    orderBy: { createdAt: "desc" },
  });

  if (!g) {
    return NextResponse.json({ game: null });
  }

  const teamA = JSON.parse(g.teamA) as { id: string; name: string; rating?: number }[];
  const teamB = JSON.parse(g.teamB) as { id: string; name: string; rating?: number }[];
  return NextResponse.json({
    game: { gameType: g.gameType, teamA, teamB },
  });
}
