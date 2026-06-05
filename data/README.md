# Bundled lectionary data

These JSON files are the **BCP (2019) Daily Office Lectionary**, vendored from:

- **Source:** https://github.com/reubenlillie/daily-office (`json/readings/`)
- **License:** MIT (see the upstream repo)
- Downloaded: 2026-06-01

| File | What it is |
|---|---|
| `dol-year-1.min.json` | Year One offices (Advent-before-odd-years cycle) |
| `dol-year-2.min.json` | Year Two offices (Advent-before-even-years cycle) |
| `dol-holy-days.min.json` | Fixed holy days (not yet wired into Phase 1) |
| `dol-special-occasions.min.json` | Special occasions (not yet wired into Phase 1) |

## Shape (verified before writing the parser)

Each file is a JSON **array** of office objects. An office is keyed by its
**position in the church year**, not a calendar date:

```json
{
  "year": "Year Two",
  "season": "The Season after Pentecost",
  "week": "Proper 4",
  "day": "Monday",
  "psalms": { "morning": ["41", "52"], "evening": ["44"] },
  "lessons": { "first": "Eccles 2:1–15", "second": "Gal 1:1–17", "gospel": "Matt 13:44–52" }
}
```

Key facts the code relies on:
- `week` is **absent** on a handful of special offices (e.g. "Eve of Trinity Sunday").
- `day` is usually a weekday (`"Monday"`) but is a **fixed calendar date**
  (`"Dec 25"`, `"Jan 6"`) during the Christmas/Epiphany window.
- `title` is present only on Sundays / principal days.
- `lessons` fields (`first`/`second`/`gospel`) are all optional and have `alt*`
  variants; a few offices nest lessons under `morning`/`evening`.

Mapping a calendar date onto this structure is the job of
`lib/liturgicalCalendar.ts`.
