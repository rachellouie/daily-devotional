/**
 * lib/preferences.ts — pure parsers for client-set display preferences.
 *
 * These read the raw cookie VALUE (already extracted by the caller) and return a
 * typed preference. Kept pure and free of `next/headers` so they're trivially
 * unit-testable and usable from either the server (initial SSR state) or the
 * client (after a toggle). The cookie itself is written client-side, so it is
 * NOT httpOnly — that's fine: it carries a display preference, no secret.
 */

/** Cookie name for the "show verse numbers" preference. Shared with the client. */
export const VERSE_NUMBERS_COOKIE = "verseNumbers";

/**
 * Verse numbers are HIDDEN BY DEFAULT (spec decision): a clean reading first,
 * numbers only when the reader opts in. So only the exact string "true" enables
 * them; everything else — no cookie, "false", or any unexpected value — is hidden.
 */
export function parseVerseNumbersPref(raw: string | undefined): boolean {
  return raw === "true";
}

/** Cookie name for the client's IANA timezone, written client-side by TimezoneSync. */
export const TZ_COOKIE = "tz";

/**
 * Fallback zone when the `tz` cookie is absent or invalid. The reader's own zone
 * (NYC) is the best first guess: on a first-ever visit — before TimezoneSync has
 * written the cookie — the primary reader sees the correct day with no refresh,
 * and any other visitor self-corrects on the one soft refresh TimezoneSync fires.
 */
export const DEFAULT_TIME_ZONE = "America/New_York";

/**
 * Validate a client-supplied IANA timezone before it reaches Intl. The cookie is
 * user-controllable, so an unknown or garbage value must never throw the page:
 * we probe it against Intl (which throws RangeError on an unrecognized zone) and
 * fall back to DEFAULT_TIME_ZONE. The return value is guaranteed safe to hand to
 * `Intl.DateTimeFormat({ timeZone })`.
 */
export function parseTimeZone(raw: string | undefined): string {
  if (!raw) return DEFAULT_TIME_ZONE;
  try {
    // Constructing the formatter is enough to validate the zone; a bad one throws.
    new Intl.DateTimeFormat("en-CA", { timeZone: raw });
    return raw;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}

/** Cookie name for the theme preference. Shared with the client + inline script. */
export const THEME_COOKIE = "theme";

/**
 * The three theme modes. "system" means "follow the OS prefers-color-scheme",
 * resolved at runtime (server can't know it) — which is why the inline
 * flash-prevention script, not the server, owns the pre-paint `.dark` class.
 */
export type ThemeMode = "light" | "dark" | "system";

/**
 * Theme DEFAULTS TO "system" (spec decision): a first-time reader inherits their
 * OS appearance. Only the exact strings "light"/"dark"/"system" are honored;
 * everything else — no cookie or any unexpected value — falls back to "system".
 */
export function parseThemePref(raw: string | undefined): ThemeMode {
  return raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
}
