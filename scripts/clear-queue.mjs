/**
 * Clear all (or one game's) queue entries. Use on prod to reset the queue.
 *
 * Usage:
 *   Clear entire queue (all games):
 *     npx dotenv -e .env -- node scripts/clear-queue.mjs --confirm
 *
 *   Clear only one game (e.g. lol, ow, battlerite):
 *     npx dotenv -e .env -- node scripts/clear-queue.mjs --confirm --game lol
 *
 * You must pass --confirm or nothing is deleted.
 */

import { PrismaClient } from "@prisma/client";

const args = process.argv.slice(2);
const confirm = args.includes("--confirm");
const gameIndex = args.indexOf("--game");
const gameType = gameIndex >= 0 && args[gameIndex + 1] ? args[gameIndex + 1].toLowerCase() : null;

if (!confirm) {
  console.error("Run with --confirm to clear the queue. Example:");
  console.error('  npx dotenv -e .env -- node scripts/clear-queue.mjs --confirm');
  process.exit(1);
}

const prisma = new PrismaClient();

const where = gameType ? { gameType } : {};
const count = await prisma.queueEntry.count({ where });
await prisma.queueEntry.deleteMany({ where });

console.log("Cleared", count, "queue entry/entries" + (gameType ? ` for game "${gameType}"` : " (all games)") + ".");
await prisma.$disconnect();
