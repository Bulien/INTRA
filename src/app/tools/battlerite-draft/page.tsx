"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  BATTLERITE_MELEE,
  BATTLERITE_RANGED,
  BATTLERITE_SUPPORT,
  championImagePath,
  championDisplayName,
} from "@/lib/battleriteChampions";

type DraftState = {
  round: number;
  roundEndsAt?: string;
  bansTeamA: (string | null)[];
  bansTeamB: (string | null)[];
  picksTeamA: (string | null)[];
  picksTeamB: (string | null)[];
  lockInTeamA: boolean[];
  lockInTeamB: boolean[];
  selectionTeamA: string | null;
  selectionTeamB: string | null;
};

const ROUND_LABELS: Record<number, string> = {
  1: "Round 1: Global Ban",
  2: "Round 2: Ban",
  3: "Round 3: Pick",
  4: "Round 4: Pick",
  5: "Round 5: Ban",
  6: "Round 6: Pick",
};

const ROUND_ACTIONS: Record<number, { type: "global_ban" | "ban" | "pick"; slotA: number; slotB: number }> = {
  1: { type: "global_ban", slotA: 0, slotB: 0 },
  2: { type: "ban", slotA: 1, slotB: 1 },
  3: { type: "pick", slotA: 0, slotB: 0 },
  4: { type: "pick", slotA: 1, slotB: 1 },
  5: { type: "ban", slotA: 2, slotB: 2 },
  6: { type: "pick", slotA: 2, slotB: 2 },
};

const INITIAL_DRAFT: DraftState = {
  round: 1,
  bansTeamA: [null, null, null],
  bansTeamB: [null, null, null],
  picksTeamA: [null, null, null],
  picksTeamB: [null, null, null],
  lockInTeamA: [false, false, false],
  lockInTeamB: [false, false, false],
  selectionTeamA: null,
  selectionTeamB: null,
};

const DEFAULT_NAMES_A = ["Player 1", "Player 2", "Player 3"];
const DEFAULT_NAMES_B = ["Player 4", "Player 5", "Player 6"];

function bannedForTeam(draft: DraftState, team: "A" | "B"): string[] {
  const bA = draft.bansTeamA;
  const bB = draft.bansTeamB;
  const result: string[] = [];
  if (bA[0]) result.push(bA[0]);
  if (bB[0]) result.push(bB[0]);
  if (team === "A") {
    if (bB[1]) result.push(bB[1]);
    if (bB[2]) result.push(bB[2]);
  } else {
    if (bA[1]) result.push(bA[1]);
    if (bA[2]) result.push(bA[2]);
  }
  return result;
}

