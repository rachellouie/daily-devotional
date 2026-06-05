# Spec: Scripture data layer — multi-translation text + audio playback

## Outcome

The app serves scripture text in ESV, NIV, or NLT. The user picks a translation
from pills in the page header; the choice persists in a cookie so it survives
reloads. A sticky bottom audio bar lets the user listen to all four readings
played back-to-back, with play/pause and skip prev/next controls. When a passage
has no audio, the player skips it and shows a self-dismissing toast naming the
skipped reading.

## Context

**Files to delete:**
- `lib/esv.ts` — replaced entirely by `lib/scripture.ts`

**Files to create:**
- `lib/scripture.ts` — server-only. Fetches passage text from API.Bible for any
  of the three translations. Mirrors `lib/esv.ts`'s public contract:
  `fetchReadings(refs, translation)` → `Reading[]`. Throws `ScriptureConfigError`
  on missing API key (same pattern as `EsvConfigError`).
- `lib/audio.ts` — server-only. Given a reference string + translation, calls
  the Bible Brain API to resolve a fileset audio URL. Returns `string | null`.
  **Prerequisite:** register for a Bible Brain API key and look up the fileset IDs
  for ESV, NIV, and NLT audio before implementing this module.
- `app/api/audio/route.ts` — Route Handler. Reads `?ref=` and `?translation=`
  query params, calls `lib/audio.ts`, returns an HTTP 302 redirect to the CDN
  audio URL. `BIBLEBRAIN_API_KEY` never appears in any response sent to the client.
- `app/actions/translation.ts` — Server Action. Validates the value is in
  `Translation`, sets the `translation` cookie (path `/`, max-age 1 year),
  calls `revalidatePath('/')`.
- `components/TranslationPicker.tsx` — `"use client"`. Three pill/tab buttons
  (ESV · NIV · NLT) in the page header. Active pill highlighted. Calls
  `setTranslation()` server action on selection.
- `components/AudioPlayer.tsx` — `"use client"`. Sticky bottom bar
  (`position: fixed, bottom: 0`). Receives `Reading[]` as a prop; fetches audio
  URLs lazily from `/api/audio` when the user presses play. Controls: play/pause,
  skip to previous reading, skip to next reading. Displays the current reading's
  reference. Uses the native `<audio>` element — no third-party player library.

**Files to modify:**
- `types/index.ts`
  - `Translation` union: `"ESV" | "NIV" | "NLT"` (drop unused `"KJV"` and `"RSV"`)
  - Add `ApiBiblePassageResponse` (mirrors `EsvPassageResponse` — `{ data: { content, reference, copyright } }`)
  - Add `AudioTrack = { reading: Reading; audioUrl: string | null }`
- `app/page.tsx`
  - Read `translation` cookie via `cookies()` from `next/headers`; default `"NIV"`
  - Pass `translation` to `fetchReadings`
  - Render `<TranslationPicker activeTranslation={translation} />` inside the header area
  - Render `<AudioPlayer readings={readings} />` as last child of `<main>` (CSS `position: fixed` keeps it sticky regardless of DOM position)
  - Replace the hard-coded ESV footer with a dynamic copyright line keyed on active translation
- `app/layout.tsx` — no change
- `lib/dailyOffice.ts`, `lib/liturgicalCalendar.ts`, bundled JSON — no change

**New env vars** (add to `.env.local.example`):
```
APIBIBLE_API_KEY=     # scripture.api.bible — free Starter plan, pick ESV + NIV + NLT
BIBLEBRAIN_API_KEY=   # faithcomesbyhearing.com/bible-brain — free non-commercial
```

**New dependency:**
- `sonner` — shadcn-recommended toast for App Router. Add to `package.json` and
  wrap `<Toaster />` in the root layout. One `toast()` call in `AudioPlayer` on
  skip.

