import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const PASSWORD = "azerty";
const USERNAMES = ["test5", "test6", "test7", "test8", "test9", "test10", "test11", "test12", "test13", "test14"];

const hashed = await bcrypt.hash(PASSWORD, 10);

for (const username of USERNAMES) {
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.log("Skip (exists):", username);
    continue;
  }
  await prisma.user.create({
    data: {
      username,
      name: username,
      password: hashed,
      role: "user",
    },
  });
  console.log("Created:", username);
}

console.log("Done.");
await prisma.$disconnect();
