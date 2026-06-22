# Spec: Non-contiguous scripture passages — fetch & show every segment

> **Status:** Spec only — not yet implemented. Decisions captured 2026-06-06.
> **Correction (2026-06-08):** An earlier draft claimed two refs in
> `data/bread-2026.json` were dirty (`Ezek 18:1–4, 19:32`, `Esth 2:5–8, 15:–23`).
> On verification against both `bread-raw.txt` and the committed JSON, **those
> dirty forms exist nowhere** — both refs are already clean (`…25–32`, `…15–23`).
> The dirty-data fix slice and corrections list were removed; the drop+warn
> safety net and the parse-coverage gate (AC 17) remain as forward-looking
> defense for *future* years.
> **Scope note:** The current converter (`lib/scripture.ts` `toPassageId`) keeps
> only the *first* comma-separated segment of a reference and silently drops the
> rest. This spec defines fetching and rendering **all** segments.

## Outcome

When a lectionary reference is non-contiguous (the editor appointed disjoint
spans, e.g. `Lam. 3:1–9, 19–33`), the reader shows **all** appointed verses in
order — not just the first span. Skipped verses between spans are made visible
to the reader (a deliberate gap marker), so the omission reads as intentional
rather than as missing text. Part-verse markers (`33a`, `27b`) are honored
exactly — only the appointed half of the verse is shown.

This is **~10% of the year**: 161 of the BREAD-2026 references are
non-contiguous. This is core behavior, not an edge case.

## Context

### Why this is not a one-liner

API.Bible's `/passages` endpoint accepts a **single contiguous range only**
(`BOOK.CH.V-BOOK.CH.V`) — confirmed from the official docs. Disjoint ranges
(the commas) cannot be fetched in one request, so each segment is fetched
separately and the results stitched together.

A single contiguous range **may cross chapters and even books** — the docs'
examples are `GEN.1.1-GEN.2.3` (cross-chapter) and `1CO.16.1-2CO.1.23`
(cross-book). So a chapter-spanning segment like `JOB.32.19-JOB.33.1` is one
valid request; only the *disjointness* between segments requires splitting.

Three latent issues surfaced while reading the current converter — all must be
fixed for this to work, even for single-segment refs:

1. **Dash normalization.** The data mixes hyphen `-` and en-dash `–` (sometimes
   in the same ref, e.g. `Amos 1:1-5,13–2:8`). The current `toPassageId` only
   looks for `-` via `indexOf("-")`, so en-dash ranges like `15:1–3` are
   mis-parsed as a single verse today. The parser must normalize `–`/`—` → `-`
   before parsing.
2. **Context threading.** Trailing segments are bare (`, 19–33` has no book and
   no chapter). They inherit the **book** from segment 1, and the **chapter**
   from the chapter where the *previous* segment ended.
3. **Part-verse markers.** `33a` / `27b` are not valid USFM verse IDs (verses
   are integers). See the Open Questions section — honoring these exactly is the
   highest-risk part of this work.

### Reference shapes in the real data (counts)

| Shape | Count | Example | Difficulty |
|---|---|---|---|
| Trailing same-chapter verses | ~148 | `1 Sam 15:1–3, 7–23` · `Dan 12:1–4, 13` | tractable |
| Part-verse suffix (a/b) | 10 | `1 Cor 14:20–33a, 39–40` | **high risk** (see Open Qs) |
| Trailing segment crosses a chapter | 8 | `Deut 31:7–13, 24–32:4` · `Rev 21:1–4, 22–22:5` | hard |
| 3-segment refs | 1 | `Job 32:1–10, 19–33:1, 19–28` | hard |

> `1 Kgs 5:1–6:1,7` looks dirty but is **not** — it's a chapter-crossing first
> segment + a trailing verse, and parses correctly under the threading rule to
> `["1KI.5.1-1KI.6.1", "1KI.6.7"]`. No correction needed.

### Data integrity (no corrections needed)

Verified 2026-06-08 against both `data/bread-raw.txt` and the committed
`data/bread-2026.json`: **every reference in the 2026 data is clean.** The two
refs an earlier draft flagged as typos were never dirty (`Ezekiel 18:1-4, 25-32`
and `Esther 2:5-8, 15-23` in both sources). They are ordinary same-chapter
multi-segment refs and serve as Slice 1 fixtures, not corrections.

The parser's drop+warn (AC 9) remains as a **safety net** for any genuinely
malformed *future* entry, and AC 17 (parse-coverage gate) turns a dirty ref in
any future year into a red build — but there is nothing to correct today.

### Files to modify