**Copyright notices** (dynamic footer keyed on `Translation`):
- ESV: "Scripture quotations from the ESV® Bible (crossway.org). For personal use."
- NIV: "Scripture taken from the Holy Bible, NIV®. © 1973–2011 Biblica, Inc.™ Used by permission of Zondervan."
- NLT: "Scripture taken from the Holy Bible, New Living Translation, © 1996–2015 Tyndale House Foundation."

## Acceptance criteria

### Translation text

1. Given no `translation` cookie, when the page loads, then readings are fetched
   in NIV and the NIV copyright notice appears in the footer.
2. Given a `translation=ESV` cookie, when the page loads, then readings are
   fetched in ESV and the ESV copyright notice appears in the footer.
3. Given a `translation=NLT` cookie, when the page loads, then readings are
   fetched in NLT and the NLT copyright notice appears in the footer.
4. Given the translation picker in the header, when the user clicks a different
   translation pill, then the cookie is updated, the page re-renders with the
   new translation's text, and that pill is highlighted as active.
5. Given API.Bible fails to return text for one passage (non-2xx), when the page
   renders, then that card shows the existing "Couldn't load this passage" fallback
   and the remaining readings render normally.
6. Given `APIBIBLE_API_KEY` is missing or blank, when any reading is fetched,
   then a `ScriptureConfigError` is thrown (surfaces via `app/error.tsx`) and
   the API key string is never logged or sent to the client.

### Audio playback

7. Given the page has loaded, when the user presses play in the sticky audio bar,
   then the first reading's audio begins playing via `<audio src>` pointing to
   `/api/audio?ref=...&translation=...`.
8. Given audio is playing reading N, when the user presses skip next (or the
   audio ends naturally), then reading N+1's audio begins.
9. Given audio is playing the last reading and it ends naturally, then the player
   stops (does not loop back to the first reading).
10. Given audio is playing and the user presses skip previous, then reading N-1's
    audio begins (or the current reading restarts if already at the first).
11. Given Bible Brain returns no audio for reading N, when the player reaches it,
    then reading N is skipped AND a toast appears: "No audio for [reference]",
    auto-dismissing after 3 seconds, while the next reading begins.
12. Given the audio Route Handler receives `GET /api/audio?ref=John+3:16&translation=NIV`,
    then the response is an HTTP 302 to a Bible Brain CDN URL, and the
    `BIBLEBRAIN_API_KEY` string does not appear anywhere in the response headers
    or body.
13. Given the audio Route Handler receives a request with missing or invalid
    `ref` or `translation` params, then it returns HTTP 400.
14. Audio playback is always user-initiated — the player renders in a paused state
    on page load (no autoplay; browsers block it anyway).

### Type safety

15. `tsc --noEmit` passes with zero errors after the refactor.
16. Every `switch` or exhaustive map over `Translation` covers `"ESV" | "NIV" | "NLT"`
    and no dead code references `"KJV"` or `"RSV"`.

## Guardrails

- Do NOT touch `lib/liturgicalCalendar.ts` or `lib/dailyOffice.ts`.
- Do NOT add per-reading translation overrides (one global cookie, not per-card state).
- Do NOT add playback speed controls (deferred).
- Do NOT loop audio after the last reading ends.
- Do NOT move `<AudioPlayer>` into `app/layout.tsx`.
- No new npm dependencies beyond `sonner`.
- `lib/scripture.ts` and `lib/audio.ts` must both have `import "server-only"` as
  their first line — enforced at build time.

## Verification

TDD — this pass also installs Vitest (per `CLAUDE.md`, the first `/tracer` run
adds it). Write failing tests first for each slice.

Gate: `npm run typecheck && npm test`

**Suggested tracer slices (in order):**
1. Install Vitest + `lib/scripture.ts` unit tests → implementation (replaces `lib/esv.ts`)
2. `app/actions/translation.ts` + `TranslationPicker` + wire into `app/page.tsx`
   (cookie read, footer, picker render)
3. `lib/audio.ts` + `app/api/audio/route.ts` unit tests → implementation
4. `AudioPlayer` component (play/pause, skip, toast on failure)
5. Wire `<AudioPlayer readings={readings} />` into `app/page.tsx` + types cleanup
