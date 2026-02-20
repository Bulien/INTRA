import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ names: [] });
  }
  const users = await prisma.user.findMany({
    where: { name: { not: null } },
    select: { name: true },
  });
  const names = users.map((u) => u.name).filter((n): n is string => !!n && n.trim() !== "");
  const unique = [...new Set(names)];
  unique.sort((a, b) => a.localeCompare(b));
  return NextResponse.json({ names: unique });
}
