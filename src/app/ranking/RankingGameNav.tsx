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
  const isTablePage = pathname?.startsWith("/ranking/table");

  return (
    <nav className="flex flex-col gap-0.5 shrink-0 pt-1">
      <span className="text-neutral-500 text-xs font-medium uppercase tracking-wider mb-2 px-2">
        Game
      </span>
      {gameLinks.map((link) => {
        const isActive = isTablePage ? pathname === link.href.replace("/ranking/", "/ranking/table/") : pathname === link.href;
        const href = isTablePage ? link.href.replace("/ranking/", "/ranking/table/") : link.href;
        return (
          <Link
            key={link.href}
            href={href}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors w-fit ${
              isActive ? "text-cyan-300" : "text-neutral-400 hover:text-pink-200"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
      <span className="text-neutral-500 text-xs font-medium uppercase tracking-wider mt-4 mb-2 px-2">
        View
      </span>
      <Link
        href={
          pathname?.startsWith("/ranking/table")
            ? "/ranking/" + (pathname?.split("/")[3] ?? "lol")
            : "/ranking/table/" + (pathname?.split("/")[2] ?? "lol")
        }
        className="px-3 py-2 rounded-md text-sm font-medium transition-colors w-fit text-neutral-400 hover:text-pink-200"
      >
        {pathname?.startsWith("/ranking/table") ? "Leaderboard" : "Table"}
      </Link>
    </nav>
  );
}
