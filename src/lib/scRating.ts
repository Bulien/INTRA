/**
 * Survival Chaos ranking: prior‑shrinkage rating so that many games count more
 * than few games. Prevents e.g. 5 games @ 1.5 from outranking 20 games @ 1.6.
 *
 * Formula: rating = (prior × K + sum(placements)) / (K + n)
 * - prior = 2.5 (middle of 1–4)
 * - K = prior strength (virtual games at prior). Lower K = wider spread across 1–4.
 * - New players start near 2.5 and move toward their raw average as they play.
 * Rating scale: 1 (strongest) to 4 (weakest). Lower rating = better.
 */

const SC_PRIOR = 2.5;
const SC_PRIOR_STRENGTH = 2;

/**
 * Returns the SC rating (1 = strongest, 4 = weakest). Use for sort and display.
 */
export function scRating(placements: number[]): number {
  const valid = placements.filter((p) => p >= 1 && p <= 4);
  if (valid.length === 0) return SC_PRIOR;
  const sum = valid.reduce((a, b) => a + b, 0);
  const n = valid.length;
  return (SC_PRIOR * SC_PRIOR_STRENGTH + sum) / (SC_PRIOR_STRENGTH + n);
}
