"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

/** When the user leaves the app (tab close, navigate away), leave the queue. */
export function LeaveQueueOnUnload() {
  const { status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;

    const leave = () => {
      fetch("/api/queue/leave", { method: "POST", keepalive: true }).catch(() => {});
    };

    window.addEventListener("pagehide", leave);
    window.addEventListener("beforeunload", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("beforeunload", leave);
    };
  }, [status]);

  return null;
}
