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
 * Default gameType: lol (must be lol or ow for matchmaking to run).
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

if (looksLikeProduction()) {
  console.error(
    "seed-queue.mjs cannot run against production. Use a local DB and run with:\n  npx dotenv -e .env.local -- node scripts/seed-queue.mjs lol"
  );
  process.exit(1);
}

const gameType = (process.argv[2]?.trim()?.toLowerCase() || "lol");
if (!["lol", "ow"].includes(gameType)) {
  console.error("gameType must be lol or ow (matchmaking only runs for these).");
  process.exit(1);
}

const prisma = new PrismaClient();

const users = await prisma.user.findMany({
  take: 10,
  select: { id: true, username: true, name: true },
  orderBy: { createdAt: "asc" },
});

if (users.length < 10) {
  console.error(
    `Need at least 10 users in the DB. Found ${users.length}. Create more accounts via the app register page.`
  );
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
  `Seeded queue for "${gameType}" with ${users.length} users:`,
  users.map((u) => u.username || u.name || u.id).join(", ")
);
console.log(
  "\nNext: log in as one of these users, open the app (any page). Within ~4s the queue will pop and you'll see the match modal."
);
await prisma.$disconnect();
