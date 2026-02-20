import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_GAMES = ["lol", "ow", "sc", "battlerite"];

function checkPrisma() {
  const client = prisma as unknown as { gameSeason?: unknown };
  if (!client.gameSeason) {
    return NextResponse.json(
      { error: "Database client outdated. Run: npx prisma generate" },
      { status: 503 }
    );
  }
  return null;
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ game: string }> }
) {
  const err = checkPrisma();
  if (err) return err;

  const { game } = await params;

  if (!VALID_GAMES.includes(game)) {
    return NextResponse.json({ error: "Invalid game" }, { status: 400 });
  }

  const existing = await prisma.gameSeason.findUnique({
    where: { gameType: game },
  });

  const nextMax = (existing?.maxSeason ?? 1) + 1;

  await prisma.gameSeason.upsert({
    where: { gameType: game },
    update: { maxSeason: nextMax },
    create: { gameType: game, maxSeason: nextMax },
  });

  return NextResponse.json({ success: true, maxSeason: nextMax });
}