export default function BattleriteDraftToolPage() {
  const [phase, setPhase] = useState<"setup" | "draft" | "done">("setup");
  const [namesA, setNamesA] = useState(DEFAULT_NAMES_A);
  const [namesB, setNamesB] = useState(DEFAULT_NAMES_B);
  const [draft, setDraft] = useState<DraftState>({ ...INITIAL_DRAFT });
  const [activeTeam, setActiveTeam] = useState<"A" | "B">("A");

  const isBanRound = draft.round === 1 || draft.round === 2 || draft.round === 5;
  const roundInfo = ROUND_ACTIONS[draft.round];
  const draftComplete = draft.round > 6;

  const myBanned = useCallback(
    (team: "A" | "B") => bannedForTeam(draft, team),
    [draft.bansTeamA, draft.bansTeamB]
  );

  const isUnavailable = useCallback(
    (champId: string) => {
      const c = champId.toLowerCase();
      if (isBanRound) {
        const bannedA = bannedForTeam(draft, "A");
        const bannedB = bannedForTeam(draft, "B");
        const allBanned = [...new Set([...bannedA, ...bannedB])];
        if (allBanned.includes(c)) return true;
      } else {
        if (bannedForTeam(draft, activeTeam).includes(c)) return true;
      }
      if (draft.picksTeamA.some((p) => p === c)) return true;
      if (draft.picksTeamB.some((p) => p === c)) return true;
      return false;
    },
    [draft, isBanRound, activeTeam]
  );

  const currentSelection = activeTeam === "A" ? draft.selectionTeamA : draft.selectionTeamB;
  const currentLocked = activeTeam === "A"
    ? draft.lockInTeamA[roundInfo?.slotA ?? 0]
    : draft.lockInTeamB[roundInfo?.slotB ?? 0];

  const handleSelect = (champId: string) => {
    if (draftComplete || !roundInfo) return;
    const c = champId.toLowerCase();
    if (isUnavailable(c)) return;
    if (currentLocked) return;

    setDraft((prev) => ({
      ...prev,
      ...(activeTeam === "A" ? { selectionTeamA: c } : { selectionTeamB: c }),
    }));
  };

  const handleLockIn = () => {
    if (draftComplete || !roundInfo) return;
    const sel = activeTeam === "A" ? draft.selectionTeamA : draft.selectionTeamB;
    if (!sel) return;

    setDraft((prev) => {
      const next = { ...prev };
      if (activeTeam === "A") {
        next.lockInTeamA = [...prev.lockInTeamA];
        next.lockInTeamA[roundInfo.slotA] = true;
      } else {
        next.lockInTeamB = [...prev.lockInTeamB];
        next.lockInTeamB[roundInfo.slotB] = true;
      }
      return next;
    });

    if (activeTeam === "A") {
      setActiveTeam("B");
    } else {
      commitRound();
    }
  };

  const commitRound = () => {
    setDraft((prev) => {
      const next = {
        ...prev,
        bansTeamA: [...prev.bansTeamA],
        bansTeamB: [...prev.bansTeamB],
        picksTeamA: [...prev.picksTeamA],
        picksTeamB: [...prev.picksTeamB],
      };

      if (roundInfo.type === "global_ban" || roundInfo.type === "ban") {
        if (prev.selectionTeamA) next.bansTeamA[roundInfo.slotA] = prev.selectionTeamA;
        if (prev.selectionTeamB) next.bansTeamB[roundInfo.slotB] = prev.selectionTeamB;
      } else {
        if (prev.selectionTeamA) next.picksTeamA[roundInfo.slotA] = prev.selectionTeamA;
        if (prev.selectionTeamB) next.picksTeamB[roundInfo.slotB] = prev.selectionTeamB;
      }

      next.round = prev.round + 1;
      next.lockInTeamA = [false, false, false];
      next.lockInTeamB = [false, false, false];
      next.selectionTeamA = null;
      next.selectionTeamB = null;

      return next;
    });
    setActiveTeam("A");
  };

  const handleStart = () => {
    setDraft({ ...INITIAL_DRAFT });
    setActiveTeam("A");
    setPhase("draft");
  };

  const handleReset = () => {
    setDraft({ ...INITIAL_DRAFT });
    setActiveTeam("A");
    setPhase("setup");
  };

  useEffect(() => {
    if (draft.round > 6 && phase === "draft") setPhase("done");
  }, [draft.round, phase]);

  const isChampBannedForActive = (id: string) => myBanned(activeTeam).includes(id.toLowerCase());

  const pickSlots = [
    { round: 3, slot: 0 },
    { round: 4, slot: 1 },
    { round: 6, slot: 2 },
  ];
  const banSlots = [
    { round: 1, slot: 0, global: true },
    { round: 2, slot: 1, global: false },
    { round: 5, slot: 2, global: false },
  ];

  if (phase === "setup") {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-10">
        <Link href="/tools" className="text-sm text-neutral-500 hover:text-cyan-300 transition-colors mb-4 inline-block">&larr; Back to Tools</Link>
        <h1 className="text-3xl font-bold text-white mb-2">Battlerite Draft Simulator</h1>
        <p className="text-neutral-400 mb-8">Practice the 6-round ban/pick draft offline. Enter player names for both teams, then start.</p>
        <div className="grid sm:grid-cols-2 gap-6 mb-8">
          <div>
            <h2 className="text-sm font-bold text-cyan-300 uppercase tracking-wider mb-3">Team 1</h2>
            <div className="space-y-2">
              {namesA.map((n, i) => (
                <input
                  key={i}
                  type="text"
                  value={n}
                  onChange={(e) => { const a = [...namesA]; a[i] = e.target.value; setNamesA(a); }}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-cyan-500/50"
                  placeholder={`Player ${i + 1}`}
                />
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-sm font-bold text-rose-300 uppercase tracking-wider mb-3">Team 2</h2>
            <div className="space-y-2">
              {namesB.map((n, i) => (
                <input
                  key={i}
                  type="text"
                  value={n}
                  onChange={(e) => { const b = [...namesB]; b[i] = e.target.value; setNamesB(b); }}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-rose-500/50"
                  placeholder={`Player ${i + 4}`}
                />
              ))}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleStart}
          className="px-8 py-3 rounded-xl text-base font-bold text-white bg-cyan-600 hover:bg-cyan-500 transition-colors shadow-lg shadow-cyan-900/30"
        >
          Start Draft
        </button>
      </div>
    );
  }

  const ChampButton = ({ id, disabled, selected, banned }: { id: string; disabled: boolean; selected: boolean; banned: boolean }) => (
    <button
      type="button"
      onClick={() => handleSelect(id)}
      disabled={disabled || currentLocked}
      className={`draft-champion-button ${selected ? "is-selected" : ""} ${banned ? "is-banned" : ""} ${isBanRound ? "is-ban-round" : ""}`}
    >
      <Image src={championImagePath(id)} alt={championDisplayName(id)} fill sizes="60px" className={`object-cover object-center ${banned ? "opacity-50" : ""}`} unoptimized />
      {banned && (
        <span className="absolute inset-0 z-10 flex items-center justify-center bg-red-950/80">
          <span className="text-xs font-bold uppercase tracking-widest text-red-300/95">Banned</span>
        </span>
      )}
    </button>
  );

  const TeamPanel = ({ names, picks, teamBans, side }: { names: string[]; picks: (string | null)[]; teamBans: (string | null)[]; side: "left" | "right" }) => {
    const isActiveTeamSide = (side === "left" && activeTeam === "A") || (side === "right" && activeTeam === "B");
    const lockArr = side === "left" ? draft.lockInTeamA : draft.lockInTeamB;
    const sel = side === "left" ? draft.selectionTeamA : draft.selectionTeamB;
    return (
      <div className="draft-team-sidebar flex-1 min-h-0">
        <div className={`px-3 lg:px-5 py-2.5 lg:py-3.5 ${side === "left" ? "bg-cyan-500/8" : "bg-rose-500/8"}`}>
          <span className={`text-base lg:text-xl font-bold tracking-widest uppercase ${side === "left" ? "text-cyan-300" : "text-rose-300"}`}>
            {side === "left" ? "Team 1" : "Team 2"}
          </span>
        </div>
        <div className="draft-team-sidebar-inner flex flex-col flex-1 p-2 lg:p-3 gap-1.5 lg:gap-2 min-h-0">
          {pickSlots.map(({ round, slot }) => {
            const picked = picks[slot];
            const isActiveSlot = draft.round === round;
            const isLocked = lockArr[slot];
            const activeClass = isActiveSlot ? (isBanRound ? "is-active-ban" : "is-active-pick") : "";
            return (
              <div key={round} className={`draft-pick-row ${activeClass} ${isLocked && isActiveSlot ? "is-locked" : ""}`}>
                <div className="draft-pick-portrait flex items-center justify-center relative">
                  {picked ? (
                    <Image src={championImagePath(picked)} alt="" fill sizes="160px" className="object-cover object-center" unoptimized />
                  ) : isActiveSlot && isActiveTeamSide && sel ? (
                    <Image src={championImagePath(sel)} alt="" fill sizes="160px" className="object-cover object-center opacity-50" unoptimized />
                  ) : (
                    <Image src="/images/placeholder.png" alt="" fill sizes="160px" className="object-cover object-center" unoptimized />
                  )}
                  <span className="absolute top-0 left-0 right-0 py-1.5 lg:py-2 px-2 lg:px-2.5 bg-gradient-to-b from-black/85 to-transparent z-10 text-left">
                    <span className="text-lg lg:text-2xl font-bold text-white drop-shadow-md truncate block leading-tight">
                      {names[slot] || "—"}
                    </span>
                  </span>
                  {isActiveSlot && !picked && isActiveTeamSide && !isLocked && (
                    <span className={`absolute bottom-1 right-1 w-2 h-2 rounded-full z-10 ${isBanRound ? "bg-red-400" : "bg-cyan-400"}`} />
                  )}
                  {isLocked && isActiveSlot && (
                    <span className="draft-locked-badge">
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      Locked
                    </span>
                  )}
                </div>
                <div className={`flex items-center min-w-0 ${side === "right" ? "justify-start" : "justify-end"}`}>
                  <p className="text-[11px] lg:text-sm font-semibold text-slate-500 uppercase tracking-wider">R{round}</p>
                </div>
              </div>
            );
          })}
          <div className="mt-auto pt-1.5 lg:pt-3">
            <p className="text-xs lg:text-sm uppercase tracking-widest text-slate-500 mb-1 lg:mb-1.5 font-semibold">Bans</p>
            <div className="grid grid-cols-3 gap-1.5">
              {banSlots.map(({ round, slot, global: isGlobal }) => {
                const banned = teamBans[slot];
                const isActiveBan = draft.round === round;
                const pending = isActiveBan && isActiveTeamSide ? sel : null;
                const show = banned ?? pending;
                return (
                  <div key={round} className="flex flex-col items-center gap-0.5">
                    <div className={`draft-ban-thumbnail ${isActiveBan ? "draft-ban-thumbnail--active" : ""}`}>
                      {show ? (
                        <>
                          <Image src={championImagePath(show)} alt="" fill sizes="120px" className="object-cover object-center opacity-90" unoptimized />
                          <span className="absolute inset-0 z-10 flex items-center justify-center bg-red-950/70">
                            <span className="text-[10px] lg:text-xs font-bold uppercase tracking-widest text-red-300">Banned</span>
                          </span>
                        </>
                      ) : (
                        <span className="text-red-400/40 text-lg">✕</span>
                      )}
                      {isGlobal && (
                        <span className="absolute top-0 left-0 right-0 z-20 flex items-center justify-center">
                          <span className="px-1.5 py-px text-[8px] lg:text-[10px] font-bold uppercase tracking-widest text-amber-200/90 bg-black/70 backdrop-blur-sm rounded-b border-b border-l border-r border-amber-400/30">
                            Global
                          </span>
                        </span>
                      )}
                    </div>
                    <span className="draft-ban-round-label">R{round}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="draft-screen">
      {/* Header bar */}
      <div className="shrink-0 flex items-center justify-between px-4 lg:px-8 py-2 lg:py-3 bg-slate-900/60 backdrop-blur-sm">
        <div className="flex items-center gap-3 lg:gap-4">
          <div className={`w-2.5 lg:w-3 h-2.5 lg:h-3 rounded-full ${isBanRound ? "bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.6)]" : "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"}`} />
          <h1 className={`text-lg md:text-2xl lg:text-3xl font-extrabold tracking-wide drop-shadow-sm ${isBanRound ? "text-red-100" : "text-white"}`}>
            {draftComplete ? "Draft Complete" : ROUND_LABELS[draft.round]}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-sm font-bold px-3 py-1 rounded-full border ${activeTeam === "A" ? "bg-cyan-500/15 text-cyan-200 border-cyan-500/40" : "bg-rose-500/15 text-rose-200 border-rose-500/40"}`}>
            {activeTeam === "A" ? "Team 1's turn" : "Team 2's turn"}
          </span>
          <button type="button" onClick={handleReset} className="text-sm text-neutral-400 hover:text-white transition-colors">
            Reset
          </button>
        </div>
      </div>

      {/* Main layout */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 p-2 lg:p-3 gap-2 lg:gap-3 overflow-y-auto lg:overflow-hidden">
        <div className="w-full lg:w-[clamp(11rem,19vw,26rem)] shrink-0 flex flex-col min-h-0">
          <TeamPanel names={namesA} picks={draft.picksTeamA} teamBans={draft.bansTeamA} side="left" />
        </div>

        <div className="flex-1 flex flex-col min-h-0 min-w-0 items-center order-first lg:order-none">
          <div className={`flex-1 flex flex-col min-h-0 w-full max-w-5xl rounded-xl overflow-hidden border ${isBanRound ? "bg-red-950/20 border-red-800/30" : "bg-slate-800/40 border-slate-600/30"}`}>
            <div className={`shrink-0 flex items-center gap-3 px-3 lg:px-4 py-2 lg:py-3 ${isBanRound ? "bg-red-900/20" : "bg-slate-700/30"}`}>
              <div className={`h-px flex-1 bg-gradient-to-r from-transparent ${isBanRound ? "via-red-500/40" : "via-cyan-500/40"} to-transparent`} />
              <h2 className={`text-sm lg:text-base font-bold tracking-[0.2em] uppercase drop-shadow-sm ${isBanRound ? "text-red-300" : "text-cyan-200"}`}>
                {draftComplete ? "Draft Complete" : isBanRound ? "Ban a Champion" : "Select a Champion"}
              </h2>
              <div className={`h-px flex-1 bg-gradient-to-r from-transparent ${isBanRound ? "via-red-500/40" : "via-cyan-500/40"} to-transparent`} />
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-2 lg:p-4 flex flex-col items-center">
              <div className="flex flex-col gap-4 lg:gap-6 w-full max-w-4xl min-w-0">
                <div className="flex flex-col gap-2 lg:gap-3 w-full min-w-0 shrink-0">
                  <p className="draft-category-title">Melee</p>
                  <div className="draft-champion-row">
                    {BATTLERITE_MELEE.map((id) => (
                      <ChampButton key={id} id={id} disabled={draftComplete || isUnavailable(id)} selected={currentSelection === id} banned={isChampBannedForActive(id)} />
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2 lg:gap-3 w-full min-w-0 shrink-0">
                  <p className="draft-category-title">Ranged</p>
                  <div className="draft-champion-row">
                    {BATTLERITE_RANGED.map((id) => (
                      <ChampButton key={id} id={id} disabled={draftComplete || isUnavailable(id)} selected={currentSelection === id} banned={isChampBannedForActive(id)} />
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2 lg:gap-3 w-full min-w-0 shrink-0">
                  <p className="draft-category-title">Support</p>
                  <div className="draft-champion-row">
                    {BATTLERITE_SUPPORT.map((id) => (
                      <ChampButton key={id} id={id} disabled={draftComplete || isUnavailable(id)} selected={currentSelection === id} banned={isChampBannedForActive(id)} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={`shrink-0 mt-2 lg:mt-3 w-full max-w-5xl flex items-center justify-center gap-3 p-2.5 lg:p-3 rounded-xl border ${isBanRound ? "bg-red-950/30 border-red-800/30" : "bg-slate-800/50 border-slate-600/30"}`}>
            {draftComplete ? (
              <button type="button" onClick={handleReset} className="draft-action-button draft-action-button--primary">
                New Draft
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLockIn}
                disabled={!currentSelection || currentLocked}
                className={`draft-action-button ${isBanRound ? "draft-action-button--ban" : "draft-action-button--lock"}`}
              >
                {isBanRound ? "Lock in Ban" : "Lock in Pick"}
              </button>
            )}
          </div>
        </div>

        <div className="w-full lg:w-[clamp(11rem,19vw,26rem)] shrink-0 flex flex-col min-h-0">
          <TeamPanel names={namesB} picks={draft.picksTeamB} teamBans={draft.bansTeamB} side="right" />
        </div>
      </div>
    </div>
  );
}
