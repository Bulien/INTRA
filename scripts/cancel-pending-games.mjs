import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const result = await prisma.teamBuilderGame.updateMany({
  where: { status: "pending" },
  data: { status: "cancelled" },
});

console.log("Cancelled", result.count, "pending game(s).");
await prisma.$disconnect();
