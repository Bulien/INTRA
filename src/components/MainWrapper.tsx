"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const NewJoinerNotice = dynamic(
  () => import("@/components/NewJoinerNotice").then((mod) => ({ default: mod.NewJoinerNotice })),
  { ssr: false }
);

export function MainWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isRanking = pathname?.startsWith("/ranking");

  return (
    <>
      <main
        className={`container mx-auto px-4 py-8 w-full ${
          isRanking ? "max-w-[96rem]" : "max-w-5xl"
        }`}
      >
        {children}
      </main>
      <NewJoinerNotice />
    </>
  );
}
