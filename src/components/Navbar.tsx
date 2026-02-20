"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/team-builder", label: "Team Builder" },
  { href: "/ranking", label: "Ranking" },
];

export function Navbar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();

  return (
    <nav className="border-b border-cyan-500/20 bg-black/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="flex items-center justify-between h-14">
          <Link
            href="/"
            className="text-lg font-semibold text-white hover:text-cyan-300 transition-colors flex items-center gap-1.5"
          >
            <img src="/yin-yang.png" alt="" aria-hidden className="h-6 w-6 block bg-transparent mix-blend-multiply" />
            INTRA
          </Link>

          <div className="flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive =
                link.href === "/"
                  ? pathname === "/"
                  : pathname?.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-cyan-500/20 text-cyan-300"
                      : "text-neutral-400 hover:text-pink-200 hover:bg-pink-500/10"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="ml-2 pl-2 border-l border-white/10">
              {status === "loading" ? (
                <span className="px-3 py-2 text-sm text-neutral-500">…</span>
              ) : session ? (
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="px-3 py-2 rounded-md text-sm font-medium text-neutral-400 hover:text-pink-200 hover:bg-pink-500/10 transition-colors"
                >
                  Log out
                </button>
              ) : (
                <Link
                  href="/login"
                  className="px-3 py-2 rounded-md text-sm font-medium text-neutral-400 hover:text-pink-200 hover:bg-pink-500/10 transition-colors"
                >
                  Login
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
