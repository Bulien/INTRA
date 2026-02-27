/** Battlerite champion ids (lowercase) by category. Image path: /images/{Name}.png (first letter capitalized). */
export const BATTLERITE_MELEE = [
  "bakko", "croak", "freya", "jamila", "raigon", "rook", "ruhkaan", "shifu", "thorn",
] as const;
export const BATTLERITE_RANGED = [
  "alysia", "ashka", "destiny", "ezmo", "iva", "jade", "jumong", "shenrao", "taya", "varesh",
] as const;
export const BATTLERITE_SUPPORT = [
  "blossom", "lucie", "oldur", "pearl", "pestilus", "poloma", "sirius", "ulric", "zander",
] as const;

export type BattleriteChampId = typeof BATTLERITE_MELEE[number] | typeof BATTLERITE_RANGED[number] | typeof BATTLERITE_SUPPORT[number];

export const BATTLERITE_ALL = [...BATTLERITE_MELEE, ...BATTLERITE_RANGED, ...BATTLERITE_SUPPORT] as const;

export function championImagePath(champId: string): string {
  const name = champId.trim();
  if (!name) return "/images/placeholder.png";
  const cap = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  return `/images/${cap}.png`;
}

export function championDisplayName(champId: string): string {
  const name = champId.trim();
  if (!name) return "—";
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}
