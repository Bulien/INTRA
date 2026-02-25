import { RankingGameNav } from "../RankingGameNav";

export default function RankedCustomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-8 w-full">
      <RankingGameNav />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
