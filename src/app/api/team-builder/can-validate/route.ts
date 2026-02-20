import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MIN_USERS_TO_VALIDATE = 10;

export const dynamic = "force-dynamic";

export async function GET() {
  const userCount = await prisma.user.count();
  const canValidate = userCount >= MIN_USERS_TO_VALIDATE;
  return NextResponse.json({ canValidate, userCount, minRequired: MIN_USERS_TO_VALIDATE });
}
