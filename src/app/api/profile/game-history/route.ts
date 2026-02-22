import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const GAME_LABELS: Record<string, string> = {
  lol: "League of Legends",
  ow: "Overwatch",
  sc: "Survival Chaos",
  battlerite: "Battlerite",
};

function normalizeName(s: string): string {
  return (s ?? "").trim().toLowerCase();
}

export type TeamPlayer = { name: string; rating?: number };

export type ProfileGameHistoryEntry = {
  id: string;
  gameType: string;
  gameLabel: string;
  season: number;
  winner: string | null;
  createdAt: string;
  createdByName: string;
  userTeam: "yin" | "yang";
  userWon: boolean | null; // null for SC (no team win)
  teamYin: TeamPlayer[];
  teamYang: TeamPlayer[];
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const userName = normalizeName(session.user.name ?? session.user.email ?? "");
  if (!userName) {
    return NextResponse.json({ games: [] });
  }

  const games = await prisma.teamBuilderGame.findMany({
    where: { status: "result_submitted" },
    orderBy: { createdAt: "desc" },
    include: { createdBy: { select: { name: true, username: true } } },
  });

  const result: ProfileGameHistoryEntry[] = [];

  for (const g of games) {
    const teamA = JSON.parse(g.teamA) as { name: string; rating?: number }[];
    const teamB = JSON.parse(g.teamB) as { name: string; rating?: number }[];
    const inA = teamA.some((p) => normalizeName(p.name) === userName);
    const inB = teamB.some((p) => normalizeName(p.name) === userName);
    if (!inA && !inB) continue;

    const userTeam: "yin" | "yang" = inA ? "yin" : "yang";
    const isSc = g.gameType === "sc";
    const userWon: boolean | null =
      isSc || g.winner == null ? null : (inA && g.winner === "yin") || (inB && g.winner === "yang");

    const by = g.createdBy as { name?: string; username?: string } | undefined;
    const name = (by?.name ?? by?.username ?? "Someone").trim() || "Someone";

    const teamYin = teamA.map((p) => ({ name: (p.name ?? "").trim(), rating: p.rating }));
    const teamYang = teamB.map((p) => ({ name: (p.name ?? "").trim(), rating: p.rating }));

    result.push({
      id: g.id,
      gameType: g.gameType,
      gameLabel: GAME_LABELS[g.gameType] ?? g.gameType,
      season: g.season,
      winner: g.winner,
      createdAt: g.createdAt.toISOString(),
      createdByName: name,
      userTeam,
      userWon,
      teamYin,
      teamYang,
    });
  }

  return NextResponse.json({ games: result });
}
