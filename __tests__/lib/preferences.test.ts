import { describe, it, expect } from "vitest";
import {
  parseVerseNumbersPref,
  parseThemePref,
  THEME_COOKIE,
} from "@/lib/preferences";

// Slice 2 (verse-number toggle): verse numbers are HIDDEN BY DEFAULT (spec AC 5).
// This pure parser is the boundary between the persisted cookie and the SSR class,
// so "default hidden" is the one piece of the toggle with real automated coverage
// (the toggle interaction + CSS visibility flip are eyeball-only, render-gap).
describe("parseVerseNumbersPref", () => {
  it("defaults to hidden when there is no cookie", () => {
    expect(parseVerseNumbersPref(undefined)).toBe(false);
  });

  it("is hidden when the cookie explicitly says 'false'", () => {
    expect(parseVerseNumbersPref("false")).toBe(false);
  });

  it("is shown only when the cookie is exactly 'true'", () => {
    expect(parseVerseNumbersPref("true")).toBe(true);
  });

  it("defaults to hidden for any unexpected value", () => {
    expect(parseVerseNumbersPref("1")).toBe(false);
    expect(parseVerseNumbersPref("")).toBe(false);
  });
});

// Slice 1 (theme): the theme is tri-state (light/dark/system) and defaults to
// "system" so a first-time reader inherits their OS appearance. This pure parser
// is the boundary between the persisted cookie and the toggle's initial mode; the
// inline flash-prevention script + the .dark class flip are eyeball-only (the
// render-gap that automated tests can't reach here). See spec ACs 1–4.
describe("parseThemePref", () => {
  it("exports the cookie name 'theme'", () => {
    expect(THEME_COOKIE).toBe("theme");
  });

  it("defaults to 'system' when there is no cookie", () => {
    expect(parseThemePref(undefined)).toBe("system");
  });

  it("returns the explicit mode for each known value", () => {
    expect(parseThemePref("light")).toBe("light");
    expect(parseThemePref("dark")).toBe("dark");
    expect(parseThemePref("system")).toBe("system");
  });

  it("falls back to 'system' for any unexpected value", () => {
    expect(parseThemePref("")).toBe("system");
    expect(parseThemePref("DARK")).toBe("system");
    expect(parseThemePref("true")).toBe("system");
  });
});
