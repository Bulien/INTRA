export interface Player {
  id: string;
  name: string;
  rating: number;
}

export interface BalanceOptions {
  /** When true, randomize order of players with the same rating so they can be swapped between teams (scores stay even). */
  shuffleSameRating?: boolean;
}

/**
 * Balances players into two teams of equal size with closest total rating.
 */
export function balanceTeams(
  players: Player[],
  options?: BalanceOptions
): {
  teamA: Player[];
  teamB: Player[];
  teamAScore: number;
  teamBScore: number;
  imbalance: number;
} {
  if (players.length === 0) {
    return { teamA: [], teamB: [], teamAScore: 0, teamBScore: 0, imbalance: 0 };
  }

  const sorted = [...players].sort((a, b) =>
    b.rating !== a.rating
      ? b.rating - a.rating
      : options?.shuffleSameRating
        ? Math.random() - 0.5
        : 0
  );
  const half = Math.floor(players.length / 2);
  const pool = sorted;

  // Use dynamic programming / greedy: assign each player to the team that
  // minimizes the current imbalance
  const teamA: Player[] = [];
  const teamB: Player[] = [];
  let scoreA = 0;
  let scoreB = 0;

  for (const player of pool) {
    const imbalanceIfA = Math.abs(scoreA + player.rating - scoreB);
    const imbalanceIfB = Math.abs(scoreA - (scoreB + player.rating));

    if (teamA.length >= half) {
      teamB.push(player);
      scoreB += player.rating;
    } else if (teamB.length >= half) {
      teamA.push(player);
      scoreA += player.rating;
    } else if (imbalanceIfA <= imbalanceIfB) {
      teamA.push(player);
      scoreA += player.rating;
    } else {
      teamB.push(player);
      scoreB += player.rating;
    }
  }

  return {
    teamA,
    teamB,
    teamAScore: teamA.reduce((s, p) => s + p.rating, 0),
    teamBScore: teamB.reduce((s, p) => s + p.rating, 0),
    imbalance: Math.abs(scoreA - scoreB),
  };
}
