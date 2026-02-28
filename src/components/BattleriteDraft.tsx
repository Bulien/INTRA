"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  BATTLERITE_MELEE,
  BATTLERITE_RANGED,
  BATTLERITE_SUPPORT,
  championImagePath,
  championDisplayName,
} from "@/lib/battleriteChampions";

export type DraftState = {
  phase: "accept" | "draft" | "game";
  round: number;
  roundEndsAt?: string;
  acceptDeadline?: string;
  acceptedUserIds?: string[];
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
  1: "Round 1: Global ban",
  2: "Round 2: Ban",
  3: "Round 3: Pick",
  4: "Round 4: Pick",
  5: "Round 5: Ban",
  6: "Round 6: Pick",
};

const ROUND_SLOTS: Record<number, { slotA: number; slotB: number }> = {
  1: { slotA: 0, slotB: 0 },
  2: { slotA: 1, slotB: 1 },
  3: { slotA: 0, slotB: 0 },
  4: { slotA: 1, slotB: 1 },
  5: { slotA: 2, slotB: 2 },
  6: { slotA: 2, slotB: 2 },
};

function RoundTimer({ secondsLeft, totalSeconds }: { secondsLeft: number; totalSeconds: number }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, secondsLeft / totalSeconds);
  const strokeDashoffset = circumference * (1 - progress);
  const isLow = secondsLeft <= 5;
  return (
    <div className="inline-flex items-center justify-center w-12 h-12 shrink-0">
      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 52 52">
        <circle
          cx="26"
          cy="26"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={4}
          className="text-slate-600/50"
        />
        <circle
          cx="26"
          cy="26"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={`transition-[stroke-dashoffset] duration-1000 ease-linear ${isLow ? "text-red-400" : "text-cyan-400"}`}
        />
      </svg>
    </div>
  );
}

type BattleriteDraftProps = {
  gameId: string;
  teamA: { id: string; name: string; rating: number }[];
  teamB: { id: string; name: string; rating: number }[];
  draftState: DraftState;
  currentUserId: string;
  onUpdate: (partial?: { draftState: DraftState }) => void;
};

