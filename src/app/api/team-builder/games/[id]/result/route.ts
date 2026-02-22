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

/** Survival Chaos (and other FFA): record placement 1–4 per player. */
async function recordPlacementsToRanking(
  gameType: string,
  season: number,
  placements: { playerName: string; placement: number }[]
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

  const setPlacementForPlayer = (name: string, placement: number) => {
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
    playerRow.scores[playerRow.scores.length - 1] = placement;
  };

  for (const { playerName, placement } of placements) {
    setPlacementForPlayer(playerName, placement);
  }

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

import { MIN_REQUIRED_BY_GAME, DEFAULT_MIN_USERS } from "@/lib/teamBuilderValidation";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const game = await prisma.teamBuilderGame.findUnique({ where: { id } });
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const minRequired = MIN_REQUIRED_BY_GAME[game.gameType] ?? DEFAULT_MIN_USERS;
  const userCount = await prisma.user.count();
  if (userCount < minRequired) {
    return NextResponse.json(
      {
        error: `At least ${minRequired} registered players are required to submit results for this game. Currently ${userCount}.`,
      },
      { status: 403 }
    );
  }
  if (game.status !== "pending") {
    return NextResponse.json({ error: "Game result already submitted" }, { status: 400 });
  }

  const teamA = JSON.parse(game.teamA) as { id: string; name: string; rating: number }[];
  const teamB = JSON.parse(game.teamB) as { id: string; name: string; rating: number }[];
  const allPlayers = [...teamA, ...teamB].filter((p) => (p.name ?? "").trim());
  const playerNames = allPlayers.map((p) => (p.name ?? "").trim().toLowerCase()).filter(Boolean);

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

  const userName = (session.user.name ?? session.user.email ?? "").trim().toLowerCase();
  const isCreator = game.createdById === session.user.id;
  const isAdmin = (session.user as { role?: string }).role === "admin";
  const userInGame = allPlayers.some((p) => (p.name ?? "").trim().toLowerCase() === userName);

  // Survival Chaos: free-for-all, submit placements 1–4. Only 3 registered required; unregistered player gets no ranking.
  if (game.gameType === "sc") {
    const registeredCount = playerNames.filter((n) => registeredNorm.has(n)).length;
    if (registeredCount < 3) {
      return NextResponse.json(
        { error: "At least 3 players in the game must have an account to submit results." },
        { status: 403 }
      );
    }

    const placements = body.placements as { playerName: string; placement: number }[] | undefined;
    if (!Array.isArray(placements) || placements.length !== 4) {
      return NextResponse.json(
        { error: "Survival Chaos requires exactly 4 placements (1st–4th)." },
        { status: 400 }
      );
    }
    const seen = new Set<number>();
    const gamePlayerNames = new Set(allPlayers.map((p) => (p.name ?? "").trim().toLowerCase()));
    for (const entry of placements) {
      const placement = Math.round(Number(entry.placement));
      if (placement < 1 || placement > 4) {
        return NextResponse.json({ error: "Each placement must be 1, 2, 3, or 4." }, { status: 400 });
      }
      if (seen.has(placement)) {
        return NextResponse.json({ error: "Each placement 1–4 must be used exactly once." }, { status: 400 });
      }
      seen.add(placement);
      const name = (entry.playerName ?? "").trim();
      if (!gamePlayerNames.has(name.toLowerCase())) {
        return NextResponse.json({ error: `Unknown player: ${name}` }, { status: 400 });
      }
    }
    if (seen.size !== 4) {
      return NextResponse.json({ error: "Placements must be 1, 2, 3, and 4." }, { status: 400 });
    }

    if (!userInGame && !(isCreator && isAdmin)) {
      return NextResponse.json({ error: "Only a player in the game or the creator (admin) can submit placements." }, { status: 403 });
    }

    // Only record ranking for registered players; skip the one with no account
    const placementsForRanking = placements
      .map((e) => ({ playerName: (e.playerName ?? "").trim(), placement: Math.round(Number(e.placement)) }))
      .filter((e) => registeredNorm.has(e.playerName.toLowerCase()));

    await recordPlacementsToRanking(game.gameType, game.season, placementsForRanking);

    await prisma.teamBuilderGame.update({
      where: { id },
      data: { status: "result_submitted", winner: null },
    });

    return NextResponse.json({ success: true, placements: true });
  }

  // Team games: LoL/OW need 6+ registered in game; Battlerite still requires all registered
  const registeredInGame = playerNames.filter((n) => registeredNorm.has(n)).length;
  const isLolOrOw = game.gameType === "lol" || game.gameType === "ow";
  if (isLolOrOw) {
    if (registeredInGame < 6) {
      return NextResponse.json(
        { error: "At least 6 players in the game must have an account to submit results for LoL/Overwatch." },
        { status: 403 }
      );
    }
  } else {
    const allPlayersRegistered = playerNames.every((n) => registeredNorm.has(n));
    if (!allPlayersRegistered) {
      return NextResponse.json(
        { error: "All players in the game must have an account to submit results." },
        { status: 403 }
      );
    }
  }

  // Team games: winner yin | yang
  const winner = body.winner;
  if (winner !== "yin" && winner !== "yang") {
    return NextResponse.json({ error: "winner must be yin or yang" }, { status: 400 });
  }

  const userInYin = teamA.some((p) => (p.name ?? "").trim().toLowerCase() === userName);
  const userInYang = teamB.some((p) => (p.name ?? "").trim().toLowerCase() === userName);
  const losingTeamCanSubmitYinWon = userInYang;
  const losingTeamCanSubmitYangWon = userInYin;

  const canSubmit =
    (isCreator && isAdmin) ||
    (winner === "yin" && losingTeamCanSubmitYinWon) ||
    (winner === "yang" && losingTeamCanSubmitYangWon);
  if (!canSubmit) {
    return NextResponse.json({ error: "Only the losing team can submit the result" }, { status: 403 });
  }

  const winningNames = winner === "yin" ? teamA.map((p) => p.name) : teamB.map((p) => p.name);
  const losingNames = winner === "yin" ? teamB.map((p) => p.name) : teamA.map((p) => p.name);

  // For LoL/OW with unregistered players, only record ranking for registered players
  const winningForRanking = isLolOrOw
    ? winningNames.filter((name) => registeredNorm.has((name ?? "").trim().toLowerCase()))
    : winningNames;
  const losingForRanking = isLolOrOw
    ? losingNames.filter((name) => registeredNorm.has((name ?? "").trim().toLowerCase()))
    : losingNames;
  await recordWinToRanking(game.gameType, game.season, winningForRanking, losingForRanking);

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
