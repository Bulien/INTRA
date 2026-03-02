/**
 * Match-based Elo: everyone starts at 1000. Each game updates Elo using
 * expected score from (your Elo vs enemy team average). First game uses
 * a smaller K so it doesn't swing too much.
 */

const BASE_ELO = 1000;
const K_NORMAL = 32;
const K_FIRST_GAME = 16;

function normalizeName(s: string): string {
  return (s ?? "").trim().toLowerCase();
}

/** Expected score (0–1) for a player with eloPlayer against an opponent (or team) with eloOpponent. */
function expectedScore(eloPlayer: number, eloOpponent: number): number {
  return 1 / (1 + Math.pow(10, (eloOpponent - eloPlayer) / 400));
}

export type ReplayGame = {
  id: string;
  gameType: string;
  season: number;
  teamA: string[];
  teamB: string[];
  winner: "yin" | "yang" | null;
  createdAt: Date;
};

export type ReplayResult = {
  /** Final Elo per player (normalized name -> elo) */
  elos: Record<string, number>;
  /** Per-game deltas: gameId -> (player normalized name -> delta) */
  gameDeltas: Map<string, Record<string, number>>;
};

/**
 * Replay games in chronological order. Everyone starts at BASE_ELO.
 * For each game: team avg vs enemy team avg; each player's delta = K * (result - expected).
 * First game per player uses K_FIRST_GAME; later games use K_NORMAL.
 */
export function replayElo(games: ReplayGame[]): ReplayResult {
  const elos: Record<string, number> = {};
  const gameDeltas = new Map<string, Record<string, number>>();
  /** Games played (count) per player before current game */
  const gamesPlayedBefore: Record<string, number> = {};

  const getElo = (name: string): number => {
    const n = normalizeName(name);
    if (elos[n] == null) elos[n] = BASE_ELO;
    return elos[n];
  };

  const setElo = (name: string, value: number): void => {
    elos[normalizeName(name)] = value;
  };

  const sorted = [...games].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  for (const g of sorted) {
    if (g.winner !== "yin" && g.winner !== "yang") continue;

    const teamA = g.teamA.map((n) => (n ?? "").trim()).filter(Boolean);
    const teamB = g.teamB.map((n) => (n ?? "").trim()).filter(Boolean);
    if (teamA.length === 0 || teamB.length === 0) continue;

    const avgA =
      teamA.reduce((s, n) => s + getElo(n), 0) / teamA.length;
    const avgB =
      teamB.reduce((s, n) => s + getElo(n), 0) / teamB.length;

    const deltas: Record<string, number> = {};

    const applyGame = (
      team: string[],
      enemyAvg: number,
      won: boolean
    ) => {
      const result = won ? 1 : 0;
      for (const name of team) {
        const n = normalizeName(name);
        const myElo = getElo(name);
        const gamesBefore = gamesPlayedBefore[n] ?? 0;
        const K = gamesBefore === 0 ? K_FIRST_GAME : K_NORMAL;
        const expected = expectedScore(myElo, enemyAvg);
        const delta = Math.round(K * (result - expected));
        setElo(name, myElo + delta);
        deltas[n] = delta;
        gamesPlayedBefore[n] = gamesBefore + 1;
      }
    };

    applyGame(teamA, avgB, g.winner === "yin");
    applyGame(teamB, avgA, g.winner === "yang");

    gameDeltas.set(g.id, deltas);
  }

  return { elos, gameDeltas };
}

export { BASE_ELO };
