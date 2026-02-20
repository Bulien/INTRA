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

  const userName = (session.user.name ?? session.user.email ?? "").trim().toLowerCase();
  const teamA = JSON.parse(game.teamA) as { name: string }[];
  const teamB = JSON.parse(game.teamB) as { name: string }[];
  const names = [...teamA, ...teamB].map((p) => (p.name ?? "").trim().toLowerCase());
  const isParticipant = names.includes(userName);
  const isCreator = game.createdById === session.user.id;

  if (!isCreator && !isParticipant) {
    return NextResponse.json({ error: "Only the creator or a player in the game can finish it" }, { status: 403 });
  }

  await prisma.teamBuilderGame.update({
    where: { id },
    data: { status: "finished" },
  });

  return NextResponse.json({ success: true });
}
