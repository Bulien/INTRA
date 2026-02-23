import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** GET: messages for a channel (paginated, newest last) */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { channelId } = await params;
  const { searchParams } = new URL(_req.url);
  const before = searchParams.get("before"); // cursor for older messages
  const limit = Math.min(30, Math.max(1, parseInt(searchParams.get("limit") ?? "30", 10) || 30));

  const channel = await prisma.chatChannel.findUnique({ where: { id: channelId } });
  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  if (channel.type === "dm") {
    const isParticipant =
      channel.dmUser1Id === session.user.id || channel.dmUser2Id === session.user.id;
    if (!isParticipant) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  if (channel.type === "group") {
    const member = await prisma.chatChannelMember.findUnique({
      where: { channelId_userId: { channelId, userId: session.user.id } },
    });
    if (!member) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const includeSender = { sender: { select: { id: true, name: true, username: true } } } as const;
  let messages: Awaited<
    ReturnType<typeof prisma.chatMessage.findMany<{ include: typeof includeSender }>>
  >;
  if (before) {
    const beforeMsg = await prisma.chatMessage.findUnique({
      where: { id: before, channelId },
      select: { createdAt: true },
    });
    if (!beforeMsg) {
      return NextResponse.json({ error: "Invalid cursor" }, { status: 400 });
    }
    messages = await prisma.chatMessage.findMany({
      where: { channelId, createdAt: { lt: beforeMsg.createdAt } },
      take: limit + 1,
      orderBy: { createdAt: "desc" },
      include: includeSender,
    });
    messages = messages.reverse();
  } else {
    // Return the 30 most recent messages (newest last); fetch desc then reverse to chronological
    const newest = await prisma.chatMessage.findMany({
      where: { channelId },
      take: limit,
      orderBy: { createdAt: "desc" },
      include: includeSender,
    });
    messages = newest.reverse();
  }

  const hasMore = messages.length > limit;
  const list = hasMore ? messages.slice(0, limit) : messages;

  return NextResponse.json({
    messages: list.map((m) => ({
      id: m.id,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
      sender: m.sender
        ? { id: m.sender.id, name: m.sender.name, username: m.sender.username }
        : null,
    })),
    hasMore,
    nextCursor: hasMore ? list[list.length - 1]?.id : null,
  });
}

/** POST: send a message */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { channelId } = await params;
  const body = await req.json().catch(() => ({}));
  const content = typeof body.content === "string" ? body.content.trim().slice(0, 50) : "";
  if (!content) {
    return NextResponse.json({ error: "Content required" }, { status: 400 });
  }

  const channel = await prisma.chatChannel.findUnique({ where: { id: channelId } });
  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  if (channel.type === "dm") {
    const isParticipant =
      channel.dmUser1Id === session.user.id || channel.dmUser2Id === session.user.id;
    if (!isParticipant) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  if (channel.type === "group") {
    const member = await prisma.chatChannelMember.findUnique({
      where: { channelId_userId: { channelId, userId: session.user.id } },
    });
    if (!member) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const message = await prisma.chatMessage.create({
    data: {
      channelId,
      senderId: session.user.id,
      content,
    },
    include: {
      sender: { select: { id: true, name: true, username: true } },
    },
  });

  await prisma.chatChannel.update({
    where: { id: channelId },
    data: { lastMessageAt: message.createdAt },
  });

  // Reopen DM for the recipient if they had closed it (so they see the new message)
  if (channel.type === "dm") {
    const otherUserId =
      channel.dmUser1Id === session.user.id ? channel.dmUser2Id : channel.dmUser1Id;
    if (otherUserId) {
      await prisma.userClosedDm.deleteMany({
        where: { userId: otherUserId, channelId },
      });
    }
  }

  // Enforce 30-message cap: delete oldest messages so only the 30 most recent remain
  const total = await prisma.chatMessage.count({ where: { channelId } });
  if (total > 30) {
    const oldest = await prisma.chatMessage.findMany({
      where: { channelId },
      orderBy: { createdAt: "asc" },
      take: total - 30,
      select: { id: true },
    });
    if (oldest.length > 0) {
      await prisma.chatMessage.deleteMany({
        where: { id: { in: oldest.map((m) => m.id) } },
      });
    }
  }

  return NextResponse.json({
    id: message.id,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
    sender: message.sender
      ? { id: message.sender.id, name: message.sender.name, username: message.sender.username }
      : null,
  });
}
