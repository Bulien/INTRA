import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ users: [] });
  }

  const term = q.toLowerCase();
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { username: { not: null, contains: term, mode: "insensitive" } },
        { name: { not: null, contains: term, mode: "insensitive" } },
      ],
    },
    select: { id: true, username: true, name: true },
    take: 15,
    orderBy: { username: "asc" },
  });

  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      username: u.username ?? u.name ?? "—",
      name: u.name ?? u.username ?? "—",
    })),
  });
}
