import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { sanitizeDisplayName, sanitizePassword } from "./sanitizeInput";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      role?: string;
      bannedUntil?: string | null;
    };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        username: { label: "Login", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;
        const username = sanitizeDisplayName(String(credentials.username)).trim().toLowerCase();
        const password = sanitizePassword(String(credentials.password));
        const user = await prisma.user.findUnique({
          where: { username },
          select: { id: true, email: true, name: true, image: true, password: true, role: true, bannedUntil: true },
        });
        if (!user?.password) return null;
        const bannedUntil = (user as { bannedUntil?: Date | null }).bannedUntil;
        if (bannedUntil && new Date(bannedUntil) > new Date()) return null; // banned
        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return null;
        return {
          id: user.id,
          email: user.email ?? undefined,
          name: user.name ?? username ?? undefined,
          image: user.image ?? undefined,
          role: (user as { role?: string }).role ?? "user",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        const dbUser = await prisma.user.findUnique({ where: { id: user.id! }, select: { role: true } });
        token.role = (dbUser as { role?: string } | null)?.role ?? "user";
      }
      if (trigger === "update" && session) {
        token.name = session.name;
        if (session.role != null) token.role = session.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) ?? "user";
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { bannedUntil: true },
        }).catch(() => null);
        const bannedUntil = (dbUser as { bannedUntil?: Date | null } | null)?.bannedUntil;
        session.user.bannedUntil =
          bannedUntil && new Date(bannedUntil) > new Date()
            ? new Date(bannedUntil).toISOString()
            : null;
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      await prisma.user.update({
        where: { id: user.id! },
        data: { role: "user" },
      });
    },
  },
});
