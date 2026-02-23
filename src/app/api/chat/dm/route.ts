import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** POST: get or create a DM channel with another user. Body: { otherUserId: string } */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const otherUserId = typeof body.otherUserId === "string" ? body.otherUserId.trim() : "";
  if (!otherUserId) {
    return NextResponse.json({ error: "otherUserId required" }, { status: 400 });
  }

  if (otherUserId === session.user.id) {
    return NextResponse.json({ error: "Cannot DM yourself" }, { status: 400 });
  }

  const other = await prisma.user.findUnique({ where: { id: otherUserId } });
  if (!other) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const [id1, id2] = [session.user.id, otherUserId].sort();
  let channel = await prisma.chatChannel.findFirst({
    where: {
      type: "dm",
      dmUser1Id: id1,
      dmUser2Id: id2,
    },
  });

  if (!channel) {
    channel = await prisma.chatChannel.create({
      data: {
        type: "dm",
        dmUser1Id: id1,
        dmUser2Id: id2,
      },
    });
  }

  // Reopen if user had closed this DM: remove from UserClosedDm so it appears again
  await prisma.userClosedDm.deleteMany({
    where: { userId: session.user.id, channelId: channel.id },
  });

  return NextResponse.json({
    channelId: channel.id,
    otherUser: { id: other.id, name: other.name, username: other.username },
  });
}
