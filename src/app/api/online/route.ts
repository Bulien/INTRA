import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ONLINE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export type OnlineUser = {
  id: string;
  name: string | null;
  username: string | null;
};

/** GET: list of users currently logged in (active in the app). Updates current user's lastSeenAt. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const now = new Date();
  const since = new Date(now.getTime() - ONLINE_WINDOW_MS);

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { lastSeenAt: now },
    });
  } catch {
    // lastSeenAt column may not exist yet; return empty list until migration is run
    return NextResponse.json({ users: [] });
  }

  let users: { id: string; name: string | null; username: string | null }[];
  try {
    users = await prisma.user.findMany({
      where: { lastSeenAt: { gte: since } },
      select: { id: true, name: true, username: true },
      orderBy: { lastSeenAt: "desc" },
    });
  } catch {
    return NextResponse.json({ users: [] });
  }

  const result: OnlineUser[] = users.map((u) => ({
    id: u.id,
    name: u.name ?? null,
    username: u.username ?? null,
  }));

  return NextResponse.json({ users: result });
}
