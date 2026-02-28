import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { applyDraftTimeoutIfNeeded, type DraftState } from "@/lib/draftTimeout";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { id } = await params;
  let game = await prisma.teamBuilderGame.findUnique({ where: { id } });
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

  let draftState = game.draftState as DraftState | null;
  if (
    game.gameType === "battlerite" &&
    draftState?.phase === "draft"
  ) {
    const afterTimeout = applyDraftTimeoutIfNeeded(draftState);
    if (afterTimeout) {
      await prisma.teamBuilderGame.update({
        where: { id },
        data: { draftState: afterTimeout as object },
      });
      draftState = afterTimeout;
    }
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

  if (!draftState) draftState = game.draftState as DraftState | null;
  if (draftState && typeof draftState === "object" && draftState.phase === "draft") {
    draftState = {
      ...draftState,
      bansTeamA: Array.isArray(draftState.bansTeamA) ? draftState.bansTeamA : [null, null, null],
      bansTeamB: Array.isArray(draftState.bansTeamB) ? draftState.bansTeamB : [null, null, null],
      picksTeamA: Array.isArray(draftState.picksTeamA) ? draftState.picksTeamA : [null, null, null],
      picksTeamB: Array.isArray(draftState.picksTeamB) ? draftState.picksTeamB : [null, null, null],
      lockInTeamA: Array.isArray(draftState.lockInTeamA) ? draftState.lockInTeamA : [false, false, false],
      lockInTeamB: Array.isArray(draftState.lockInTeamB) ? draftState.lockInTeamB : [false, false, false],
    };
    console.log("[DRAFT-GET] Returning bans:", { round: draftState.round, bansTeamA: draftState.bansTeamA, bansTeamB: draftState.bansTeamB });
  }
  const draftObj = game.draftState as { cancelledByName?: string } | null;
  const cancelledByName = game.status === "cancelled" && draftObj?.cancelledByName ? draftObj.cancelledByName : undefined;

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
    ...(draftState && { draftState }),
    ...(cancelledByName && { cancelledByName }),
  });
}
