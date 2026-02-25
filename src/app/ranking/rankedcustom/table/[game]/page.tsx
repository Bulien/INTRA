import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { RankingClient } from "@/app/ranking/[game]/RankingClient";

const GAMES: Record<string, string> = {
  lol: "League of Legends",
  ow: "Overwatch",
  sc: "Survival Chaos",
  battlerite: "Battlerite",
};

export default async function RankedCustomTablePage({
  params,
}: {
  params: Promise<{ game: string }>;
}) {
  const { game } = await params;
  const valid = ["lol", "ow", "sc", "battlerite"];
  if (!valid.includes(game)) {
    redirect("/ranking/rankedcustom/table/lol");
  }
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";

  return (
    <RankingClient gameType={game} gameName={GAMES[game]} isAdmin={isAdmin} />
  );
}
