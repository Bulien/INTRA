import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { sanitizeDisplayName, sanitizeEmail, sanitizePassword } from "@/lib/sanitizeInput";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, name } = body;
    if (!email || typeof email !== "string" || !password || typeof password !== "string") {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }
    const emailTrim = sanitizeEmail(email).trim().toLowerCase();
    const passwordSafe = sanitizePassword(password);
    if (!emailTrim || passwordSafe.length < 6) {
      return NextResponse.json({ error: "Invalid email or password (min 6 characters)" }, { status: 400 });
    }
    const existing = await prisma.user.findUnique({ where: { email: emailTrim } });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });
    }
    const isFirstUser = (await prisma.user.count()) === 0;
    const hashed = await bcrypt.hash(passwordSafe, 10);
    const nameSafe = typeof name === "string" ? sanitizeDisplayName(name).trim() || null : null;
    const user = await prisma.user.create({
      data: {
        email: emailTrim,
        password: hashed,
        name: nameSafe,
        role: isFirstUser ? "admin" : "user",
      },
    });
    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: (user as { role: string }).role,
    });
  } catch (e) {
    console.error("Register error:", e);
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
