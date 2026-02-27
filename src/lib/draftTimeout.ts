/**
 * Applies draft timeout when roundEndsAt has passed.
 * Ban round → no bans added, advance round.
 * Pick round → random valid champion for each player who didn't lock in.
 */

import {
  BATTLERITE_MELEE,
  BATTLERITE_RANGED,
  BATTLERITE_SUPPORT,
} from "@/lib/battleriteChampions";

const MELEE = new Set(BATTLERITE_MELEE as unknown as string[]);
const RANGED = new Set(BATTLERITE_RANGED as unknown as string[]);
const SUPPORT = new Set(BATTLERITE_SUPPORT as unknown as string[]);
const ALL_CHAMPS = [
  ...BATTLERITE_MELEE,
  ...BATTLERITE_RANGED,
  ...BATTLERITE_SUPPORT,
] as string[];

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

const ROUND_ACTIONS: Record<
  number,
  { type: "global_ban" | "ban" | "pick"; slotA: number; slotB: number }
> = {
  1: { type: "global_ban", slotA: 0, slotB: 0 },
  2: { type: "ban", slotA: 1, slotB: 1 },
  3: { type: "pick", slotA: 0, slotB: 0 },
  4: { type: "pick", slotA: 1, slotB: 1 },
  5: { type: "ban", slotA: 2, slotB: 2 },
  6: { type: "pick", slotA: 2, slotB: 2 },
};

function getCategory(champId: string): "melee" | "ranged" | "support" {
  const c = champId.toLowerCase();
  if (MELEE.has(c)) return "melee";
  if (RANGED.has(c)) return "ranged";
  if (SUPPORT.has(c)) return "support";
  return "melee";
}

function categoriesOfPicks(picks: (string | null)[], excludeSlot: number): Set<"melee" | "ranged" | "support"> {
  const cats = new Set<"melee" | "ranged" | "support">();
  picks.forEach((p, i) => {
    if (i !== excludeSlot && p) cats.add(getCategory(p));
  });
  return cats;
}

/**
 * Returns champions that a specific team cannot pick.
 * - Global bans (slot 0 / Round 1): block both teams.
 * - Normal bans (slot 1 / Round 2, slot 2 / Round 5): only block the enemy team.
 */
export function bannedForTeam(draft: DraftState, team: "A" | "B"): string[] {
  const bansA = (draft.bansTeamA ?? [null, null, null]);
  const bansB = (draft.bansTeamB ?? [null, null, null]);
  const result: string[] = [];

  // Slot 0 = Round 1 global ban — blocks everyone
  if (bansA[0]) result.push(bansA[0]);
  if (bansB[0]) result.push(bansB[0]);

  if (team === "A") {
    // Team A is blocked by Team B's normal bans (slots 1, 2)
    if (bansB[1]) result.push(bansB[1]);
    if (bansB[2]) result.push(bansB[2]);
  } else {
    // Team B is blocked by Team A's normal bans (slots 1, 2)
    if (bansA[1]) result.push(bansA[1]);
    if (bansA[2]) result.push(bansA[2]);
  }

  return result;
}

/** All banned champions (union of both teams' banned-for lists). Used for ban selection validation. */
export function allBannedChamps(draft: DraftState): string[] {
  const set = new Set([...bannedForTeam(draft, "A"), ...bannedForTeam(draft, "B")]);
  return [...set];
}

function randomChampForSlot(
  draft: DraftState,
  team: "A" | "B",
  slot: number
): string {
  const banned = new Set(bannedForTeam(draft, team));
  const pickedA = new Set(draft.picksTeamA.filter(Boolean) as string[]);
  const pickedB = new Set(draft.picksTeamB.filter(Boolean) as string[]);
  const teamPicks = team === "A" ? draft.picksTeamA : draft.picksTeamB;
  const excludedCategories = categoriesOfPicks(teamPicks, slot);

  const available = ALL_CHAMPS.filter((c) => {
    if (banned.has(c) || pickedA.has(c) || pickedB.has(c)) return false;
    if (excludedCategories.has(getCategory(c))) return false;
    return true;
  });

  if (available.length === 0) {
    const fallback = ALL_CHAMPS.filter(
      (c) => !banned.has(c) && !pickedA.has(c) && !pickedB.has(c)
    );
    return fallback[Math.floor(Math.random() * fallback.length)] ?? ALL_CHAMPS[0];
  }
  return available[Math.floor(Math.random() * available.length)];
}

function advanceRound(state: DraftState): DraftState {
  const next: DraftState = {
    ...state,
    round: state.round + 1,
    bansTeamA: [...(state.bansTeamA ?? [null, null, null])],
    bansTeamB: [...(state.bansTeamB ?? [null, null, null])],
    lockInTeamA: [false, false, false],
    lockInTeamB: [false, false, false],
    selectionTeamA: null,
    selectionTeamB: null,
  };
  if (next.round <= 6) {
    next.roundEndsAt = new Date(Date.now() + 30 * 1000).toISOString();
  }
  return next;
}

/**
 * If roundEndsAt has passed, apply timeout and return new draft state; otherwise return null.
 */
export function applyDraftTimeoutIfNeeded(draft: DraftState | null): DraftState | null {
  if (!draft || draft.phase !== "draft" || draft.round > 6 || !draft.roundEndsAt) return null;
  const endsAt = new Date(draft.roundEndsAt).getTime();
  if (Date.now() <= endsAt) return null;

  const roundInfo = ROUND_ACTIONS[draft.round];
  if (!roundInfo) return null;

  let next: DraftState;

  if (roundInfo.type === "global_ban" || roundInfo.type === "ban") {
    next = { ...draft };
    next.bansTeamA = [...(draft.bansTeamA ?? [null, null, null])];
    next.bansTeamB = [...(draft.bansTeamB ?? [null, null, null])];

    if (draft.lockInTeamA[roundInfo.slotA] && draft.selectionTeamA) {
      next.bansTeamA[roundInfo.slotA] = draft.selectionTeamA;
    }
    if (draft.lockInTeamB[roundInfo.slotB] && draft.selectionTeamB) {
      next.bansTeamB[roundInfo.slotB] = draft.selectionTeamB;
    }

    next = advanceRound(next);
  } else {
    next = { ...draft };
    next.picksTeamA = [...draft.picksTeamA];
    next.picksTeamB = [...draft.picksTeamB];

    if (!draft.lockInTeamA[roundInfo.slotA]) {
      next.picksTeamA[roundInfo.slotA] = randomChampForSlot(next, "A", roundInfo.slotA);
    } else {
      next.picksTeamA[roundInfo.slotA] = draft.selectionTeamA;
    }
    if (!draft.lockInTeamB[roundInfo.slotB]) {
      next.picksTeamB[roundInfo.slotB] = randomChampForSlot(next, "B", roundInfo.slotB);
    } else {
      next.picksTeamB[roundInfo.slotB] = draft.selectionTeamB;
    }

    next = advanceRound(next);
  }

  return next;
}
