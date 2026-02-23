import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

/** GET: paginated list of users (for DM/group picker). Query: limit, cursor, q (search) */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));
  const cursor = searchParams.get("cursor") ?? undefined;
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";

  const where: { id: { not: string }; OR?: Array<{ name?: { contains: string; mode: "insensitive" }; username?: { contains: string; mode: "insensitive" } }> } = {
    id: { not: session.user.id },
  };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { username: { contains: q, mode: "insensitive" } },
    ];
  }

  const take = limit + 1;
  const users = await prisma.user.findMany({
    where,
    select: { id: true, name: true, username: true },
    orderBy: { id: "asc" },
    take,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });

  const hasMore = users.length > limit;
  const list = hasMore ? users.slice(0, limit) : users;
  const nextCursor = hasMore ? list[list.length - 1]?.id : null;

  return NextResponse.json({
    users: list.map((u) => ({ id: u.id, name: u.name, username: u.username })),
    nextCursor,
    hasMore: !!nextCursor,
  });
}
