import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function checkTeamBuilderGame() {
  const client = prisma as unknown as { teamBuilderGame?: unknown };
  if (!client.teamBuilderGame) {
    return NextResponse.json(
      { error: "Shared games not available." },
      { status: 503 }
    );
  }
  return null;
}

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const err = checkTeamBuilderGame();
  if (err) return err;

  const result = await (prisma as unknown as { teamBuilderGame: { updateMany: (args: unknown) => Promise<{ count: number }> } })
    .teamBuilderGame.updateMany({
      where: { status: "pending" },
      data: { status: "cancelled" },
    });

  return NextResponse.json({ cancelled: result.count });
}
