import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** POST: close (hide) a DM for the current user. Body: { channelId } */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";
  if (!channelId) {
    return NextResponse.json({ error: "channelId required" }, { status: 400 });
  }

  const channel = await prisma.chatChannel.findUnique({ where: { id: channelId } });
  if (!channel || channel.type !== "dm") {
    return NextResponse.json({ error: "Channel not found or not a DM" }, { status: 404 });
  }

  const isParticipant =
    channel.dmUser1Id === session.user.id || channel.dmUser2Id === session.user.id;
  if (!isParticipant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.userClosedDm.upsert({
    where: {
      userId_channelId: { userId: session.user.id, channelId },
    },
    create: { userId: session.user.id, channelId },
    update: {},
  });

  return NextResponse.json({ ok: true });
}
