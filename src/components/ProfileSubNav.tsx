"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Box, Tab, Tabs } from "@mui/material";

type ProfileSubNavProps = {
  basePath: string; // e.g. "/profile" or "/profile/SomeUser"
};

export function ProfileSubNav({ basePath }: ProfileSubNavProps) {
  const pathname = usePathname() ?? "";
  const overviewPath = basePath.replace(/\/$/, "") || "/profile";
  const gameHistoryPath = overviewPath + "/game-history";
  const isGameHistory = pathname === gameHistoryPath || pathname.endsWith("/game-history");

  return (
    <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
      <Tabs value={isGameHistory ? "history" : "overview"} sx={{ minHeight: 40 }}>
        <Tab
          label="Overview"
          value="overview"
          component={Link}
          href={overviewPath}
          sx={{ textTransform: "none", fontWeight: 600 }}
        />
        <Tab
          label="Game history"
          value="history"
          component={Link}
          href={gameHistoryPath}
          sx={{ textTransform: "none", fontWeight: 600 }}
        />
      </Tabs>
    </Box>
  );
}
