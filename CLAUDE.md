# CLAUDE.md — daily-devotional

A daily **Daily Office (Book of Common Prayer)** devotional reader. Figures out
where today falls in the church year, looks up the appointed Morning Prayer
readings, fetches the scripture text from the ESV API, and renders it. Built as
a study + portfolio piece (and as the playground for spec-driven / TDD agentic
workflow practice).

## Stack

- **Next.js 14** (App Router) · **React 18** · **TypeScript (strict)**
- **Tailwind** + **shadcn/ui** (`components/ui`, configured via `components.json`)
- No database — liturgical data is bundled JSON in `data/`; scripture text comes
  from the ESV API at request time.
- **Requires Node ≥ 18.17** (Next 14). Use `nvm use 20`.

## Commands

```bash
npm run dev         # http://localhost:3000
npm run typecheck   # tsc --noEmit — the type gate
npm run lint        # next lint
npm run build
```

> **No test runner is installed yet.** The first feature built with `/tracer`
> should add **Vitest** (lightest fit for Next 14 + TS strict) and a `test`
> script. After that, the verification gate is `npm run typecheck && npm test`.

## How a request flows

```
app/page.tsx  (async Server Component)
   │  new Date()
   ▼
lib/liturgicalCalendar.ts   date ─► { year, season, week, dayKey }   (pure math)
   ▼
lib/dailyOffice.ts          look up office in bundled JSON ─► ReadingRef[]
   ▼
lib/esv.ts                  fetch passage text (server-only, holds API key)
   ▼
components/  DayHeader · ReadingList · ReadingCard   (render)
```

## Conventions & guardrails

- **`lib/esv.ts` is `server-only`** and holds the ESV API key — never import it
  into a client component or leak the key to the browser.
- **`lib/liturgicalCalendar.ts` is pure date math** — no I/O, no fetch. Keep it
  pure so it's trivially testable (it's the natural first TDD target).
- Liturgical data lives in `data/*.min.json`. Types are in `types/index.ts`;
  shared helpers in `lib/utils.ts` (use `cn()` for class merging — don't add a
  classnames lib).
- Prefer Server Components; only reach for `"use client"` when interaction
  genuinely needs it.
- Strict TS — no `any` escapes. Fix the type, don't cast around it.
- Get a free ESV key at <https://api.esv.org/>; put it in `.env.local`
  (see `.env.local.example`).

## Workflow for this repo

This is the practice ground for Level 3/4 agentic coding. Default loop:
`/spec` (grill → spec in `specs/`) → `/tracer` (vertical slices, TDD) →
`/pr-review`. The `liturgicalCalendar` date logic and ESV API edge cases
(missing passages, network failure) are the high-value places to spec carefully
and test hard.
