import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MIN_REQUIRED_BY_GAME, DEFAULT_MIN_USERS } from "@/lib/teamBuilderValidation";

export const dynamic = "force-dynamic";

export async function GET() {
  const userCount = await prisma.user.count();
  const canValidate = userCount >= Math.min(...Object.values(MIN_REQUIRED_BY_GAME));
  return NextResponse.json({
    canValidate,
    userCount,
    minRequiredByGame: MIN_REQUIRED_BY_GAME,
    defaultMin: DEFAULT_MIN_USERS,
  });
}
