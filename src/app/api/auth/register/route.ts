import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sanitizeDisplayName, sanitizePassword } from "@/lib/sanitizeInput";

const REGISTRATION_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0]?.trim() : null;
  return ip ?? req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const tenMinutesAgo = new Date(Date.now() - REGISTRATION_COOLDOWN_MS);
    const recentFromSameIp = await prisma.registrationAttempt.findFirst({
      where: { ip, createdAt: { gte: tenMinutesAgo } },
      orderBy: { createdAt: "desc" },
    });
    if (recentFromSameIp) {
      const waitMs = REGISTRATION_COOLDOWN_MS - (Date.now() - recentFromSameIp.createdAt.getTime());
      const waitMin = Math.ceil(waitMs / 60000);
      return NextResponse.json(
        {
          error: `Only one account can be created from this device per 10 minutes. Please try again in about ${waitMin} minute${waitMin !== 1 ? "s" : ""}.`,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { login, password, confirmPassword } = body;
    if (!login || typeof login !== "string" || !password || typeof password !== "string") {
      return NextResponse.json({ error: "Login and password required" }, { status: 400 });
    }
    if (password !== confirmPassword) {
      return NextResponse.json({ error: "Password and confirmation do not match" }, { status: 400 });
    }
    const username = sanitizeDisplayName(login).trim().toLowerCase();
    if (!username) {
      return NextResponse.json({ error: "Login is required" }, { status: 400 });
    }
    const passwordSafe = sanitizePassword(password);
    if (passwordSafe.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json({ error: "This login is already taken" }, { status: 409 });
    }
    const isFirstUser = (await prisma.user.count()) === 0;
    const hashed = await bcrypt.hash(passwordSafe, 10);
    const user = await prisma.user.create({
      data: {
        username,
        name: username,
        password: hashed,
        role: isFirstUser ? "admin" : "user",
      },
    });
    await prisma.registrationAttempt.create({ data: { ip } });
    return NextResponse.json({
      id: user.id,
      username: (user as { username?: string }).username,
      name: user.name,
      role: (user as { role: string }).role,
    });
  } catch (e) {
    console.error("Register error:", e);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
