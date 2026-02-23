import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** POST: add a user to a group channel (reinvite). Body: { userId: string }. Caller must be a member. */
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
  const invitedUserId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!invitedUserId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const channel = await prisma.chatChannel.findUnique({ where: { id: channelId } });
  if (!channel || channel.type !== "group") {
    return NextResponse.json({ error: "Channel not found or not a group" }, { status: 404 });
  }

  const callerMember = await prisma.chatChannelMember.findUnique({
    where: { channelId_userId: { channelId, userId: session.user.id } },
  });
  if (!callerMember) {
    return NextResponse.json({ error: "Only members can invite" }, { status: 403 });
  }

  const invitedUser = await prisma.user.findUnique({
    where: { id: invitedUserId },
    select: { id: true },
  });
  if (!invitedUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await prisma.chatChannelMember.upsert({
    where: { channelId_userId: { channelId, userId: invitedUserId } },
    create: { channelId, userId: invitedUserId },
    update: {},
  });

  return NextResponse.json({ ok: true });
}
