/**
 * Input sanitization to prevent injection (XSS, script, quote-breaking).
 * Removes: quotes (' " `), angle brackets (<>), backslash, ampersand, semicolon,
 * and other characters that could be used for injection.
 */

/** Characters that are stripped from all sanitized inputs (injection-prone). */
const DANGEROUS_CHARS = /['"`<>\\;&\0-\x1F\x7F]/g;

/**
 * Sanitize display text: names, player names, free text.
 * Allows: letters (including accented), numbers, spaces, hyphen, underscore.
 */
export function sanitizeDisplayName(value: string): string {
  if (typeof value !== "string") return "";
  const stripped = value.replace(DANGEROUS_CHARS, "");
  return stripped.replace(/[^\p{L}\p{N}\s\-_]/gu, "");
}

/**
 * Sanitize email input. Allows letters, numbers, @ . - _ plus the same safe rules.
 */
export function sanitizeEmail(value: string): string {
  if (typeof value !== "string") return "";
  const stripped = value.replace(DANGEROUS_CHARS, "");
  return stripped.replace(/[^\p{L}\p{N}\s@.\-_]/gu, "");
}

/**
 * Sanitize password input. Removes only injection-dangerous chars;
 * keeps letters, numbers, and most keyboard symbols (e.g. !#$%*()=+[]{}).
 */
export function sanitizePassword(value: string): string {
  if (typeof value !== "string") return "";
  return value.replace(DANGEROUS_CHARS, "");
}
