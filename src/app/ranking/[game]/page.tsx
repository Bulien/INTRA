import { redirect } from "next/navigation";

export default async function RankingGameRedirect({
  params,
}: {
  params: Promise<{ game: string }>;
}) {
  const { game } = await params;
  const valid = ["lol", "ow", "sc", "battlerite"];
  redirect(valid.includes(game) ? `/ranking/rankedcustom/${game}` : "/ranking/rankedcustom/lol");
}
