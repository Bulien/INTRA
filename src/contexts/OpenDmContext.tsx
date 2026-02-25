"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type OpenDmContextValue = {
  openDmWithUserId: string | null;
  setOpenDmWithUserId: (userId: string | null) => void;
};

const OpenDmContext = createContext<OpenDmContextValue | null>(null);

export function OpenDmProvider({ children }: { children: ReactNode }) {
  const [openDmWithUserId, setOpenDmWithUserId] = useState<string | null>(null);
  return (
    <OpenDmContext.Provider value={{ openDmWithUserId, setOpenDmWithUserId }}>
      {children}
    </OpenDmContext.Provider>
  );
}

export function useOpenDm() {
  const ctx = useContext(OpenDmContext);
  if (!ctx) return { openDmWithUserId: null, setOpenDmWithUserId: () => {} };
  return ctx;
}
