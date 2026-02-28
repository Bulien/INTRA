import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { applyDraftTimeoutIfNeeded, allBannedChamps, bannedForTeam, type DraftState } from "@/lib/draftTimeout";

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

const VALID_CHAMPIONS = new Set([
  "bakko", "croak", "freya", "jamila", "raigon", "rook", "ruhkaan", "shifu", "thorn",
  "alysia", "ashka", "destiny", "ezmo", "iva", "jade", "jumong", "shenrao", "taya", "varesh",
  "blossom", "lucie", "oldur", "pearl", "pestilus", "poloma", "sirius", "ulric", "zander",
]);

function normalizeChamp(id: string): string {
  return id.trim().toLowerCase();
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { id: gameId } = await params;
  const game = await prisma.teamBuilderGame.findUnique({ where: { id: gameId } });
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  if (game.gameType !== "battlerite") {
    return NextResponse.json({ error: "Draft only available for Battlerite games" }, { status: 400 });
  }

  let draft = game.draftState as DraftState | null;
  if (!draft || draft.phase !== "draft") {
    return NextResponse.json({ error: "Draft not active" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action === "goToMatch" ? "goToMatch" : body.action === "lockIn" ? "lockIn" : body.action === "select" ? "select" : null;

  if (action === "goToMatch" && draft.round > 6) {
    const updated: DraftState = { ...draft, phase: "game" };
    await prisma.teamBuilderGame.update({
      where: { id: gameId },
      data: { draftState: updated as object },
    });
    return NextResponse.json({ draftState: updated });
  }

  const afterTimeout = applyDraftTimeoutIfNeeded(draft);
  if (afterTimeout) {
    await prisma.teamBuilderGame.update({
      where: { id: gameId },
      data: { draftState: afterTimeout as object },
    });
    return NextResponse.json({ draftState: afterTimeout });
  }

  const teamA = JSON.parse(game.teamA) as { id: string; name: string }[];
  const teamB = JSON.parse(game.teamB) as { id: string; name: string }[];
  const userId = session.user.id;

  let myTeam: "A" | "B" | null = null;
  let mySlot = -1;
  for (let i = 0; i < teamA.length; i++) {
    if (teamA[i].id === userId) {
      myTeam = "A";
      mySlot = i;
      break;
    }
  }
  if (myTeam === null) {
    for (let i = 0; i < teamB.length; i++) {
      if (teamB[i].id === userId) {
        myTeam = "B";
        mySlot = i;
        break;
      }
    }
  }
  if (myTeam === null) {
    return NextResponse.json({ error: "You are not in this game" }, { status: 403 });
  }

  const roundInfo = ROUND_ACTIONS[draft.round];
  if (!roundInfo) {
    return NextResponse.json({ error: "Invalid round" }, { status: 400 });
  }

  const isMyTurn =
    (myTeam === "A" && mySlot === roundInfo.slotA) || (myTeam === "B" && mySlot === roundInfo.slotB);
  if (!isMyTurn) {
    return NextResponse.json({ error: "Not your turn this round" }, { status: 403 });
  }

  const champion = typeof body.champion === "string" ? normalizeChamp(body.champion) : null;

  if (action === "select") {
    if (!champion || !VALID_CHAMPIONS.has(champion)) {
      return NextResponse.json({ error: "Invalid champion" }, { status: 400 });
    }
    const picksA = Array.isArray(draft.picksTeamA) ? [...draft.picksTeamA] : [];
    const picksB = Array.isArray(draft.picksTeamB) ? [...draft.picksTeamB] : [];
    if (roundInfo.type === "global_ban" || roundInfo.type === "ban") {
      const allBanned = allBannedChamps(draft);
      if (allBanned.includes(champion)) {
        return NextResponse.json({ error: "Champion already banned" }, { status: 400 });
      }
    } else {
      const myBanned = bannedForTeam(draft, myTeam);
      if (myBanned.includes(champion) || picksA.includes(champion) || picksB.includes(champion)) {
        return NextResponse.json({ error: "Champion not available" }, { status: 400 });
      }
    }
  }

  const EMPTY3: (string | null)[] = [null, null, null];
  const ensureArr = (a: unknown) => (Array.isArray(a) ? [...a] : [...EMPTY3]);

  const updated: DraftState = {
    ...draft,
    bansTeamA: ensureArr(draft.bansTeamA),
    bansTeamB: ensureArr(draft.bansTeamB),
    picksTeamA: ensureArr(draft.picksTeamA),
    picksTeamB: ensureArr(draft.picksTeamB),
    lockInTeamA: Array.isArray(draft.lockInTeamA) ? [...draft.lockInTeamA] : [false, false, false],
    lockInTeamB: Array.isArray(draft.lockInTeamB) ? [...draft.lockInTeamB] : [false, false, false],
  };

  if (action === "select" && champion) {
    if (myTeam === "A") updated.selectionTeamA = champion;
    else updated.selectionTeamB = champion;
  } else if (action === "lockIn") {
    const mySelection = myTeam === "A" ? updated.selectionTeamA : updated.selectionTeamB;
    if (!mySelection) {
      return NextResponse.json({ error: "Select a champion before locking in" }, { status: 400 });
    }
    if (myTeam === "A") {
      updated.lockInTeamA[mySlot] = true;
    } else {
      updated.lockInTeamB[mySlot] = true;
    }
  } else {
    return NextResponse.json({ error: "Missing action: select or lockIn" }, { status: 400 });
  }

  const bothLocked =
    updated.lockInTeamA[roundInfo.slotA] && updated.lockInTeamB[roundInfo.slotB];

  if (bothLocked) {
    if (roundInfo.type === "global_ban" || roundInfo.type === "ban") {
      updated.bansTeamA[roundInfo.slotA] = updated.selectionTeamA;
      updated.bansTeamB[roundInfo.slotB] = updated.selectionTeamB;
      console.log("[DRAFT] Bans committed:", { round: draft.round, bansTeamA: updated.bansTeamA, bansTeamB: updated.bansTeamB });
    } else {
      updated.picksTeamA[roundInfo.slotA] = updated.selectionTeamA;
      updated.picksTeamB[roundInfo.slotB] = updated.selectionTeamB;
    }
    updated.round += 1;
    updated.lockInTeamA = [false, false, false];
    updated.lockInTeamB = [false, false, false];
    updated.selectionTeamA = null;
    updated.selectionTeamB = null;
    if (updated.round <= 6) {
      updated.roundEndsAt = new Date(Date.now() + 30 * 1000).toISOString();
    }
  }

  await prisma.teamBuilderGame.update({
    where: { id: gameId },
    data: { draftState: updated as object },
  });

  return NextResponse.json({ draftState: updated });
}
