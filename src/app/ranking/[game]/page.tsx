import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { RankingClient } from "./RankingClient";

const GAMES: Record<string, string> = {
  lol: "League of Legends",
  ow: "Overwatch",
  sc: "SurvivalChaos",
  battlerite: "Battlerite",
};

export default async function RankingPage({
  params,
}: {
  params: Promise<{ game: string }>;
}) {
  const { game } = await params;
  const valid = ["lol", "ow", "sc", "battlerite"];
  if (!valid.includes(game)) {
    redirect("/ranking/lol");
  }
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";

  return (
    <RankingClient gameType={game} gameName={GAMES[game]} isAdmin={isAdmin} />
  );
}
