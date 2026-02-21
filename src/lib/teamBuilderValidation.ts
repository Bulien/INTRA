/** Min registered users required to submit results per game. Survival Chaos allows 3; others 10. */
export const MIN_REQUIRED_BY_GAME: Record<string, number> = {
  lol: 10,
  ow: 10,
  sc: 3,
  battlerite: 10,
};

export const DEFAULT_MIN_USERS = 10;
