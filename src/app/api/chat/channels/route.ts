import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const GAME_CHANNELS = [
  { gameType: "lol", label: "League of Legends" },
  { gameType: "ow", label: "Overwatch" },
  { gameType: "sc", label: "Survival Chaos" },
  { gameType: "battlerite", label: "Battlerite" },
];

/** GET: list game channels + DM channels for current user */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const userId = session.user.id;

  // Ensure 4 game channels exist
  for (const { gameType } of GAME_CHANNELS) {
    await prisma.chatChannel.upsert({
      where: { type_gameType: { type: "game", gameType } },
      create: { type: "game", gameType },
      update: {},
    });
  }

const closedDmRows = await prisma.userClosedDm.findMany({
    where: { userId },
    select: { channelId: true },
  });
  const closedDmIds = closedDmRows.map((r) => r.channelId);
  const readRows = await prisma.userChannelRead.findMany({
    where: { userId },
    select: { channelId: true, readAt: true },
  });
  const readAtByChannel = new Map(readRows.map((r) => [r.channelId, r.readAt.toISOString()]));

  const [gameChannels, dmChannels, groupChannels, users] = await Promise.all([
    prisma.chatChannel.findMany({
      where: { type: "game" },
      orderBy: { gameType: "asc" },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { sender: { select: { id: true, name: true, username: true } } },
        },
      },
    }),
    prisma.chatChannel.findMany({
      where: {
        type: "dm",
        OR: [{ dmUser1Id: userId }, { dmUser2Id: userId }],
        ...(closedDmIds.length > 0 ? { id: { notIn: closedDmIds } } : {}),
      },
      orderBy: { lastMessageAt: "desc" },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { sender: { select: { id: true, name: true, username: true } } },
        },
      },
    }),
    prisma.chatChannel.findMany({
      where: {
        type: "group",
        members: { some: { userId } },
      },
      orderBy: { lastMessageAt: "desc" },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { sender: { select: { id: true, name: true, username: true } } },
        },
        members: { include: { user: { select: { id: true, name: true, username: true } } } },
      },
    }),
    Promise.resolve([] as { id: string; name: string | null; username: string | null }[]),
  ]);

  const gameList = gameChannels.map((c) => ({
    id: c.id,
    type: "game" as const,
    gameType: c.gameType,
    label: GAME_CHANNELS.find((g) => g.gameType === c.gameType)?.label ?? c.gameType,
    lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
    lastMessage: c.messages[0]
      ? {
          content: c.messages[0].content,
          sender: c.messages[0].sender
            ? { id: c.messages[0].sender.id, name: c.messages[0].sender.name, username: c.messages[0].sender.username }
            : null,
          createdAt: c.messages[0].createdAt.toISOString(),
        }
      : null,
  }));

  const otherUserId = (c: { dmUser1Id: string | null; dmUser2Id: string | null }) =>
    c.dmUser1Id === userId ? c.dmUser2Id! : c.dmUser1Id!;
  const dmList = await Promise.all(
    dmChannels.map(async (c) => {
      const otherId = otherUserId(c);
      const other = await prisma.user.findUnique({
        where: { id: otherId },
        select: { id: true, name: true, username: true },
      });
      return {
        id: c.id,
        type: "dm" as const,
        otherUser: other ? { id: other.id, name: other.name, username: other.username } : null,
        lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
        lastMessage: c.messages[0]
          ? {
              content: c.messages[0].content,
              sender: c.messages[0].sender
                ? { id: c.messages[0].sender.id, name: c.messages[0].sender.name, username: c.messages[0].sender.username }
                : null,
              createdAt: c.messages[0].createdAt.toISOString(),
            }
          : null,
        readAt: readAtByChannel.get(c.id) ?? null,
      };
    })
  );

  const groupList = groupChannels.map((c) => ({
    id: c.id,
    type: "group" as const,
    name: c.name ?? "Group",
    lastMessageAt: c.lastMessageAt?.toISOString() ?? null,
    lastMessage: c.messages[0]
      ? {
          content: c.messages[0].content,
          sender: c.messages[0].sender
            ? { id: c.messages[0].sender.id, name: c.messages[0].sender.name, username: c.messages[0].sender.username }
            : null,
          createdAt: c.messages[0].createdAt.toISOString(),
        }
      : null,
    members: c.members.map((m) => ({ id: m.user.id, name: m.user.name, username: m.user.username })),
    readAt: readAtByChannel.get(c.id) ?? null,
  }));

  return NextResponse.json({
    gameChannels: gameList,
    dmChannels: dmList,
    groupChannels: groupList,
    users: users.map((u) => ({ id: u.id, name: u.name, username: u.username })),
  });
}
