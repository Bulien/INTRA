import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ names: [] });
  }
  const users = await prisma.user.findMany({
    select: { name: true, username: true },
  });
  const names = new Set<string>();
  for (const u of users) {
    const name = (u as { name?: string | null }).name;
    const username = (u as { username?: string | null }).username;
    if (name != null && String(name).trim() !== "") names.add(String(name).trim());
    if (username != null && String(username).trim() !== "") names.add(String(username).trim());
  }
  const unique = [...names].sort((a, b) => a.localeCompare(b));
  return NextResponse.json({ names: unique });
}
