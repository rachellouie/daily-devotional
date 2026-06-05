# Spec: Scripture data layer — Bridgetown lectionary + multi-translation text

> **Scope note:** Audio playback (Bible Brain) is deferred until the Bible Brain
> API key arrives. This pass covers lectionary switch + text translations only.

## Outcome

The app shows today's readings from the Bridgetown BREAD 2026 plan (not the BCP
lectionary). Scripture text is fetched from API.Bible in NIV, NLT, or MSG (The
Message). The user picks a translation from pills in the page header; the choice
persists in a cookie so it survives reloads. NIV is the default for new visitors.

## Context

**Files to delete:**
- `lib/esv.ts` — replaced entirely by `lib/scripture.ts`

**Files to create:**
- `lib/breadOffice.ts` — server-only. Loads `data/bread-2026.json`, looks up
  today's ISO date, returns `ReadingRef[]` (mapping the 4 ordered readings to
  roles `psalm → first → second → gospel`). Also returns `feast` and `fast` flags.
  Falls back gracefully when today's date has no entry.
- `lib/scripture.ts` — server-only. Fetches passage text from API.Bible for any
  of the three translations. Public contract: `fetchReadings(refs, translation)`
  → `Reading[]`. Throws `ScriptureConfigError` on missing API key.

  API.Bible Bible IDs (confirmed via API):
  - NIV:  `78a9f6124f344018-01`
  - NLT:  `d6e14a625393b4da-01`
  - MSG:  `6f11a7de016f942e-01`

  Endpoint: `GET https://api.scripture.api.bible/v1/bibles/{bibleId}/passages/{passageId}`
  Params: `content-type=text`, `include-verse-numbers=true`, `include-titles=false`

- `app/actions/translation.ts` — Server Action. Validates the value is in
  `Translation`, sets the `translation` cookie (path `/`, max-age 1 year),
  calls `revalidatePath('/')`.
- `components/TranslationPicker.tsx` — `"use client"`. Three pill/tab buttons
  (NIV · NLT · MSG) in the page header. Active pill highlighted. Calls
  `setTranslation()` server action on selection.

**Files to modify:**
- `types/index.ts`
  - `Translation` union: `"NIV" | "NLT" | "MSG"` (drop ESV, KJV, RSV entirely)
  - Add `ApiBiblePassageResponse`: `{ data: { content: string; reference: string; copyright: string } }`
  - Remove `EsvPassageResponse`
- `app/page.tsx`
  - Replace BCP lectionary calls with `getReadingRefs()` from `lib/breadOffice.ts`
  - Read `translation` cookie via `cookies()` from `next/headers`; default `"NIV"`
  - Pass `translation` to `fetchReadings`
  - Render `<TranslationPicker activeTranslation={translation} />` in the header
  - Replace hard-coded ESV footer with dynamic copyright line keyed on translation
  - Remove imports of `resolveLiturgicalDay`, `getDayPlan`, `fetchReadings` from old libs
- `app/layout.tsx` — no change
- `lib/dailyOffice.ts`, `lib/liturgicalCalendar.ts`, bundled BCP JSON — no change
  (keep but no longer used by page.tsx; don't delete)

**New env vars** — already in `.env.local`:
```
APIBIBLE_API_KEY=   # scripture.api.bible — free Starter plan
```

**Copyright notices** (dynamic footer keyed on `Translation`):
- NIV: "Scripture taken from the Holy Bible, NIV®. © 1973–2011 Biblica, Inc.™ Used by permission of Zondervan."
- NLT: "Scripture quotations taken from the Holy Bible, New Living Translation, © 1996–2015 Tyndale House Foundation."
- MSG: "Scripture taken from THE MESSAGE. © 1993–2018 by Eugene H. Peterson. Used by permission of NavPress."

## Acceptance criteria

### Bridgetown lectionary

1. Given today's date exists in `data/bread-2026.json`, when the page loads,
   then the four readings shown (psalm, OT, NT, gospel) match that day's entry.
2. Given today's date has no entry in `bread-2026.json` (e.g., a future date
   beyond the plan), when the page loads, then the page renders without crashing
   and shows a graceful "no reading for today" message instead of cards.

### Translation text

3. Given no `translation` cookie, when the page loads, then readings are fetched
   in NIV and the NIV copyright notice appears in the footer.
4. Given a `translation=NLT` cookie, when the page loads, then readings are
   fetched in NLT and the NLT copyright notice appears in the footer.
5. Given a `translation=MSG` cookie, when the page loads, then readings are
   fetched in MSG and the MSG copyright notice appears in the footer.
6. Given the translation picker in the header, when the user clicks a different
   translation pill, then the cookie is updated, the page re-renders with the
   new translation's text, and that pill is highlighted as active.
7. Given API.Bible fails to return text for one passage (non-2xx), when the page
   renders, then that card shows the existing "Couldn't load this passage" fallback
   and the remaining readings render normally.
8. Given `APIBIBLE_API_KEY` is missing or blank, when any reading is fetched,
   then a `ScriptureConfigError` is thrown (surfaces via `app/error.tsx`) and
   the API key string is never logged or sent to the client.

### Type safety

9. `tsc --noEmit` passes with zero errors after the refactor.
10. Every `switch` or exhaustive map over `Translation` covers `"NIV" | "NLT" | "MSG"`
    and no dead code references `"ESV"`, `"KJV"`, or `"RSV"`.

## Guardrails

- Do NOT touch `lib/liturgicalCalendar.ts` or `lib/dailyOffice.ts` (keep but stop using them from `page.tsx`).
- Do NOT add per-reading translation overrides (one global cookie, not per-card state).
- Do NOT add audio in this pass (deferred to a future slice once Bible Brain key arrives).
- No new npm dependencies beyond what's needed for Vitest.
- `lib/scripture.ts` and `lib/breadOffice.ts` must both have `import "server-only"` as
  their first line — enforced at build time.

## Verification

TDD — this pass also installs Vitest (per `CLAUDE.md`, the first `/tracer` run
adds it). Write failing tests first for each slice.

Gate: `npm run typecheck && npm test`

**Tracer slices (in order):**
1. Install Vitest + `lib/breadOffice.ts` unit tests → implementation (Bridgetown lectionary lookup)
2. `lib/scripture.ts` unit tests → implementation (API.Bible fetch, replaces `lib/esv.ts`)
3. `types/index.ts` update + `app/actions/translation.ts` + `TranslationPicker`
4. Wire everything into `app/page.tsx`: Bridgetown refs → scripture fetch → picker render → dynamic copyright footer
