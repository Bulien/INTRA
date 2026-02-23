"use client";

import { usePathname } from "next/navigation";
import { NewJoinerNotice } from "@/components/NewJoinerNotice";

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
