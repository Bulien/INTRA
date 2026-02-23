import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** POST: create a group channel and add members. Body: { name?: string, userIds: string[] } */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) || "Group" : "Group";
  const userIds = Array.isArray(body.userIds) ? body.userIds : [];
  const uniqueIds = [...new Set(userIds)].filter((id): id is string => typeof id === "string");
  const memberIds = [session.user.id, ...uniqueIds.filter((id) => id !== session.user.id)];

  const existing = await prisma.user.findMany({
    where: { id: { in: memberIds } },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((u) => u.id));
  const validMemberIds = memberIds.filter((id) => existingIds.has(id));

  const channel = await prisma.chatChannel.create({
    data: {
      type: "group",
      name,
      members: {
        create: validMemberIds.map((userId) => ({ userId })),
      },
    },
    include: {
      members: { include: { user: { select: { id: true, name: true, username: true } } } },
    },
  });

  return NextResponse.json({
    channelId: channel.id,
    name: channel.name,
    members: channel.members.map((m) => ({ id: m.user.id, name: m.user.name, username: m.user.username })),
  });
}
