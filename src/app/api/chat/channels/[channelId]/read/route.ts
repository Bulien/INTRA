import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** POST: mark channel as read (for DM and group). Sets readAt to channel's lastMessageAt or now. */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ channelId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { channelId } = await params;

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
  } else if (channel.type === "group") {
    const member = await prisma.chatChannelMember.findUnique({
      where: { channelId_userId: { channelId, userId: session.user.id } },
    });
    if (!member) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: "Game channels do not use read state" }, { status: 400 });
  }

  const readAt = channel.lastMessageAt ?? new Date();
  await prisma.userChannelRead.upsert({
    where: {
      userId_channelId: { userId: session.user.id, channelId },
    },
    create: { userId: session.user.id, channelId, readAt },
    update: { readAt },
  });

  return NextResponse.json({ ok: true, readAt: readAt.toISOString() });
}
