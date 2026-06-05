# Daily Devotional — Phase 1

A daily **Daily Office (Book of Common Prayer)** devotional reader. It figures
out where today falls in the church year, looks up the appointed Morning Prayer
readings, fetches the full scripture text from the ESV API, and renders it.

Built with **Next.js 14 (App Router)**, **TypeScript (strict)**, **Tailwind**,
and **shadcn/ui** — as a study + portfolio project.

## Prerequisites

> **Node ≥ 18.17 is required** (Next.js 14). This machine currently has Node
> 16, so install a newer one first, e.g. `nvm install 20 && nvm use 20`.

## Setup

```bash
npm install
cp .env.local.example .env.local      # then paste your free ESV API key
npm run dev                           # http://localhost:3000
```

Get a free ESV key (personal/non-commercial) at <https://api.esv.org/>.

Useful scripts: `npm run typecheck` (tsc, no emit), `npm run build`, `npm run lint`.

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

`app/loading.tsx` shows a skeleton while the server awaits ESV; `app/error.tsx`
catches thrown errors (e.g. a missing API key).

## Data sources

- **Lectionary:** bundled locally in `data/` from
  [reubenlillie/daily-office](https://github.com/reubenlillie/daily-office) (MIT).
  No external dependency at runtime. See `data/README.md`.
- **Scripture text:** [ESV API](https://api.esv.org/) at request time, cached 24h.

> **Why not the live Daily Office API?** The original plan used
> `dailyoffice2019.com/api/v1/...`, but that URL returns the site's HTML shell,
> not JSON — it isn't a real REST endpoint. Bundling the open lectionary data and
> computing the church calendar ourselves (`lib/liturgicalCalendar.ts`) removes
> that dependency entirely.

## Phase 1 scope & known limitations

- Morning Prayer only; ESV only.
- The calendar engine is **verified for the moveable seasons** (Advent → Season
  after Pentecost). The fixed Christmas/Epiphany window is best-effort. Fixed
  holy days (`data/dol-holy-days.min.json`) aren't wired in yet — on those days
  you'll get the ordinary office, and unmappable days fall back to a clean empty
  state rather than crashing.

## Built to extend (Phase 2+)

The types and layering already anticipate: multiple offices (`OfficeTime`),
multiple translations (`Translation`), dark mode (CSS tokens + `darkMode:"class"`
are in place), previous days, audio, BCP prayers, reading streaks. See
inline comments marked with these features.
