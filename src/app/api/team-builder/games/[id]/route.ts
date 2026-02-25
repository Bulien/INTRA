import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { id } = await params;
  const game = await prisma.teamBuilderGame.findUnique({ where: { id } });
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const teamA = JSON.parse(game.teamA) as { id: string; name: string; rating: number }[];
  const teamB = JSON.parse(game.teamB) as { id: string; name: string; rating: number }[];
  const allNames = [...teamA, ...teamB].map((p) => (p.name ?? "").trim().toLowerCase()).filter(Boolean);
  const userName = (session.user.name ?? session.user.email ?? "").trim().toLowerCase();
  const isAdmin = (session.user as { role?: string }).role === "admin";
  const userInGame = allNames.includes(userName);

  if (!userInGame && !isAdmin) {
    return NextResponse.json({ error: "You are not in this game" }, { status: 403 });
  }

  let resultVotes: { votesYin: number; votesYang: number } | undefined;
  if (game.status === "pending") {
    const votes = await prisma.teamBuilderResultVote.findMany({
      where: { gameId: game.id },
      select: { winner: true },
    });
    resultVotes = {
      votesYin: votes.filter((v) => v.winner === "yin").length,
      votesYang: votes.filter((v) => v.winner === "yang").length,
    };
  }

  return NextResponse.json({
    id: game.id,
    gameType: game.gameType,
    season: game.season,
    teamA,
    teamB,
    status: game.status,
    winner: game.winner,
    createdAt: game.createdAt,
    source: game.source ?? "team_builder",
    ...(resultVotes && { resultVotes }),
  });
}
