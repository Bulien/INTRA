import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_GAMES = ["lol", "ow", "sc", "battlerite"];

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

  let games: Awaited<ReturnType<typeof prisma.teamBuilderGame.findMany>>;
  try {
    games = await prisma.teamBuilderGame.findMany({
      where: { status },
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { name: true, username: true } } },
    });
  } catch (err: unknown) {
    const prismaError = err as { code?: string; meta?: unknown };
    if (prismaError.code === "P2022") {
      return NextResponse.json({ games: [] });
    }
    throw err;
  }

  const userName = (session.user.name ?? session.user.email ?? "").trim().toLowerCase();
  const filtered = games.filter((g) => {
    const teamA = JSON.parse(g.teamA) as { name: string }[];
    const teamB = JSON.parse(g.teamB) as { name: string }[];
    const names = [...teamA, ...teamB].map((p) => (p.name ?? "").trim().toLowerCase());
    return names.includes(userName);
  });

  const pendingIds = filtered.filter((g) => g.status === "pending").map((g) => g.id);
  let votesByGameId: Record<string, { votesYin: number; votesYang: number }> = {};
  if (pendingIds.length > 0) {
    const votes = await prisma.teamBuilderResultVote.findMany({
      where: { gameId: { in: pendingIds } },
      select: { gameId: true, winner: true },
    });
    for (const id of pendingIds) {
      const gameVotes = votes.filter((v) => v.gameId === id);
      votesByGameId[id] = {
        votesYin: gameVotes.filter((v) => v.winner === "yin").length,
        votesYang: gameVotes.filter((v) => v.winner === "yang").length,
      };
    }
  }

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
      createdByName: (() => {
        const by = (g as { createdBy?: { name?: string; username?: string } }).createdBy;
        return by?.name ?? by?.username ?? "Someone";
      })(),
      source: g.source ?? "team_builder",
      ...(g.draftState ? { draftState: g.draftState } : {}),
      ...(g.status === "pending" && votesByGameId[g.id] && { resultVotes: votesByGameId[g.id] }),
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
  const { gameType, season, teamA, teamB, withDraft } = body;

  if (!VALID_GAMES.includes(gameType) || typeof season !== "number" || season < 1) {
    return NextResponse.json({ error: "Invalid gameType or season" }, { status: 400 });
  }
  if (!Array.isArray(teamA) || !Array.isArray(teamB) || teamA.length === 0 || teamB.length === 0) {
    return NextResponse.json({ error: "teamA and teamB must be non-empty arrays" }, { status: 400 });
  }

  const userExists = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  });
  if (!userExists) {
    return NextResponse.json(
      { error: "Your account was not found. Please sign out and sign in again." },
      { status: 401 }
    );
  }

  let initialDraftState: object | undefined;
  let resolvedTeamA = teamA;
  let resolvedTeamB = teamB;

  if (gameType === "battlerite" && withDraft) {
    const allPlayers = [...teamA, ...teamB] as { id: string; name: string; rating: number }[];
    if (allPlayers.length !== 6) {
      return NextResponse.json({ error: "Draft requires exactly 6 players (3 per team)" }, { status: 400 });
    }

    const playerNames = allPlayers.map((p) => (p.name ?? "").trim().toLowerCase()).filter(Boolean);
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { in: playerNames, mode: "insensitive" } },
          { username: { in: playerNames, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, username: true },
    });

    const nameToUser = new Map<string, { id: string; name: string | null; username: string | null }>();
    for (const u of users) {
      if (u.name) nameToUser.set(u.name.trim().toLowerCase(), u);
      if (u.username) nameToUser.set(u.username.trim().toLowerCase(), u);
    }

    const missing: string[] = [];
    const resolve = (p: { id: string; name: string; rating: number }) => {
      const key = (p.name ?? "").trim().toLowerCase();
      const user = nameToUser.get(key);
      if (!user) {
        missing.push(p.name);
        return p;
      }
      return { ...p, id: user.id };
    };

    resolvedTeamA = (teamA as { id: string; name: string; rating: number }[]).map(resolve);
    resolvedTeamB = (teamB as { id: string; name: string; rating: number }[]).map(resolve);

    if (missing.length > 0) {
      return NextResponse.json(
        { error: `All 6 players need an account for draft. Missing: ${missing.join(", ")}` },
        { status: 400 }
      );
    }

    const now = new Date();
    initialDraftState = {
      phase: "draft" as const,
      round: 1,
      roundEndsAt: new Date(now.getTime() + 30 * 1000).toISOString(),
      bansTeamA: [null, null, null] as (string | null)[],
      bansTeamB: [null, null, null] as (string | null)[],
      picksTeamA: [null, null, null] as (string | null)[],
      picksTeamB: [null, null, null] as (string | null)[],
      lockInTeamA: [false, false, false],
      lockInTeamB: [false, false, false],
      selectionTeamA: null as string | null,
      selectionTeamB: null as string | null,
    };
  }

  const game = await prisma.teamBuilderGame.create({
    data: {
      gameType,
      season,
      createdById: session.user.id,
      teamA: JSON.stringify(resolvedTeamA),
      teamB: JSON.stringify(resolvedTeamB),
      ...(initialDraftState && { draftState: initialDraftState }),
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
    source: game.source ?? "team_builder",
    ...(game.draftState ? { draftState: game.draftState } : {}),
  });
}
