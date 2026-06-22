# Spec: Dark mode + display-settings grouping

## Outcome

The reader can switch the app between **Light / Dark / System** themes, and the
choice survives reload with **no flash of the wrong theme**. The three display
controls in the header are reorganized so they read as three distinct settings
on one labeled row, separated by dividers:

```
┌─────────────────────────────────────────┐
│ Daily Devotional · BREAD 2026             │
│ Saturday, June 21, 2026                   │
│   [ ☀ | ☾ | ⚙ ] │ [ Verse# ] │ [ NIV NLT MSG ]
└─────────────────────────────────────────┘
```

- **Theme** (`☀ Light / ☾ Dark / ⚙ System`) — a 3-segment pill, affects the
  whole app chrome.
- **Verse #s** — existing toggle, unchanged behavior.
- **Translation** (`NIV / NLT / MSG`) — existing picker, unchanged behavior.

"System" follows the OS `prefers-color-scheme` and updates **live** if the OS
theme changes while the page is open. Once the reader picks Light or Dark
explicitly, that choice wins until they pick again (or return to System).

Scripture body text gets light dark-mode tuning so the serif doesn't "bloom" on
the near-black background.

## Context

Dark mode plumbing is **already laid in** — this feature mostly wires up a
control and persistence, plus reorganizes the header.

- `tailwind.config.ts` — `darkMode: "class"` already set. No change needed.
- `app/globals.css` — full `.dark` token set already defined (warm dark
  palette). Verse numbers and chapter dividers already resolve via
  `var(--muted-foreground)`, so they adapt for free. This spec ADDS a small
  `.dark .scripture` tuning block + a dark variant for the amber feast label.
- `lib/preferences.ts` — currently holds `VERSE_NUMBERS_COOKIE` +
  `parseVerseNumbersPref` (pure cookie-value parsers). ADD `THEME_COOKIE` +
  `parseThemePref` here, same shape. **This pure parser is the primary TDD
  target** (mirrors the existing `parseVerseNumbersPref` test).
- `components/VerseNumberToggle.tsx` — the persistence pattern to mirror:
  `"use client"`, non-httpOnly cookie written client-side, flips a CSS class,
  no re-fetch, no server round-trip. Theme is the same *kind* of preference
  (pure CSS, no data change) — do NOT model it on `TranslationPicker`/the
  server action (that pattern exists only because translation re-fetches text).
- `components/TranslationPicker.tsx` — the pill-group idiom to match
  (`role="group"`, `aria-pressed` per segment, `bg-primary` active state). The
  new `ThemeToggle` is styled as a 3-segment pill in this idiom.
- `app/page.tsx` — header lives here (both the normal branch ~line 112 and the
  "no reading" branch ~line 73). Already reads cookies for translation + verse
  numbers; will also read the theme cookie to pass `initial` to `ThemeToggle`.
- `app/layout.tsx` — root layout owns `<html>`/`<head>`. Hosts the inline
  flash-prevention script and gets `suppressHydrationWarning` on `<html>`.

Decisions locked during grilling:
- **States:** Light / Dark / System; **default = System** (absent cookie).
- **Persistence:** hand-rolled, **no new dependency** (not `next-themes`).
  Non-httpOnly `theme` cookie, values `"light" | "dark" | "system"`.