- **`lib/scripture.ts`**
  - Replace `toPassageId(rawRef): string | null` with
    `toPassageIds(rawRef): PassageSegment[] | null`, which:
    - normalizes dashes,
    - splits on commas,
    - threads book + chapter context forward across segments,
    - emits one `PassageSegment` per span, each carrying its USFM passage ID and
      any part-verse trim info.
  - `fetchPassage` → fetch **each** segment's passage ID, apply part-verse
    trimming, and return an ordered `ReadingSegment[]` (text + canonical ref per
    segment) rather than a single `{ canonical, text }`.
  - Partial-failure handling: a failed segment fetch yields a segment with
    `text: null`; sibling segments still render.
  - Unparseable segment (dirty data): drop it, `console.warn` the raw ref for
    manual correction; never crash. Parseable siblings still render.

- **`types/index.ts`**
  - `Reading` body becomes segment-structured. Introduce:
    ```ts
    /** One appointed span of a reading, after fetch. */
    interface ReadingSegment {
      reference: string;      // ALWAYS populated — a human-readable ref for this
                              // span, derived from the parsed reference up front
                              // (NOT solely from the API response), so it is
                              // available even when the fetch fails. On success it
                              // is replaced/confirmed by API.Bible's canonical ref.
      text: string | null;    // null = this span failed to load; reference still shows
    }
    ```
    **The reference must survive a failed fetch.** When `text` is null the card
    still shows `reference` so the reader can look the passage up manually. This
    means the per-segment human reference is computed during parsing, before any
    network call.
  - `Reading.segments: ReadingSegment[]` replaces the single `text` field.
    A normal contiguous reading is just a **one-element** `segments` array — this
    unifies the model so the UI has one code path.
  - Add `PassageSegment` (pre-fetch) for the converter's output:
    `{ passageId: string; partVerse?: { verse: number; half: "a" | "b" } | ... }`
    (exact shape pending the Open Question on part-verse honoring).

- **`components/ReadingCard.tsx`** (and/or `ReadingList`)
  - Map over `reading.segments`. Render a **visible gap marker** (a centered `⋯`
    or a thin divider with the omitted-verse hint) *between* segments — never
    before the first or after the last.
  - A single-segment reading renders exactly as today (no marker).
  - A segment with `text: null` renders the existing per-passage
    "Couldn't load this passage" fallback in place, gap markers still correct.

- **`lib/breadOffice.ts`** — replace the hardcoded `bread-2026.json` import with
  a year-agnostic load of all bundled `bread-*.json` files merged by ISO date
  (see Future-proofing). Adding a future year then needs no logic change.

- **`data/README.md`** (new) — "Adding a new year" runbook (see Future-proofing).

- **Tests:** `__tests__/scripture.test.ts` (converter table + fetch/stitch),
  a component test for the gap-marker rendering, and
  `__tests__/lectionary-data.test.ts` (the data-validation gate, AC 17–19).

## Acceptance criteria

### Converter — `toPassageIds` (pure, unit-tested as a table)

1. `"1 Sam 15:1–3, 7–23"` → `["1SA.15.1-1SA.15.3", "1SA.15.7-1SA.15.23"]`
   (trailing range inherits book **and** chapter).
2. `"Dan 12:1–4, 13"` → `["DAN.12.1-DAN.12.4", "DAN.12.13"]`
   (trailing single verse).
3. `"Acts 2:14, 22–32"` → `["ACT.2.14", "ACT.2.22-ACT.2.32"]`
   (leading single verse, then a range).
4. `"Gen 27:46–28:4, 10–22"` → `["GEN.27.46-GEN.28.4", "GEN.28.10-GEN.28.22"]`
   (segment 1 crosses a chapter; trailing verses inherit the chapter where
   segment 1 **ended** — ch. 28, not 27).
5. `"Deut 31:7–13, 24–32:4"` → `["DEU.31.7-DEU.31.13", "DEU.31.24-DEU.32.4"]`
   (trailing segment itself crosses into a new chapter).
6. `"Job 32:1–10, 19–33:1, 19–28"` →
   `["JOB.32.1-JOB.32.10", "JOB.32.19-JOB.33.1", "JOB.33.19-JOB.33.28"]`
   (three segments; the third inherits ch. 33 from where segment 2 ended).
7. En-dash and hyphen are interchangeable: `"Amos 1:1-5,13–2:8"` parses
   identically to the same ref written with consistent dashes →
   `["AMO.1.1-AMO.1.5", "AMO.1.13-AMO.2.8"]`.
8. A single-segment ref still works: `"Isaiah 62:1-12"` → `["ISA.62.1-ISA.62.12"]`
   (one element — no regression).
