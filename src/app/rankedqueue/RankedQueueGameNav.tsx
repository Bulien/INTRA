"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const BASE = "/ranking/rankedqueue";
const gameSlugs = ["lol", "ow", "sc", "battlerite"] as const;
const gameLabels: Record<string, string> = {
  lol: "LoL",
  ow: "Overwatch",
  sc: "Survival Chaos",
  battlerite: "Battlerite",
};

export function RankedQueueGameNav() {
  const pathname = usePathname();
  const currentGame = pathname?.includes("/ranking/rankedqueue/")
    ? pathname.split("/").pop() ?? "lol"
    : "lol";

  return (
    <nav className="flex flex-col gap-0.5 shrink-0 pt-1">
      <div className="flex gap-2 mb-3 px-1">
        <Link
          href="/ranking/rankedcustom"
          className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-blue-600/20 text-blue-200 border border-blue-500/50 hover:bg-blue-600/30 hover:border-blue-400/70 transition-colors shadow-sm"
        >
          Ranked Custom
        </Link>
        <span className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-amber-500/90 text-amber-950 border border-amber-400/60 shadow-sm">
          Ranked Queue
        </span>
      </div>
      <span className="text-neutral-500 text-xs font-medium uppercase tracking-wider mb-2 px-2">
        Game
      </span>
      {gameSlugs.map((slug) => {
        const href = `${BASE}/${slug}`;
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
      <Link
        href="/ranking"
        className="px-3 py-2 rounded-md text-sm font-medium transition-colors w-fit text-neutral-500 hover:text-cyan-200"
      >
        ← Ranking
      </Link>
    </nav>
  );
}
