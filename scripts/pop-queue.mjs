/**
 * Seed the queue with 10 users so the next GET /api/queue will create a match
 * (queue pop). Allowed to run on production; use --confirm when DB looks like prod.
 *
 * Usage:
 *   node scripts/pop-queue.mjs [gameType] [--confirm]
 *
 * Examples:
 *   node scripts/pop-queue.mjs lol --confirm
 *   node scripts/pop-queue.mjs ow --confirm
 *
 * On production-like DATABASE_URL, --confirm is required.
 * gameType: lol (default) or ow.
 */

import { PrismaClient } from "@prisma/client";

const DATABASE_URL = process.env.DATABASE_URL ?? "";
const NODE_ENV = process.env.NODE_ENV ?? "";

const looksLikeProduction = () => {
  if (NODE_ENV === "production") return true;
  const u = DATABASE_URL.toLowerCase();
  if (/@[\w.-]*\.(neon|supabase|railway|render|heroku|amazonaws|azure|digitalocean)/.test(u)) return true;
  if (u.includes("neon.tech") || u.includes("supabase.co") || u.includes("rds.amazonaws")) return true;
  return false;
};

const argv = process.argv.slice(2);
const hasConfirm = argv.includes("--confirm");
const gameType = (argv.filter((a) => a !== "--confirm")[0]?.trim()?.toLowerCase() || "lol");

if (!["lol", "ow"].includes(gameType)) {
  console.error("gameType must be lol or ow.");
  process.exit(1);
}

if (looksLikeProduction() && !hasConfirm) {
  console.error(
    "DATABASE_URL or NODE_ENV looks like production. Add --confirm to run:\n  node scripts/pop-queue.mjs " +
      gameType +
      " --confirm"
  );
  process.exit(1);
}

const prisma = new PrismaClient();

const users = await prisma.user.findMany({
  take: 10,
  select: { id: true, username: true, name: true },
  orderBy: { createdAt: "asc" },
});

if (users.length < 10) {
  console.error(`Need at least 10 users in the DB. Found ${users.length}.`);
  await prisma.$disconnect();
  process.exit(1);
}

await prisma.queueEntry.deleteMany({
  where: { userId: { in: users.map((u) => u.id) } },
});

await prisma.queueEntry.createMany({
  data: users.map((u) => ({ userId: u.id, gameType })),
});

console.log(
  `Queue seeded for "${gameType}" with ${users.length} users:`,
  users.map((u) => u.username || u.name || u.id).join(", ")
);
console.log("Next GET /api/queue (e.g. when a user opens the app) will create the match.");
await prisma.$disconnect();
