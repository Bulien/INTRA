"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const BASE = "/ranking/rankedcustom";
const gameSlugs = ["lol", "ow", "sc", "battlerite"] as const;
const gameLabels: Record<string, string> = {
  lol: "LoL",
  ow: "Overwatch",
  sc: "Survival Chaos",
  battlerite: "Battlerite",
};

export function RankingGameNav() {
  const pathname = usePathname();
  const isTablePage = pathname?.startsWith(`${BASE}/table`);
  const currentGame = pathname?.split("/").pop() ?? "lol";

  return (
    <nav className="flex flex-col gap-0.5 shrink-0 pt-1">
      <div className="flex gap-2 mb-3 px-1">
        <span className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-blue-600/90 text-white border border-blue-500/60 shadow-sm">
          Ranked Custom
        </span>
        <Link
          href={`/ranking/rankedqueue/${currentGame}`}
          className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-amber-500/20 text-amber-200 border border-amber-500/50 hover:bg-amber-500/30 hover:border-amber-400/70 transition-colors shadow-sm"
        >
          Ranked Queue
        </Link>
      </div>
      <span className="text-neutral-500 text-xs font-medium uppercase tracking-wider mb-2 px-2">
        Game
      </span>
      {gameSlugs.map((slug) => {
        const href = isTablePage ? `${BASE}/table/${slug}` : `${BASE}/${slug}`;
        const isActive = pathname === href;
        return (
          <Link
            key={slug}
            href={href}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors w-fit ${
              isActive ? "text-cyan-300" : "text-neutral-400 hover:text-pink-200"
            }`}
          >
            {gameLabels[slug]}
          </Link>
        );
      })}
      <span className="text-neutral-500 text-xs font-medium uppercase tracking-wider mt-4 mb-2 px-2">
        View
      </span>
      <Link
        href={
          isTablePage
            ? `${BASE}/${pathname?.split("/")[4] ?? "lol"}`
            : `${BASE}/table/${pathname?.split("/")[3] ?? "lol"}`
        }
        className="px-3 py-2 rounded-md text-sm font-medium transition-colors w-fit text-neutral-400 hover:text-pink-200"
      >
        {isTablePage ? "Leaderboard" : "Table"}
      </Link>
    </nav>
  );
}
