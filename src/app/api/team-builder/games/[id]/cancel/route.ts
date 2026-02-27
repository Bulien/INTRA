import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { id } = await params;
  const game = await prisma.teamBuilderGame.findUnique({ where: { id } });
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }
  if (game.status !== "pending") {
    return NextResponse.json({ error: "Game is already finished or cancelled" }, { status: 400 });
  }

  const isAdmin = (session.user as { role?: string }).role === "admin";
  const isCreator = game.createdById === session.user.id;
  const isQueueGame = (game.source ?? "team_builder") === "ranked_queue";
  const draft = game.draftState as { phase?: string } | null;
  const inAcceptPhase = draft?.phase === "accept";
  const teamA = JSON.parse(game.teamA) as { id: string }[];
  const teamB = JSON.parse(game.teamB) as { id: string }[];
  const isPlayer = [...teamA, ...teamB].some((p) => p.id === session.user.id);
  if (isQueueGame && !isAdmin && !(inAcceptPhase && isPlayer)) {
    return NextResponse.json({ error: "Only an admin can cancel a queue match" }, { status: 403 });
  }
  if (!isQueueGame && !isCreator && !isAdmin) {
    return NextResponse.json({ error: "Only the game creator or an admin can cancel this game" }, { status: 403 });
  }

  let cancelledByName: string | null = null;
  if (inAcceptPhase && isPlayer) {
    const allPlayers = [...teamA, ...teamB] as { id: string; name?: string }[];
    const player = allPlayers.find((p) => p.id === session.user.id);
    cancelledByName = (player?.name ?? session.user.name ?? session.user.email ?? "Someone").trim() || "Someone";
  }

  const updatedDraft =
    draft && typeof draft === "object" && cancelledByName
      ? { ...draft, cancelledByName }
      : draft;

  await prisma.teamBuilderGame.update({
    where: { id },
    data: {
      status: "cancelled",
      ...(updatedDraft && { draftState: updatedDraft as object }),
    },
  });

  return NextResponse.json({ success: true, cancelledByName: cancelledByName ?? undefined });
}
