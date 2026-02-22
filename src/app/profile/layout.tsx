"use client";

import { usePathname } from "next/navigation";
import { ProfileSubNav } from "@/components/ProfileSubNav";

function getBasePath(pathname: string): string {
  const segments = pathname.replace(/^\//, "").split("/").filter(Boolean);
  if (segments[0] !== "profile") return "/profile";
  if (segments.length === 1) return "/profile";
  if (segments.length === 2 && segments[1] === "game-history") return "/profile";
  if (segments.length >= 2) return `/profile/${segments[1]}`;
  return "/profile";
}

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const basePath = getBasePath(pathname);

  return (
    <>
      <ProfileSubNav basePath={basePath} />
      {children}
    </>
  );
}
