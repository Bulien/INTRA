import { RankedQueueGameNav } from "./RankedQueueGameNav";

export default function RankedQueueLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-8 w-full">
      <RankedQueueGameNav />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
