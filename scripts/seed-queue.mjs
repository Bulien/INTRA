/**
 * Seed the queue with 10 users so the next GET /api/queue (e.g. when opening
 * the app as one of them) will create a match and trigger a "queue pop".
 *
 * ONLY runs against a local/dev database. Refuses to run on production.
 *
 * Usage (must use .env.local so you don't touch prod):
 *   npx dotenv -e .env.local -- node scripts/seed-queue.mjs [gameType]
 *
 * Example:
 *   npx dotenv -e .env.local -- node scripts/seed-queue.mjs lol
 *
 * Default gameType: lol. Matchmaking: lol/ow = 10 players (5v5), battlerite = 6 players (3v3).
 */

import { PrismaClient } from "@prisma/client";

const REQUIRED_BY_GAME = { lol: 10, ow: 10, battlerite: 6 };

const DATABASE_URL = process.env.DATABASE_URL ?? "";
const NODE_ENV = process.env.NODE_ENV ?? "";

const looksLikeProduction = () => {
  if (NODE_ENV === "production") return true;
  const u = DATABASE_URL.toLowerCase();
  if (/@[\w.-]*\.(neon|supabase|railway|render|heroku|amazonaws|azure|digitalocean)/.test(u)) return true;
  if (u.includes("neon.tech") || u.includes("supabase.co") || u.includes("rds.amazonaws")) return true;
  return false;
};

if (looksLikeProduction()) {
  console.error(
    "seed-queue.mjs cannot run against production. Use a local DB and run with:\n  npx dotenv -e .env.local -- node scripts/seed-queue.mjs lol"
  );
  process.exit(1);
}

const gameType = (process.argv[2]?.trim()?.toLowerCase() || "lol");
const required = REQUIRED_BY_GAME[gameType];
if (!required) {
  console.error("gameType must be lol, ow, or battlerite (matchmaking only runs for these).");
  process.exit(1);
}

const prisma = new PrismaClient();

const users = await prisma.user.findMany({
  take: Math.max(required, 10),
  select: { id: true, username: true, name: true },
  orderBy: { createdAt: "asc" },
});

if (users.length < required) {
  console.error(
    `Need at least ${required} users in the DB for "${gameType}". Found ${users.length}. Create more accounts via the app register page.`
  );
  await prisma.$disconnect();
  process.exit(1);
}
const toSeed = users.slice(0, required);

await prisma.queueEntry.deleteMany({
  where: { userId: { in: toSeed.map((u) => u.id) } },
});

await prisma.queueEntry.createMany({
  data: toSeed.map((u) => ({ userId: u.id, gameType })),
});

console.log(
  `Seeded queue for "${gameType}" with ${toSeed.length} users:`,
  toSeed.map((u) => u.username || u.name || u.id).join(", ")
);
console.log(
  "\nNext: log in as one of these users, open the app (any page). Within ~4s the queue will pop and you'll see the match modal."
);
await prisma.$disconnect();
