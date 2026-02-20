import { PrismaClient } from "@prisma/client";

const username = process.argv[2]?.trim()?.toLowerCase();
if (!username) {
  console.error("Usage: node scripts/set-admin.mjs <username>");
  console.error("Example: node scripts/set-admin.mjs tinky");
  process.exit(1);
}

const prisma = new PrismaClient();

const user = await prisma.user.findFirst({
  where: { username: { equals: username } },
  select: { id: true, username: true, role: true },
});

if (!user) {
  console.error("No user found with username:", username);
  await prisma.$disconnect();
  process.exit(1);
}

if (user.role === "admin") {
  console.log(user.username, "is already an admin.");
  await prisma.$disconnect();
  process.exit(0);
}

await prisma.user.update({
  where: { id: user.id },
  data: { role: "admin" },
});

console.log("Set", user.username, "as admin. They must log out and log in again for the change to apply.");
await prisma.$disconnect();
