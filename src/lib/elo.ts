/**
 * Elo rating for team games (LoL, OW, Battlerite) from wins/losses.
 *
 * Formula (skill-aware, game-count aware):
 * 1. Prior: add 2 virtual wins and 2 virtual losses so few games don't dominate.
 * 2. Effective win rate: p = (wins + 2) / (wins + losses + 4), clamped to [0.01, 0.99].
 * 3. Elo = 1000 - 400 * log10((1 - p) / p)
 *    - 50% win rate → 1000
 *    - Higher win rate → higher Elo; more games reduce the pull of the prior.
 *    - 1-0 gives ~1070 (not rank 1); 10-0 gives ~1380; 10-10 stays 1000.
 */
const PRIOR_WINS = 2;
const PRIOR_LOSSES = 2;
const ELO_CENTER = 1000;
const ELO_SCALE = 400;

export function computeElo(wins: number, losses: number): number {
  const winsEff = wins + PRIOR_WINS;
  const lossesEff = losses + PRIOR_LOSSES;
  const p = winsEff / (winsEff + lossesEff);
  const pClamped = Math.max(0.01, Math.min(0.99, p));
  const elo = ELO_CENTER - ELO_SCALE * Math.log10((1 - pClamped) / pClamped);
  return Math.round(elo);
}

/** Extra prior for early games so the first game has less impact (winsBefore+lossesBefore = gamesPlayed before this game). */
const DAMPEN_GAMES = 5;
const EXTRA_PRIOR_PER_MISSING_GAME = 2;

function extraPrior(gamesPlayed: number): number {
  if (gamesPlayed >= DAMPEN_GAMES) return 0;
  return (DAMPEN_GAMES - gamesPlayed) * EXTRA_PRIOR_PER_MISSING_GAME;
}

function computeEloWithPrior(wins: number, losses: number, gamesPlayed: number): number {
  const extra = extraPrior(gamesPlayed);
  const winsEff = wins + PRIOR_WINS + extra;
  const lossesEff = losses + PRIOR_LOSSES + extra;
  const p = winsEff / (winsEff + lossesEff);
  const pClamped = Math.max(0.01, Math.min(0.99, p));
  const elo = ELO_CENTER - ELO_SCALE * Math.log10((1 - pClamped) / pClamped);
  return Math.round(elo);
}

/** Minimum absolute Elo change to display per game (so each game feels meaningful). */
export const MIN_ELO_DELTA = 20;

/**
 * Elo delta for one game: uses a stronger prior for the first few games so the first game has less impact,
 * then clamps so that |delta| >= MIN_ELO_DELTA (minimum 20 points per win/loss).
 */
export function computeEloDelta(winsBefore: number, lossesBefore: number, won: boolean): number {
  const gamesBefore = winsBefore + lossesBefore;
  const eloBefore = computeEloWithPrior(winsBefore, lossesBefore, gamesBefore);
  const eloAfter = computeEloWithPrior(
    winsBefore + (won ? 1 : 0),
    lossesBefore + (won ? 0 : 1),
    gamesBefore + 1
  );
  let delta = eloAfter - eloBefore;
  if (delta === 0) return 0;
  const sign = delta > 0 ? 1 : -1;
  return sign * Math.max(MIN_ELO_DELTA, Math.abs(delta));
}
