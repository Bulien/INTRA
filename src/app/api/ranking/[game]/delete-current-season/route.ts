import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_GAMES = ["lol", "ow", "sc", "battlerite"];

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ game: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const { game } = await params;

  if (!VALID_GAMES.includes(game)) {
    return NextResponse.json({ error: "Invalid game" }, { status: 400 });
  }

  const gameSeason = await prisma.gameSeason.findUnique({
    where: { gameType: game },
  });

  const currentMax = gameSeason?.maxSeason ?? 1;
  if (currentMax <= 1) {
    return NextResponse.json(
      { error: "Cannot delete the only season" },
      { status: 400 }
    );
  }

  const seasonToDelete = currentMax;

  await prisma.rankingPlayer.deleteMany({
    where: { gameType: game, season: seasonToDelete },
  });

  await prisma.seasonMeta.deleteMany({
    where: { gameType: game, season: seasonToDelete },
  });

  await prisma.gameSeason.update({
    where: { gameType: game },
    data: { maxSeason: currentMax - 1 },
  });

  return NextResponse.json({
    success: true,
    maxSeason: currentMax - 1,
  });
}