9. **Safety net only** — the 2026 data is verified clean (no dirty refs), so this
   path is defensive. For any future unparseable segment, the parser drops that
   segment, returns the parseable sibling(s), and `console.warn`s the raw ref. A
   ref with **no** parseable segment returns `null` (existing per-reading miss
   path). The parser never guesses intent on malformed input.

### Fetch + stitch — `fetchPassage` / `fetchReadings`

10. Given a 2-segment ref where both fetches succeed, the resulting `Reading`
    has `segments.length === 2`, in order, each with its own canonical
    `reference` and non-null `text`.
11. Given a 2-segment ref where the **second** segment's fetch returns non-2xx,
    the `Reading` still has both segments; the first has text, the second has
    `text: null` **but a populated `reference`**. The whole reading is not
    dropped, and the failed segment's reference is still available to render so
    the reader can look it up manually.
12. A normal contiguous ref produces a `Reading` with `segments.length === 1`.

### Rendering — `ReadingCard`

13. A reading with 2+ segments renders an **inline `…` (horizontal ellipsis,
    U+2026)** **between** consecutive segments and **not** at the start or end.
    The marker is minimal and inline so the passage reads as continuously as
    possible — no heavy divider, no annotation, no omitted-verse text.
14. A reading with 1 segment renders no gap marker (visually identical to today).
15. A segment with `text: null` renders the existing per-passage failure
    fallback **with its `reference` shown** (so the reader can look it up), and
    surrounding `…` markers remain correct.

### Type safety

16. `tsc --noEmit` passes. No code still references the removed single
    `Reading.text` field; every reader goes through `segments`.

### Future-proofing — data-validation gate (covers all bundled years)

These run over **every** bundled `bread-YYYY.json` so a new year can't silently
ship with gaps. They turn today's silent `console.warn` fallbacks into red CI.

17. **Parse coverage (hard fail).** Every reference in every bundled year parses
    to ≥1 segment via `toPassageIds`. Any ref that returns `null` (dirty data)
    fails the test, listing `year`, `date`, and the raw ref. No allowlist — dirty
    data is always a bug to correct in the source JSON.
18. **Part-verse override coverage (fail with explicit allowlist).** Every ref
    containing an `a`/`b` part-verse marker has an override entry for **every**
    `Translation`. A missing `(verse, translation)` fails the test, listing what's
    missing — UNLESS that verse is in an explicit `KNOWN_WHOLE_VERSE_FALLBACKS`
    allowlist (a conscious "ship the whole verse here" opt-in, not an accident).
19. **No orphan overrides.** Every entry in the override table corresponds to a
    part-verse that still exists in the bundled data (so overrides for removed
    refs get flagged, not silently kept).

## Guardrails

- Do **not** change `lib/breadOffice.ts` lookup, `lib/liturgicalCalendar.ts`, or
  the role-mapping — this is purely the reference→text path.
- Do **not** add a new dependency for scripture-reference parsing; the converter
  stays hand-rolled in `lib/scripture.ts` (consistent with the existing `BOOKS`
  table approach).
- Do **not** "fix" dirty source data inside the parser by guessing intent. The
  2026 data is verified clean; the parser's drop+warn (AC 9) is a defensive
  safety net for future bad entries, not a code path the current data exercises.
- Preserve `import "server-only"` as the first line of `lib/scripture.ts`.
- Gap marker is presentational only — no new client interactivity; `ReadingCard`
  stays a Server Component.

## Resolved decisions (formerly open questions)

**Part-verse honoring → hand-curated override table, keyed by translation.**
API.Bible returns **whole-verse** text with **no sub-verse offsets**, and the
`a`/`b` split point is editorial — not programmatically recoverable, and it
differs per translation (NIV vs NLT vs MSG word the same verse differently, and
MSG paraphrases). So the only *exact* path is a manual override:

```ts
// lib/partVerseOverrides.ts (or a JSON data file)
// Keyed by translation, then by USFM verse, giving the exact text for each half.
// Only the half the lectionary appoints is actually used.
type PartVerseOverrides = Record<Translation, Record<string, { a: string; b: string }>>;

// e.g. partVerseOverrides.NIV["1CO.14.33"] = {
//   a: "For God is not a God of disorder but of peace.",
//   b: "As in all the congregations of the Lord's people,",
// }
```

When a parsed segment starts or ends on a part-verse (e.g. `…-1CO.14.33a`), fetch
the whole verse as normal, then **replace that verse's text with the override
half**. Only 10 refs are affected → up to 10 verses × 3 translations to curate by
hand. If an override is missing for a (verse, translation), **fall back to the
whole verse** and `console.warn` — the feature still ships; it just shows a few
extra words for that one verse until the override is added.