export function BattleriteDraft({
  gameId,
  teamA,
  teamB,
  draftState,
  currentUserId,
  onUpdate,
}: BattleriteDraftProps) {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [progressPercent, setProgressPercent] = useState(100);
  const [selecting, setSelecting] = useState(false);
  const [locking, setLocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mySlotA = teamA.findIndex((p) => p.id === currentUserId);
  const mySlotB = teamB.findIndex((p) => p.id === currentUserId);
  const isTeamA = mySlotA >= 0;
  const mySlot = isTeamA ? mySlotA : mySlotB;
  const roundInfo = ROUND_SLOTS[draftState.round];
  const isMyTurn =
    roundInfo &&
    ((isTeamA && roundInfo.slotA === mySlot) || (!isTeamA && roundInfo.slotB === mySlot));

  const ROUND_DURATION_SEC = 30;
  useEffect(() => {
    if (!draftState.roundEndsAt) return;
    const end = new Date(draftState.roundEndsAt).getTime();
    const tick = () => {
      const remaining = Math.max(0, (end - Date.now()) / 1000);
      setSecondsLeft(Math.ceil(remaining));
      setProgressPercent(Math.max(0, Math.min(100, (remaining / ROUND_DURATION_SEC) * 100)));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [draftState.roundEndsAt, draftState.round]);

  const bansA = draftState.bansTeamA ?? [null, null, null];
  const bansB = draftState.bansTeamB ?? [null, null, null];

  const myBannedNames: string[] = (() => {
    const result: string[] = [];
    // Slot 0 = Round 1 global ban — blocks everyone
    if (bansA[0]) result.push(bansA[0]);
    if (bansB[0]) result.push(bansB[0]);
    // Normal bans: enemy team's bans block me
    if (isTeamA) {
      if (bansB[1]) result.push(bansB[1]);
      if (bansB[2]) result.push(bansB[2]);
    } else {
      if (bansA[1]) result.push(bansA[1]);
      if (bansA[2]) result.push(bansA[2]);
    }
    return result;
  })();

  const allBannedOrPicked = useCallback(
    (champId: string) => {
      const c = champId.toLowerCase();
      const currentRoundIsBan = draftState.round === 1 || draftState.round === 2 || draftState.round === 5;
      if (currentRoundIsBan) {
        const bA = draftState.bansTeamA ?? [null, null, null];
        const bB = draftState.bansTeamB ?? [null, null, null];
        const allBans = [...new Set([...bA, ...bB].filter(Boolean) as string[])];
        if (allBans.includes(c)) return true;
      } else {
        if (myBannedNames.includes(c)) return true;
      }
      const picksA = draftState.picksTeamA ?? [];
      const picksB = draftState.picksTeamB ?? [];
      if (picksA.some((p) => p === c)) return true;
      if (picksB.some((p) => p === c)) return true;
      return false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draftState.bansTeamA, draftState.bansTeamB, draftState.picksTeamA, draftState.picksTeamB, draftState.round, isTeamA]
  );

  const mySelection = isTeamA ? draftState.selectionTeamA : draftState.selectionTeamB;
  const lockInA = draftState.lockInTeamA ?? [false, false, false];
  const lockInB = draftState.lockInTeamB ?? [false, false, false];
  const myLocked = mySlot >= 0 && (isTeamA ? lockInA[mySlot] : lockInB[mySlot]);

  const handleSelect = async (champId: string) => {
    if (!isMyTurn || selecting) return;
    const c = champId.toLowerCase();
    if (allBannedOrPicked(c)) return;
    setError(null);
    setSelecting(true);
    try {
      const res = await fetch(`/api/team-builder/games/${gameId}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "select", champion: c }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to select");
        return;
      }
      onUpdate();
    } finally {
      setSelecting(false);
    }
  };

  const handleLockIn = async () => {
    if (!isMyTurn || locking || !mySelection) return;
    setError(null);
    setLocking(true);
    try {
      const res = await fetch(`/api/team-builder/games/${gameId}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "lockIn" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to lock in");
        return;
      }
      if (data.draftState) onUpdate({ draftState: data.draftState });
      else onUpdate();
    } finally {
      setLocking(false);
    }
  };

  const draftComplete = draftState.round > 6;
  const [goingToMatch, setGoingToMatch] = useState(false);
  const handleGoToMatch = async () => {
    if (!draftComplete || goingToMatch) return;
    setError(null);
    setGoingToMatch(true);
    try {
      const res = await fetch(`/api/team-builder/games/${gameId}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "goToMatch" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Failed to proceed");
        return;
      }
      onUpdate();
    } finally {
      setGoingToMatch(false);
    }
  };

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

  const isBanRound = draftState.round === 1 || draftState.round === 2 || draftState.round === 5;

  const ChampButton = ({
    id,
    disabled,
    selected,
    banned,
  }: {
    id: string;
    disabled: boolean;
    selected: boolean;
    banned: boolean;
  }) => (
    <button
      type="button"
      onClick={() => handleSelect(id)}
      disabled={disabled || selecting || (isMyTurn && myLocked)}
      className={`draft-champion-button ${selected ? "is-selected" : ""} ${banned ? "is-banned" : ""} ${isBanRound ? "is-ban-round" : ""}`}
    >
      <Image
        src={championImagePath(id)}
        alt={championDisplayName(id)}
        fill
        sizes="60px"
        className={`object-cover object-center ${banned ? "opacity-50" : ""}`}
        unoptimized
      />
      {banned && (
        <span className="absolute inset-0 z-10 flex items-center justify-center bg-red-950/80">
          <span className="text-xs font-bold uppercase tracking-widest text-red-300/95">Banned</span>
        </span>
      )}
    </button>
  );

  const TeamPanel = ({
    team,
    picks,
    teamBans,
    selection,
    side,
    lockInTeamA: lockA,
    lockInTeamB: lockB,
    isBan,
  }: {
    team: { id: string; name: string; rating: number }[];
    picks: (string | null)[];
    teamBans: (string | null)[];
    selection: string | null;
    side: "left" | "right";
    lockInTeamA: boolean[];
    lockInTeamB: boolean[];
    isBan: boolean;
  }) => (
    <div className="draft-team-sidebar flex-1 min-h-0">
      <div className={`px-3 lg:px-5 py-2.5 lg:py-3.5 ${side === "left" ? "bg-cyan-500/8" : "bg-rose-500/8"}`}>
        <span className={`text-base lg:text-xl font-bold tracking-widest uppercase ${side === "left" ? "text-cyan-300" : "text-rose-300"}`}>
          {side === "left" ? "Team 1" : "Team 2"}
        </span>
      </div>

      <div className="draft-team-sidebar-inner flex flex-col flex-1 p-2 lg:p-3 gap-1.5 lg:gap-2 min-h-0">
        {pickSlots.map(({ round, slot }) => {
          const picked = picks[slot];
          const isActiveSlot = draftState.round === round;
          const isLocked = side === "left" ? lockA[slot] : lockB[slot];
          const activeClass = isActiveSlot
            ? isBan ? "is-active-ban" : "is-active-pick"
            : "";
          return (
            <div key={round} className={`draft-pick-row ${activeClass} ${isLocked && isActiveSlot ? "is-locked" : ""}`}>
              <div className="draft-pick-portrait flex items-center justify-center relative">
                {picked ? (
                  <Image src={championImagePath(picked)} alt="" fill sizes="160px" className="object-cover object-center" unoptimized />
                ) : isActiveSlot && selection ? (
                  <Image src={championImagePath(selection)} alt="" fill sizes="160px" className="object-cover object-center opacity-50" unoptimized />
                ) : (
                  <Image src="/images/placeholder.png" alt="" fill sizes="160px" className="object-cover object-center" unoptimized />
                )}
                <span className="absolute top-0 left-0 right-0 py-1.5 lg:py-2 px-2 lg:px-2.5 bg-gradient-to-b from-black/85 to-transparent z-10 text-left">
                  <span className="text-lg lg:text-2xl font-bold text-white drop-shadow-md truncate block leading-tight">
                    {team[slot]?.name ?? "—"}
                  </span>
                </span>
                {isActiveSlot && !picked && !isLocked && (
                  <span className={`absolute bottom-1 right-1 w-2 h-2 rounded-full z-10 ${isBan ? "bg-red-400" : "bg-cyan-400"}`} />
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
              const isActiveBan = draftState.round === round;
              const pending = isActiveBan ? selection : null;
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

  const isChampBanned = (id: string) => myBannedNames.includes(id.toLowerCase());

  const timerBarColor = isBanRound
    ? { base: "#ef4444", glow: "rgba(239,68,68,0.6), 0 0 24px rgba(239,68,68,0.3)" }
    : { base: "#06b6d4", glow: "rgba(6,182,212,0.6), 0 0 24px rgba(6,182,212,0.3)" };

  return (
    <div className="draft-screen">
      {/* Header bar */}
      <div className="shrink-0 flex items-center justify-between px-4 lg:px-8 py-2 lg:py-3 bg-slate-900/60 backdrop-blur-sm">
        <div className="flex items-center gap-3 lg:gap-4">
          <div className={`w-2.5 lg:w-3 h-2.5 lg:h-3 rounded-full ${isBanRound ? "bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.6)]" : "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"}`} />
          <h1 className={`text-lg md:text-2xl lg:text-3xl font-extrabold tracking-wide drop-shadow-sm ${isBanRound ? "text-red-100" : "text-white"}`}>
            {draftState.round <= 6 ? ROUND_LABELS[draftState.round] : "Draft Complete"}
          </h1>
        </div>
      </div>

      {/* Main layout — stacks on small screens, 3 columns on lg+ */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 p-2 lg:p-3 gap-2 lg:gap-3 overflow-y-auto lg:overflow-hidden">
        {/* Left: Team 1 */}
        <div className="w-full lg:w-[clamp(11rem,19vw,26rem)] shrink-0 flex flex-col min-h-0">
          <TeamPanel team={teamA} picks={draftState.picksTeamA} teamBans={draftState.bansTeamA ?? [null, null, null]} selection={isTeamA ? draftState.selectionTeamA : null} side="left" lockInTeamA={draftState.lockInTeamA} lockInTeamB={draftState.lockInTeamB} isBan={isBanRound} />
        </div>

        {/* Center: Champion Selection */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 items-center order-first lg:order-none">
          <div className={`flex-1 flex flex-col min-h-0 w-full max-w-5xl rounded-xl overflow-hidden border ${isBanRound ? "bg-red-950/20 border-red-800/30" : "bg-slate-800/40 border-slate-600/30"}`}>
            {draftState.round <= 6 && draftState.roundEndsAt && (
              <div className="shrink-0 w-full">
                <div className="draft-timer-track h-2 lg:h-2.5 w-full bg-slate-700/80 overflow-hidden rounded-full">
                  <div
                    className="draft-timer-fill h-full rounded-full"
                    style={{
                      width: `${progressPercent}%`,
                      backgroundColor: progressPercent > 20 ? timerBarColor.base : progressPercent > 10 ? "#f59e0b" : "#ef4444",
                      boxShadow: progressPercent > 20
                        ? `0 0 12px ${timerBarColor.glow}`
                        : progressPercent > 10
                          ? "0 0 12px rgba(245, 158, 11, 0.6), 0 0 24px rgba(245, 158, 11, 0.3)"
                          : "0 0 12px rgba(239, 68, 68, 0.6), 0 0 24px rgba(239, 68, 68, 0.3)",
                    }}
                  />
                </div>
                <p className="text-right text-xs text-slate-500 mt-0.5 pr-2 tabular-nums">{secondsLeft}s</p>
              </div>
            )}
            <div className={`shrink-0 flex items-center gap-3 px-3 lg:px-4 py-2 lg:py-3 ${isBanRound ? "bg-red-900/20" : "bg-slate-700/30"}`}>
              <div className={`h-px flex-1 bg-gradient-to-r from-transparent ${isBanRound ? "via-red-500/40" : "via-cyan-500/40"} to-transparent`} />
              <h2 className={`text-sm lg:text-base font-bold tracking-[0.2em] uppercase drop-shadow-sm ${isBanRound ? "text-red-300" : "text-cyan-200"}`}>
                {isBanRound ? "Ban a Champion" : "Select a Champion"}
              </h2>
              <div className={`h-px flex-1 bg-gradient-to-r from-transparent ${isBanRound ? "via-red-500/40" : "via-cyan-500/40"} to-transparent`} />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-2 lg:p-4 flex flex-col items-center">
              <div className="flex flex-col gap-4 lg:gap-6 w-full max-w-4xl min-w-0">
                <div className="flex flex-col gap-2 lg:gap-3 w-full min-w-0 shrink-0">
                  <p className="draft-category-title">Melee</p>
                  <div className="draft-champion-row">
                    {BATTLERITE_MELEE.map((id) => (
                      <ChampButton key={id} id={id} disabled={!isMyTurn || allBannedOrPicked(id)} selected={(isTeamA && draftState.selectionTeamA === id) || (!isTeamA && draftState.selectionTeamB === id)} banned={isChampBanned(id)} />
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2 lg:gap-3 w-full min-w-0 shrink-0">
                  <p className="draft-category-title">Ranged</p>
                  <div className="draft-champion-row">
                    {BATTLERITE_RANGED.map((id) => (
                      <ChampButton key={id} id={id} disabled={!isMyTurn || allBannedOrPicked(id)} selected={(isTeamA && draftState.selectionTeamA === id) || (!isTeamA && draftState.selectionTeamB === id)} banned={isChampBanned(id)} />
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2 lg:gap-3 w-full min-w-0 shrink-0">
                  <p className="draft-category-title">Support</p>
                  <div className="draft-champion-row">
                    {BATTLERITE_SUPPORT.map((id) => (
                      <ChampButton key={id} id={id} disabled={!isMyTurn || allBannedOrPicked(id)} selected={(isTeamA && draftState.selectionTeamA === id) || (!isTeamA && draftState.selectionTeamB === id)} banned={isChampBanned(id)} />
                    ))}
                  </div>
                </div>
              </div>
              {error && <p className="text-sm lg:text-base text-red-400 mt-2 shrink-0">{error}</p>}
            </div>
          </div>

          <div className={`shrink-0 mt-2 lg:mt-3 w-full max-w-5xl flex items-center justify-center gap-3 p-2.5 lg:p-3 rounded-xl border ${isBanRound ? "bg-red-950/30 border-red-800/30" : "bg-slate-800/50 border-slate-600/30"}`}>
            {draftComplete ? (
              <button
                type="button"
                onClick={handleGoToMatch}
                disabled={goingToMatch}
                className="draft-action-button draft-action-button--primary"
              >
                {goingToMatch ? "…" : "Go to match result"}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLockIn}
                disabled={!isMyTurn || !mySelection || myLocked || locking}
                className={`draft-action-button ${isBanRound ? "draft-action-button--ban" : "draft-action-button--lock"}`}
              >
                {myLocked ? "Locked in" : isBanRound ? "Lock in Ban" : "Lock in Pick"}
              </button>
            )}
          </div>
        </div>

        {/* Right: Team 2 */}
        <div className="w-full lg:w-[clamp(11rem,19vw,26rem)] shrink-0 flex flex-col min-h-0">
          <TeamPanel team={teamB} picks={draftState.picksTeamB} teamBans={draftState.bansTeamB ?? [null, null, null]} selection={!isTeamA ? draftState.selectionTeamB : null} side="right" lockInTeamA={draftState.lockInTeamA} lockInTeamB={draftState.lockInTeamB} isBan={isBanRound} />
        </div>
      </div>
    </div>
  );
}
