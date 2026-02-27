import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { DraftState } from "@/lib/draftTimeout";

/** POST: Accept the queue match (Battlerite only). When all 6 accept, draft starts. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { id: gameId } = await params;
  const game = await prisma.teamBuilderGame.findUnique({ where: { id: gameId } });
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }
  if (game.gameType !== "battlerite" || (game.source ?? "") !== "ranked_queue") {
    return NextResponse.json({ error: "Accept only for Battlerite queue games" }, { status: 400 });
  }

  const draft = game.draftState as DraftState | null;
  if (!draft || draft.phase !== "accept") {
    return NextResponse.json({ error: "Game is not in accept phase" }, { status: 400 });
  }

  const acceptedUserIds = draft.acceptedUserIds ?? [];
  if (acceptedUserIds.includes(session.user.id)) {
    return NextResponse.json({ draftState: draft });
  }

  const teamA = JSON.parse(game.teamA) as { id: string }[];
  const teamB = JSON.parse(game.teamB) as { id: string }[];
  const allPlayerIds = [...teamA.map((p) => p.id), ...teamB.map((p) => p.id)];
  const newAccepted = [...acceptedUserIds, session.user.id];
  const allAccepted = newAccepted.length >= allPlayerIds.length && allPlayerIds.every((id) => newAccepted.includes(id));

  const now = new Date();
  const updated: DraftState = { ...draft, acceptedUserIds: newAccepted };

  if (allAccepted) {
    updated.phase = "draft";
    updated.round = 1;
    updated.roundEndsAt = new Date(now.getTime() + 30 * 1000).toISOString();
    delete (updated as { acceptDeadline?: string }).acceptDeadline;
    delete (updated as { acceptedUserIds?: string[] }).acceptedUserIds;
  }

  await prisma.teamBuilderGame.update({
    where: { id: gameId },
    data: { draftState: updated as object },
  });

  return NextResponse.json({ draftState: updated });
}
