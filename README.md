# Daily Devotional

A daily scripture devotional reader. It follows the **Bridgetown Church BREAD
2026** reading plan: it figures out today's date in the reader's own timezone,
looks up the appointed readings, fetches the full text from
[API.Bible](https://scripture.api.bible/), and renders them in your choice of
translation — with light/dark mode, optional verse numbers, and feast/fast day
markers.

Built with **Next.js 14 (App Router)**, **TypeScript (strict)**, **Tailwind**,
and **shadcn/ui** — as a study + portfolio project (and the playground for
spec-driven / TDD agentic-coding practice).

## Prerequisites

> **Node ≥ 18.17 is required** (Next.js 14). If this machine still defaults to
> Node 16, install a newer one first: `nvm install 20 && nvm use 20`.

## Setup

```bash
npm install
cp .env.local.example .env.local      # then paste your free API.Bible key
npm run dev                           # http://localhost:3000
```

Get a free **API.Bible** key (non-commercial Starter plan) at
<https://scripture.api.bible/>. The example file also reserves a
`BIBLEBRAIN_API_KEY` slot for audio, which isn't wired up yet — you can leave it
blank.

Useful scripts: `npm run typecheck` (tsc, no emit), `npm test` (Vitest),
`npm run build`, `npm run lint`.

## How a request flows

```
app/page.tsx  (async Server Component)
   │  today's date, in the reader's IANA timezone
   ▼
lib/breadOffice.ts          ISO date ─► ReadingRef[]  (look up the BREAD plan in bundled JSON)
   ▼
lib/scripture.ts            fetch passage text from API.Bible
                            (server-only, holds the API key; parses non-contiguous refs into segments)
   ▼
components/  ReadingList · ReadingCard   (render, with display prefs applied)
```

`app/loading.tsx` shows a skeleton while the server awaits API.Bible;
`app/error.tsx` catches thrown errors (e.g. a missing API key). Display
preferences (translation, theme, verse numbers, timezone) are carried in cookies
so they survive reload and seed the initial server render.

## Features

- **Multiple translations** — pick **NIV**, **NLT**, or **MSG**; the choice is
  remembered. (API.Bible's free plan caps you at three translations.)
- **Light / dark / system mode**, with a no-flash inline theme script.
- **Verse numbers** off by default, toggleable — a clean reading first.
- **Non-contiguous passages** — a reference like `Lam. 3:1-9, 19-33` renders
  each appointed span as its own segment with a visible gap marker, never a
  silently-joined run of text.
- **Local-midnight rollover** — the day's reading changes at the *reader's*
  midnight, not the server's UTC midnight.
- **Feast / fast day markers** drawn from the BREAD plan.
- Small-caps rendering of the divine name (L<small>ORD</small>) in OT passages.
- **Dev-only `?date=YYYY-MM-DD`** override to jump to any day's readings (gated
  off in production).

## Data sources

- **Reading plan:** the Bridgetown Church BREAD 2026 plan, bundled locally in
  `data/bread-2026.json` (parsed from the published PDF). No external dependency
  at runtime for the schedule itself.
- **Scripture text:** [API.Bible](https://scripture.api.bible/), fetched at
  request time.

## Known limitations / not yet built

- **Audio playback** is scaffolded for (reserved env key, type hooks) but not
  implemented.
- No BCP prayers / collects, reading streaks, or saved/previous days yet — the
  types and component layering anticipate these (see inline comments).
- The schedule is whatever the BREAD 2026 plan specifies; dates outside the plan
  fall back to a clean "no reading for today" state rather than crashing.

## Legacy code (not in the active path)

This project started as a **BCP Daily Office** reader keyed off a computed church
calendar, then pivoted to the date-keyed BREAD plan. A few modules from that
first design are still in the tree but **no longer imported by the app**:
`lib/liturgicalCalendar.ts`, `lib/dailyOffice.ts`, and the `data/dol-*.json`
lectionary files (plus the now-stale notes in `data/README.md`). Treat
`lib/breadOffice.ts` as the current source of truth for "what do I read today."
