import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeDisplayName } from "@/lib/sanitizeInput";
import { replayElo, BASE_ELO } from "@/lib/eloReplay";

const VALID_GAMES = ["lol", "ow", "sc", "battlerite"];
const TEAM_GAMES = ["lol", "ow", "battlerite"];

function normalizeName(s: string): string {
  return (s ?? "").trim().toLowerCase();
}

function checkPrisma() {
  const client = prisma as unknown as { rankingPlayer?: unknown };
  if (!client.rankingPlayer) {
    return NextResponse.json(
      { error: "Database client outdated. Run: npx prisma generate" },
      { status: 503 }
    );
  }
  return null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ game: string }> }
) {
  const err = checkPrisma();
  if (err) return err;

  const { game } = await params;

  if (!VALID_GAMES.includes(game)) {
    return NextResponse.json({ error: "Invalid game" }, { status: 400 });
  }

  const { searchParams } = new URL(_req.url);
  const season = Math.max(1, parseInt(searchParams.get("season") ?? "1", 10) || 1);
  const source = searchParams.get("source") === "ranked_queue" ? "ranked_queue" : "team_builder";

  const gameSeason = await prisma.gameSeason.findUnique({ where: { gameType: game } }).catch(() => null);
  const maxSeason = gameSeason?.maxSeason ?? 1;

  const teamGamesWhere = {
    gameType: game,
    season,
    status: "result_submitted",
    ...(source === "ranked_queue" ? { source: "ranked_queue" as const } : {}),
  };
  let teamGames: { id: string; teamA: string; teamB: string; winner: string | null; createdAt: Date }[];
  try {
    teamGames = await prisma.teamBuilderGame.findMany({
      where: teamGamesWhere,
      orderBy: { createdAt: "asc" },
      select: { id: true, teamA: true, teamB: true, winner: true, createdAt: true },
    });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === "P2022") {
      if (source === "ranked_queue") {
        return NextResponse.json({
          players: [],
          maxSeason: gameSeason?.maxSeason ?? 1,
          validatedGameIndices: [],
          validatedPlayerIds: [],
        });
      }
      teamGames = [];
    } else {
      throw err;
    }
  }

  if (source === "ranked_queue") {
    if (!TEAM_GAMES.includes(game)) {
      return NextResponse.json({
        players: [],
        maxSeason,
        validatedGameIndices: [],
        validatedPlayerIds: [],
      });
    }
    const replayGames = teamGames.map((g) => {
      const teamA = (JSON.parse(g.teamA) as { name?: string }[]).map((p) => (p.name ?? "").trim()).filter(Boolean);
      const teamB = (JSON.parse(g.teamB) as { name?: string }[]).map((p) => (p.name ?? "").trim()).filter(Boolean);
      return {
        id: g.id,
        gameType: game,
        season,
        teamA,
        teamB,
        winner: g.winner as "yin" | "yang" | null,
        createdAt: g.createdAt,
      };
    });
    const { elos } = replayElo(replayGames);
    const scoresByPlayer: Record<string, (number | null)[]> = {};
    for (const g of replayGames) {
      if (g.winner !== "yin" && g.winner !== "yang") continue;
      const teamA = g.teamA.map((n) => (n ?? "").trim()).filter(Boolean);
      const teamB = g.teamB.map((n) => (n ?? "").trim()).filter(Boolean);
      for (const n of teamA) {
        const key = normalizeName(n);
        if (!scoresByPlayer[key]) scoresByPlayer[key] = [];
        scoresByPlayer[key].push(g.winner === "yin" ? 1 : 0);
      }
      for (const n of teamB) {
        const key = normalizeName(n);
        if (!scoresByPlayer[key]) scoresByPlayer[key] = [];
        scoresByPlayer[key].push(g.winner === "yang" ? 1 : 0);
      }
    }
    const playerNames = Object.keys(scoresByPlayer).sort((a, b) => a.localeCompare(b));
    const players = playerNames.map((name, i) => {
      const scores = scoresByPlayer[name] ?? [];
      const elo = elos[name] ?? BASE_ELO;
      return {
        id: `rq-${i}-${name}`,
        playerName: name,
        scores,
        elo,
      };
    });
    return NextResponse.json({
      players,
      maxSeason,
      validatedGameIndices: [],
      validatedPlayerIds: [],
    });
  }

  const [players, seasonMeta] = await Promise.all([
    prisma.rankingPlayer.findMany({
      where: { gameType: game, season },
      orderBy: { name: "asc" },
    }),
    prisma.seasonMeta.findUnique({
      where: { gameType_season: { gameType: game, season } },
    }).catch(() => null),
  ]);

  const validatedGameIndices: number[] = seasonMeta?.validatedIndices
    ? (JSON.parse(seasonMeta.validatedIndices) as number[])
    : [];
  const validatedPlayerIds: string[] = seasonMeta?.validatedPlayerIds
    ? (JSON.parse(seasonMeta.validatedPlayerIds) as string[])
    : [];

  let elos: Record<string, number> = {};
  if (TEAM_GAMES.includes(game)) {
    const replayGames = teamGames.map((g) => {
      const teamA = (JSON.parse(g.teamA) as { name?: string }[]).map((p) => (p.name ?? "").trim()).filter(Boolean);
      const teamB = (JSON.parse(g.teamB) as { name?: string }[]).map((p) => (p.name ?? "").trim()).filter(Boolean);
      return {
        id: g.id,
        gameType: game,
        season,
        teamA,
        teamB,
        winner: g.winner as "yin" | "yang" | null,
        createdAt: g.createdAt,
      };
    });
    const result = replayElo(replayGames);
    elos = result.elos;
  }

  return NextResponse.json({
    players: players.map((p) => {
      const scores = JSON.parse(p.scores) as (number | null)[];
      const elo = TEAM_GAMES.includes(game) ? (elos[normalizeName(p.name)] ?? BASE_ELO) : undefined;
      return {
        id: p.id,
        playerName: p.name,
        scores,
        ...(elo !== undefined ? { elo } : {}),
      };
    }),
    maxSeason,
    validatedGameIndices,
    validatedPlayerIds,
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ game: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in to update rankings" }, { status: 401 });
  }

  const err = checkPrisma();
  if (err) return err;

  const { game } = await params;

  if (!VALID_GAMES.includes(game)) {
    return NextResponse.json({ error: "Invalid game" }, { status: 400 });
  }

  const body = await req.json();
  const season = Math.max(1, parseInt(body.season ?? "1", 10) || 1);
  const rawPlayers: { id?: string; playerName: string; scores: (number | null)[] }[] =
    body.players ?? [];
  const players = rawPlayers
    .map((p) => ({ ...p, playerName: sanitizeDisplayName(p.playerName ?? "").trim() }))
    .filter((p) => p.playerName);
  const validatedGameIndices =
    body.validatedGameIndices != null
      ? (Array.isArray(body.validatedGameIndices)
          ? body.validatedGameIndices
          : []
        ).filter((n: unknown) => typeof n === "number" && n >= 0)
      : undefined;
  const validatedPlayerIds =
    body.validatedPlayerIds != null && Array.isArray(body.validatedPlayerIds)
      ? (body.validatedPlayerIds as unknown[]).filter((id): id is string => typeof id === "string")
      : undefined;

  // Upsert each player (handle renames: key by id when updating, so renames don't create duplicate id)
  for (const player of players) {
    if (!player.playerName?.trim()) continue;
    const name = player.playerName;
    const scoresStr = JSON.stringify(player.scores);
    const id = player.id;

    const existingById = id
      ? await prisma.rankingPlayer.findUnique({ where: { id } }).catch(() => null)
      : null;
    const existingByName = await prisma.rankingPlayer
      .findUnique({
        where: { name_gameType_season: { name, gameType: game, season } },
      })
      .catch(() => null);

    if (existingById && existingByName && existingById.id !== existingByName.id) {
      // Rename: row with our id has a different name; another row already has the new name. Replace the other row.
      await prisma.rankingPlayer.delete({ where: { id: existingByName.id } });
      await prisma.rankingPlayer.update({
        where: { id: existingById.id },
        data: { name, scores: scoresStr },
      });
    } else if (existingById) {
      // Update existing row by id (handles rename when no conflict, or same row)
      await prisma.rankingPlayer.update({
        where: { id: existingById.id },
        data: { name, scores: scoresStr },
      });
    } else if (existingByName) {
      // Same name, no row with this id: update the existing row's scores
      await prisma.rankingPlayer.update({
        where: { id: existingByName.id },
        data: { scores: scoresStr },
      });
    } else {
      // New player: create (use client id if provided and not taken)
      await prisma.rankingPlayer.create({
        data: {
          ...(id ? { id } : {}),
          name,
          gameType: game,
          season,
          scores: scoresStr,
        },
      });
    }
  }

  // Remove players deleted from the table (this season only)
  const keepNames = players.map((p) => p.playerName);
  await prisma.rankingPlayer.deleteMany({
    where: { gameType: game, season, name: { notIn: keepNames } },
  });

  // Save validated game indices and/or player ids when provided
  if (validatedGameIndices !== undefined || validatedPlayerIds !== undefined) {
    const client = prisma as unknown as { seasonMeta?: unknown };
    if (client.seasonMeta) {
      const existing = await prisma.seasonMeta.findUnique({
        where: { gameType_season: { gameType: game, season } },
      }).catch(() => null);
      await prisma.seasonMeta.upsert({
        where: { gameType_season: { gameType: game, season } },
        update: {
          validatedIndices: validatedGameIndices !== undefined ? JSON.stringify(validatedGameIndices) : existing?.validatedIndices ?? "[]",
          validatedPlayerIds: validatedPlayerIds !== undefined ? JSON.stringify(validatedPlayerIds) : existing?.validatedPlayerIds ?? "[]",
        },
        create: {
          gameType: game,
          season,
          validatedIndices: JSON.stringify(validatedGameIndices ?? []),
          validatedPlayerIds: JSON.stringify(validatedPlayerIds ?? []),
        },
      });
    }
  }

  return NextResponse.json({ success: true });
}
