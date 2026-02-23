/**
 * Fallback Elo from W/L only (used when match-based replay Elo is not available, e.g. client cache).
 * Primary Elo is now match-based in eloReplay.ts (1000 base, gain/loss from team vs enemy avg).
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
