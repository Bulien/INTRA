"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const gameLinks = [
  { href: "/ranking/lol", label: "LoL" },
  { href: "/ranking/ow", label: "Overwatch" },
  { href: "/ranking/sc", label: "Survival Chaos" },
  { href: "/ranking/battlerite", label: "Battlerite" },
];

export function RankingGameNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 shrink-0 pt-1">
      <span className="text-neutral-500 text-xs font-medium uppercase tracking-wider mb-2 px-2">
        Game
      </span>
      {gameLinks.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`px-3 py-2 rounded-md text-sm font-medium transition-colors w-fit ${
            pathname === link.href
              ? "text-cyan-300"
              : "text-neutral-400 hover:text-pink-200"
          }`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