- **Flash prevention:** inline `<head>` script is the **single source of
  truth** for the pre-paint `.dark` class. The server does NOT set `.dark`
  (it can't resolve "system"); `<html>` carries `suppressHydrationWarning`.
- **Control:** 3-segment pill, all states visible.
- **Scripture:** tune in dark (not token-swap-only).

## Acceptance criteria

**Pure logic — the test contract (`__tests__/preferences.test.ts`):**

1. Given no cookie (`undefined`), `parseThemePref` returns `"system"`.
2. Given `"light"`, returns `"light"`; given `"dark"`, returns `"dark"`;
   given `"system"`, returns `"system"`.
3. Given any unexpected value (`""`, `"DARK"`, `"true"`, garbage),
   `parseThemePref` falls back to `"system"`.
4. `THEME_COOKIE` is exported and equals `"theme"`.

**Flash prevention (manual verification — see Verification):**

5. With cookie `theme=dark`, a hard reload paints dark immediately — no
   light flash before hydration.
6. With cookie absent and OS set to dark, first paint is dark — no light
   flash. (Inline script resolves `matchMedia("(prefers-color-scheme: dark)")`
   before paint.)
7. There is **no hydration-mismatch warning** in the console
   (`suppressHydrationWarning` on `<html>`; React never renders a theme class
   on `<html>`).

**Toggle behavior (manual verification):**

8. Clicking `☀ / ☾` sets `.dark` on/off `document.documentElement` instantly
   (pure CSS swap, no network request, no page re-fetch) and writes
   `theme=light|dark` cookie (`path=/`, ~1yr max-age, `samesite=lax`,
   non-httpOnly).
9. Clicking `⚙ System` writes `theme=system` and immediately resolves the
   class from `matchMedia`; while in System mode, flipping the OS theme updates
   the page live (a `matchMedia` `change` listener is attached while mounted
   and torn down on unmount / when leaving System mode).
10. The active segment reflects the *current mode* (Light/Dark/System), not the
    *resolved* appearance — i.e. in System mode the `⚙` segment is pressed even
    though the page is dark. `aria-pressed` matches the visible active segment.
11. The chosen mode survives a reload (cookie → `initial` prop → SSR'd active
    segment matches the post-hydration state, no segment flicker).

**Layout / IA (manual verification):**

12. The header shows three groups in order `[Theme] | [Verse#] | [Translation]`
    separated by visible dividers, on BOTH the normal and the "no reading"
    branch of `app/page.tsx`.
13. Verse-number and translation behavior is unchanged from current (this is a
    layout regroup, not a rewrite of those controls).

**Dark scripture tuning (eyeball verification):**

14. In dark mode the serif scripture body uses a slightly softened foreground
    (not pure `--foreground` white) to avoid halation; verse numbers and
    chapter dividers remain legible; the feast-day label uses a warmer/lighter
    amber that meets contrast on the dark background.

## Guardrails

- **No new dependencies.** Hand-roll the inline script + cookie. Do NOT add
  `next-themes`, a cookie lib, or a classnames lib (`cn()` already exists).
- **Do not touch** `tailwind.config.ts` (`darkMode: "class"` is already correct)
  or the existing `.dark` *token values* in `globals.css` (only ADD the
  `.dark .scripture` tuning + feast-label rule).
- **Do not** model theme persistence on the translation server action — no
  `revalidatePath`, no `httpOnly`, no re-fetch. Theme is a pure client CSS swap
  like `VerseNumberToggle`.
- **Do not** put `.dark` on `<main>` (verse numbers go there); theme goes on
  `<html>` / `document.documentElement` (Tailwind `class` convention).
- **Do not** let the server render a theme class on `<html>` — that reintroduces
  the flash/mismatch for "system". The inline script owns the pre-paint class.
- **Do not** change verse-number or translation behavior; AC 13 is a
  non-regression guard.
- `lib/preferences.ts` stays pure (no `next/headers`, no DOM) so it stays unit-
  testable — same constraint as today.

## Verification

- **TDD:** write the failing tests in `__tests__/preferences.test.ts` first
  (ACs 1–4), `parseThemePref` is the natural first slice. Red → green before
  building the toggle.
- **Gate:** `npm run typecheck && npm test` must pass (run with Node 20 —
  `nvm use 20`; the shell defaults to 16).
- **Manual (the visual/client ACs 5–14):** `npm run dev`, then:
  - Toggle through Light / Dark / System; confirm instant swap, no network
    call in the Network tab, cookie written (Application → Cookies).
  - Hard-reload in each mode; confirm no flash and no console hydration warning
    (ACs 5–7, 11).
  - With System selected, flip macOS appearance (System Settings → Appearance)
    and confirm the open page follows live (AC 9).
  - Eyeball dark scripture comfort + feast label contrast (AC 14); the
    `?date=YYYY-MM-DD` dev override can jump to a feast day.
