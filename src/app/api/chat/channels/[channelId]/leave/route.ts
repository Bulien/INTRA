import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** POST: leave a group channel (remove membership). Only for type=group. */
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
  if (!channel || channel.type !== "group") {
    return NextResponse.json({ error: "Channel not found or not a group" }, { status: 404 });
  }

  await prisma.chatChannelMember.deleteMany({
    where: { channelId, userId: session.user.id },
  });

  return NextResponse.json({ ok: true });
}
