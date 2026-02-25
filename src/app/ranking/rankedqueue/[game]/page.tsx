import { redirect } from "next/navigation";
import { LeaderboardClient } from "@/app/ranking/[game]/LeaderboardClient";

const GAMES: Record<string, string> = {
  lol: "League of Legends",
  ow: "Overwatch",
  sc: "Survival Chaos",
  battlerite: "Battlerite",
};

export default async function RankingRankedQueueGamePage({
  params,
}: {
  params: Promise<{ game: string }>;
}) {
  const { game } = await params;
  const valid = ["lol", "ow", "sc", "battlerite"];
  if (!valid.includes(game)) {
    redirect("/ranking/rankedqueue/lol");
  }

  return (
    <LeaderboardClient
      gameType={game}
      gameName={GAMES[game]}
      rankingSource="ranked_queue"
    />
  );
}
