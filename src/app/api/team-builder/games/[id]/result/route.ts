import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sanitizeDisplayName } from "@/lib/sanitizeInput";

function capitalizeFirst(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

async function recordWinToRanking(
  gameType: string,
  season: number,
  winningPlayerNames: string[],
  losingPlayerNames: string[]
) {
  const rows = await prisma.rankingPlayer.findMany({
    where: { gameType, season },
    orderBy: { name: "asc" },
  });

  const maxGameCount = rows.length > 0 ? Math.max(...rows.map((r) => (JSON.parse(r.scores) as number[]).length)) : 0;
  const updatedRows: { id: string; playerName: string; scores: (number | null)[] }[] = rows.map((r) => ({
    id: r.id,
    playerName: r.name,
    scores: [...(JSON.parse(r.scores) as (number | null)[]), null],
  }));

  const setScoreForPlayer = (name: string, score: 0 | 1) => {
    const normalizedName = capitalizeFirst(name.trim());
    let playerRow = updatedRows.find((r) => r.playerName.toLowerCase() === normalizedName.toLowerCase());
    if (!playerRow) {
      playerRow = {
        id: crypto.randomUUID(),
        playerName: normalizedName,
        scores: Array(maxGameCount + 1).fill(null),
      };
      updatedRows.push(playerRow);
    }
    while (playerRow.scores.length < maxGameCount + 1) playerRow.scores.push(null);
    playerRow.scores[playerRow.scores.length - 1] = score;
  };

  winningPlayerNames.forEach((name) => setScoreForPlayer(name, 1));
  losingPlayerNames.forEach((name) => setScoreForPlayer(name, 0));

  const finalMaxCols = Math.max(...updatedRows.map((r) => r.scores.length));
  updatedRows.forEach((r) => {
    while (r.scores.length < finalMaxCols) r.scores.push(null);
  });

  const seasonMeta = await prisma.seasonMeta.findUnique({
    where: { gameType_season: { gameType, season } },
  }).catch(() => null);
  const validatedIndices: number[] = seasonMeta?.validatedIndices
    ? (JSON.parse(seasonMeta.validatedIndices) as number[])
    : [];
  const validatedPlayerIds: string[] = seasonMeta?.validatedPlayerIds
    ? (JSON.parse(seasonMeta.validatedPlayerIds) as string[])
    : [];
  const newGameIndex = finalMaxCols - 1;
  const mergedValidatedIndices = [...new Set([...validatedIndices, newGameIndex])];
  const mergedValidatedPlayerIds = [...new Set([...validatedPlayerIds, ...updatedRows.map((p) => p.id)])];

  for (const player of updatedRows) {
    const name = sanitizeDisplayName(player.playerName).trim();
    if (!name) continue;
    const scoresStr = JSON.stringify(player.scores);
    const existing = await prisma.rankingPlayer.findUnique({
      where: { name_gameType_season: { name, gameType, season } },
    }).catch(() => null);
    if (existing) {
      await prisma.rankingPlayer.update({
        where: { id: existing.id },
        data: { scores: scoresStr },
      });
    } else {
      await prisma.rankingPlayer.create({
        data: { id: player.id, name, gameType, season, scores: scoresStr },
      });
    }
  }

  await prisma.seasonMeta.upsert({
    where: { gameType_season: { gameType, season } },
    update: {
      validatedIndices: JSON.stringify(mergedValidatedIndices),
      validatedPlayerIds: JSON.stringify(mergedValidatedPlayerIds),
    },
    create: {
      gameType,
      season,
      validatedIndices: JSON.stringify(mergedValidatedIndices),
      validatedPlayerIds: JSON.stringify(mergedValidatedPlayerIds),
    },
  });
}

const MIN_USERS_TO_VALIDATE = 10;

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const userCount = await prisma.user.count();
  if (userCount < MIN_USERS_TO_VALIDATE) {
    return NextResponse.json(
      {
        error: `At least ${MIN_USERS_TO_VALIDATE} registered players are required to submit results. Currently ${userCount}.`,
      },
      { status: 403 }
    );
  }

  const { id } = await params;
  const body = await req.json();
  const winner = body.winner;

  if (winner !== "yin" && winner !== "yang") {
    return NextResponse.json({ error: "winner must be yin or yang" }, { status: 400 });
  }

  const game = await prisma.teamBuilderGame.findUnique({ where: { id } });
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }
  if (game.status !== "pending") {
    return NextResponse.json({ error: "Game result already submitted" }, { status: 400 });
  }

  const teamA = JSON.parse(game.teamA) as { id: string; name: string; rating: number }[];
  const teamB = JSON.parse(game.teamB) as { id: string; name: string; rating: number }[];

  const playerNames = [
    ...teamA.map((p) => (p.name ?? "").trim().toLowerCase()),
    ...teamB.map((p) => (p.name ?? "").trim().toLowerCase()),
  ].filter(Boolean);
  const users = await prisma.user.findMany({
    select: { name: true, username: true },
  });
  const registeredNorm = new Set<string>();
  for (const u of users) {
    const name = (u as { name?: string | null }).name;
    const username = (u as { username?: string | null }).username;
    if (name != null && String(name).trim()) registeredNorm.add(String(name).trim().toLowerCase());
    if (username != null && String(username).trim()) registeredNorm.add(String(username).trim().toLowerCase());
  }
  const allPlayersRegistered = playerNames.every((n) => registeredNorm.has(n));
  if (!allPlayersRegistered) {
    return NextResponse.json(
      { error: "All players in the game must have an account to submit results." },
      { status: 403 }
    );
  }

  const userName = (session.user.name ?? session.user.email ?? "").trim().toLowerCase();
  const userInYin = teamA.some((p) => (p.name ?? "").trim().toLowerCase() === userName);
  const userInYang = teamB.some((p) => (p.name ?? "").trim().toLowerCase() === userName);

  const losingTeamCanSubmitYinWon = userInYang;
  const losingTeamCanSubmitYangWon = userInYin;
  const isCreator = game.createdById === session.user.id;
  const isAdmin = (session.user as { role?: string }).role === "admin";

  const canSubmit =
    (isCreator && isAdmin) ||
    (winner === "yin" && losingTeamCanSubmitYinWon) ||
    (winner === "yang" && losingTeamCanSubmitYangWon);
  if (!canSubmit) {
    return NextResponse.json({ error: "Only the losing team can submit the result" }, { status: 403 });
  }

  const winningNames = winner === "yin" ? teamA.map((p) => p.name) : teamB.map((p) => p.name);
  const losingNames = winner === "yin" ? teamB.map((p) => p.name) : teamA.map((p) => p.name);

  await recordWinToRanking(game.gameType, game.season, winningNames, losingNames);

  const allPlayers = [...teamA, ...teamB].filter((p) => (p.name ?? "").trim());
  const ratingInserts = allPlayers.map((p) => ({
    playerName: (p.name ?? "").trim().toLowerCase(),
    gameType: game.gameType,
    rating: Math.round(Math.min(10, Math.max(1, Number(p.rating) || 5))),
    gameId: id,
  }));
  if (ratingInserts.length > 0) {
    await (prisma as unknown as { playerGameRating: { createMany: (args: { data: typeof ratingInserts }) => Promise<unknown> } }).playerGameRating.createMany({
      data: ratingInserts,
    });
  }

  await prisma.teamBuilderGame.update({
    where: { id },
    data: { status: "result_submitted", winner },
  });

  return NextResponse.json({ success: true, winner });
}
