/** Min registered users required to submit results per game. LoL/OW/Battlerite: 6; Survival Chaos: 3. */
export const MIN_REQUIRED_BY_GAME: Record<string, number> = {
  lol: 6,
  ow: 6,
  sc: 3,
  battlerite: 6,
};

export const DEFAULT_MIN_USERS = 6;
