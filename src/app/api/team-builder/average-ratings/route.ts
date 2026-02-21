import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const gameType = searchParams.get("gameType");
  const namesParam = searchParams.get("names");

  if (!gameType || !namesParam) {
    return NextResponse.json({ error: "gameType and names required" }, { status: 400 });
  }

  const names = namesParam
    .split(",")
    .map((n) => n.trim().toLowerCase())
    .filter(Boolean);
  if (names.length === 0) {
    return NextResponse.json({ averages: {} });
  }

  const rows = await (prisma as unknown as {
    playerGameRating: {
      groupBy: (args: {
        by: ["playerName", "gameType"];
        where: { gameType: string; playerName: { in: string[] } };
        _avg: { rating: true };
      }) => Promise<{ playerName: string; gameType: string; _avg: { rating: number | null } }[]>;
    };
  }).playerGameRating.groupBy({
    by: ["playerName", "gameType"],
    where: { gameType, playerName: { in: names } },
    _avg: { rating: true },
  });

  const averages: Record<string, number> = {};
  for (const r of rows) {
    const avg = r._avg?.rating;
    if (avg != null) averages[r.playerName] = Math.round(avg * 10) / 10;
  }

  return NextResponse.json({ averages });
}
