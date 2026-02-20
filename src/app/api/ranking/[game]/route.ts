import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sanitizeDisplayName } from "@/lib/sanitizeInput";

const VALID_GAMES = ["lol", "ow", "sc", "battlerite"];

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

  const [players, gameSeason, seasonMeta] = await Promise.all([
    prisma.rankingPlayer.findMany({
      where: { gameType: game, season },
      orderBy: { name: "asc" },
    }),
    prisma.gameSeason.findUnique({ where: { gameType: game } }).catch(() => null),
    prisma.seasonMeta.findUnique({
      where: { gameType_season: { gameType: game, season } },
    }).catch(() => null),
  ]);

  const maxSeason = gameSeason?.maxSeason ?? 1;
  const validatedGameIndices: number[] = seasonMeta?.validatedIndices
    ? (JSON.parse(seasonMeta.validatedIndices) as number[])
    : [];
  const validatedPlayerIds: string[] = seasonMeta?.validatedPlayerIds
    ? (JSON.parse(seasonMeta.validatedPlayerIds) as string[])
    : [];

  return NextResponse.json({
    players: players.map((p) => ({
      id: p.id,
      playerName: p.name,
      scores: JSON.parse(p.scores) as (number | null)[],
    })),
    maxSeason,
    validatedGameIndices,
    validatedPlayerIds,
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ game: string }> }
) {
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