**Gap marker → bare inline `…`, no annotation.** Chosen for natural, continuous
reading. No omitted-verse text, no heavy divider. (See AC 13.)

## Future-proofing: adding a new year (2027+)

The manual steps a future year can introduce — part-verse overrides, and
correcting any dirty ref the next year's source happens to contain — are
**silent failure modes**: today they only `console.warn`, which nobody reads on
a deployed app. (The 2026 data needs neither today, but 2027+ might.) The
future-proofing principle is to **make the manual steps loud and enforced by a
test, not by memory.** Adding 2027 data should *fail the build* until the gaps
are addressed, so the system reminds you.

**1. Year-agnostic loading.** `lib/breadOffice.ts` currently hardcodes
`import … from "@/data/bread-2026.json"` (line 2). Change it to load **all**
bundled `bread-*.json` files and merge them into one date-keyed map. Date keys
are full ISO (`2027-01-01`), unique across years, so merging is collision-free.
Adding a year becomes: drop in `data/bread-2027.json`, add it to the one import
list — no logic change.

**2. The data-validation gate** (AC 17–19). A single test file
(`__tests__/lectionary-data.test.ts`) iterates every bundled year and asserts:
parse coverage (dirty data → red), part-verse override coverage (uncovered
part-verse → red unless explicitly allowlisted), and no orphan overrides. This
is the forcing function: you literally cannot merge a new year that has an
unparseable ref or an uncurated part-verse without making a conscious choice.

**3. A runbook** (`data/README.md`, "Adding a new year") capturing the checklist:
drop in `bread-YYYY.json` → register the import → `npm test` → fix whatever the
data gate flags (correct dirty refs in the JSON; add part-verse overrides per
translation, or allowlist a deliberate whole-verse fallback).

**Design note — hard vs. soft gates.** Parse failures are *hard* (dirty data is
unambiguously a bug). Part-verse gaps *fail by default but allow an explicit
opt-out*, because whole-verse fallback is an acceptable degradation — it should
just be a deliberate, recorded choice rather than an oversight. If you'd rather
make part-verse coverage a hard gate too (no allowlist, all overrides required
before any year ships), say so and AC 18 changes accordingly.

## Verification

Gate: `npm run typecheck && npm test` (per `CLAUDE.md`).

TDD — failing tests first. **Tracer slices, in order** (each independently
shippable; later slices are gated on earlier ones):

> ~~Slice 0 (data fix)~~ removed — the 2026 data is verified clean; there was
> nothing to correct.
>
> **Counts/examples below were rebuilt from the live bread-2026 data
> (2026-06-08).** The original AC 1–8 examples (`1 Sam`, `Dan`, `Acts 2:14`,
> `Amos`, the 3-segment Job) came from the dead `dol-*` dataset and don't exist
> in bread-2026. The authoritative converter contract is now the **real-ref
> fixtures in `__tests__/lib/scripture.test.ts`**. Live shape counts: 35
> same-chapter, 5 cross-chapter (all 2-segment), 7 part-verse, **0 three-segment**.

1. ✅ **DONE (2026-06-08) — Same-chapter + cross-chapter multi-segment** (all 40
   real comma-refs). Implemented `toPassageIds` (N-segment, threads book+chapter,
   normalizes dashes, strips a/b → whole verse), the `Reading.text → segments[]`
   model change, fetch/stitch (AC 10–12, failed-segment reference survival via
   `passageIdToReference`), and the `ReadingCard` inline `…` marker (AC 13–15,
   tested through the pure `toSegmentViews`). Cross-chapter threading (the old
   Slice 2 converter work, AC 4–5) folded in here because the N-general parser
   handles it in one algorithm. 38 tests green; a coverage smoke parses all 1018
   live scripture refs. **NOT yet done: part-verse TRIMMING** — the 7 a/b refs
   currently render the whole verse (a few extra words), never broken.
2. ~~Chapter-crossing + 3-segment~~ — cross-chapter done in Slice 1; **3-segment
   removed (0 such refs in live data).** The drop+warn safety net (AC 9) is
   implemented but the live data never triggers it.
3. **Part-verse honoring** (7 real refs). Build the per-translation override
   table (Resolved decisions); curate ~7 verses × 3 translations; missing entries
   fall back to whole-verse + warn. Widen `toPassageIds` to carry the a/b trim
   info it currently strips.
4. **Future-proofing gate** (AC 17–19). Make `lib/breadOffice.ts` load all
   `bread-*.json` years, replace the temporary `_coverage_smoke.test.ts` with the
   real `__tests__/lectionary-data.test.ts` validation gate, and write the
   `data/README.md` runbook. The parse-coverage check (AC 17) is already proven by
   the smoke; AC 18 needs the Slice 3 override table.
