/**
 * Cancel all ongoing games (team builder + queue):
 * - Set all pending TeamBuilderGames to status "cancelled" (team_builder and ranked_queue)
 * - Remove everyone from the queue (delete all QueueEntry)
 *
 * Usage: node scripts/cancel-all-ongoing.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [gamesResult, queueResult] = await Promise.all([
    prisma.teamBuilderGame.updateMany({
      where: { status: "pending" },
      data: { status: "cancelled" },
    }),
    prisma.queueEntry.deleteMany({}),
  ]);

  console.log("Cancelled", gamesResult.count, "pending game(s) (team builder + queue matches).");
  console.log("Removed all users from the queue.");
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
