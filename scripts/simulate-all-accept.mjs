/**
 * Simulates all players accepting a Battlerite queue game:
 * - If no argument: finds the most recent pending Battlerite ranked_queue game in accept phase.
 * - If game ID argument: uses that game.
 * Updates draftState to phase "draft" (round 1, roundEndsAt = now + 30s) so the draft starts.
 *
 * Usage: node scripts/simulate-all-accept.mjs [gameId]
 * With env: dotenv -e .env.local -- node scripts/simulate-all-accept.mjs [gameId]
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const gameIdArg = process.argv[2];

async function main() {
  let game;
  if (gameIdArg) {
    game = await prisma.teamBuilderGame.findUnique({
      where: { id: gameIdArg },
    });
    if (!game) {
      console.error("Game not found:", gameIdArg);
      process.exit(1);
    }
  } else {
    const list = await prisma.teamBuilderGame.findMany({
      where: {
        gameType: "battlerite",
        source: "ranked_queue",
        status: "pending",
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    game = list.find((g) => {
      const draft = g.draftState;
      return draft && typeof draft === "object" && draft.phase === "accept";
    });
    if (!game) {
      console.error("No Battlerite queue game in accept phase found. Create one or pass a game ID.");
      process.exit(1);
    }
  }

  if (game.gameType !== "battlerite" || (game.source ?? "") !== "ranked_queue") {
    console.error("Game is not a Battlerite ranked queue game.");
    process.exit(1);
  }

  const draft = game.draftState;
  if (!draft || typeof draft !== "object" || draft.phase !== "accept") {
    console.error("Game is not in accept phase (phase:", draft?.phase ?? "none", ").");
    process.exit(1);
  }

  const now = new Date();
  const roundEndsAt = new Date(now.getTime() + 30 * 1000).toISOString();

  const updatedDraft = {
    ...draft,
    phase: "draft",
    round: 1,
    roundEndsAt,
    acceptDeadline: undefined,
    acceptedUserIds: undefined,
  };
  delete updatedDraft.acceptDeadline;
  delete updatedDraft.acceptedUserIds;

  await prisma.teamBuilderGame.update({
    where: { id: game.id },
    data: { draftState: updatedDraft },
  });

  console.log("OK: Game", game.id, "– all players simulated as accepted, draft started (round 1, ends at", roundEndsAt, ")");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
