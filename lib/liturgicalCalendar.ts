/**
 * lib/liturgicalCalendar.ts — the church-calendar engine.
 *
 * WHY THIS FILE EXISTS
 * The bundled lectionary (data/dol-year-*.json) is NOT keyed by calendar date.
 * It's keyed by where you are in the church year: a `season`, a `week` label
 * ("Week of 1 Advent", "Proper 4"), and a `day` ("Monday", or sometimes a fixed
 * date like "Dec 25"). The old live Daily Office API used to do this date->position
 * mapping on the server; because we bundle the raw data, WE own that math now.
 *
 * This module turns a plain JavaScript Date into a `LiturgicalDay` lookup key.
 * lib/dailyOffice.ts then uses that key to find the right reading.
 *
 * SCOPE / HONESTY (Phase 1)
 * The moveable seasons (Advent, Lent, Easter, the long Season after Pentecost)
 * are computed from first principles — Easter via the Meeus/Jones/Butcher
 * "computus" algorithm, Advent from Christmas. These cover the large majority of
 * the year, including today's date, and are the parts worth studying.
 * The fixed Christmas/Epiphany window (late Dec – mid Jan) is handled on a
 * best-effort basis and is the most likely place to need refinement; it's
 * clearly marked. When a date can't be resolved, callers fall back to a clean
 * error state rather than crashing (see dailyOffice.ts).
 *
 * Everything here is PURE (no I/O), so it's trivial to unit-test: feed a Date,
 * assert the LiturgicalDay.
 */
import type {
  LectionaryYear,
  LiturgicalDay,
  LiturgicalSeason,
} from "@/types";
import { addDays, startOfDay } from "@/lib/utils";

// 0 = Sunday … 6 = Saturday, matching JS Date.getDay().
const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

// Short month names exactly as the lectionary writes fixed-date day keys.
const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/** Human-friendly season labels (here, identical to the data's own strings). */
const SEASON_LABELS: Record<LiturgicalSeason, string> = {
  Advent: "Advent",
  Christmas: "Christmas",
  Epiphany: "Epiphany",
  Lent: "Lent",
  Easter: "Easter",
  "The Season after Pentecost": "The Season after Pentecost",
};

/**
 * Compute the date of Easter Sunday for a given year (Gregorian calendar),
 * using the Meeus/Jones/Butcher algorithm. This is the single anchor from which
 * Ash Wednesday, Lent, Easter season, and Pentecost are all derived.
 *
 * Returns a Date at local midnight.
 */
export function computusEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return startOfDay(new Date(year, month - 1, day));
}

/**
 * The First Sunday of Advent for the Advent that falls in calendar `year`.
 * Advent 1 is the fourth Sunday before Christmas (Dec 25). We find the last
 * Sunday strictly before Christmas (the 4th Sunday of Advent) and back up 3 weeks.
 */
export function adventSunday(year: number): Date {
  const christmas = startOfDay(new Date(year, 11, 25));
  const dow = christmas.getDay(); // 0 = Sunday
  // Step back to the Sunday strictly before Christmas (if Christmas IS Sunday,
  // step a full week so Advent 4 doesn't land on Christmas Day).
  const fourthAdvent = addDays(christmas, dow === 0 ? -7 : -dow);
  return addDays(fourthAdvent, -21);
}

/**
 * The Sunday on or before a date (the start of that date's liturgical week,
 * since weeks run Sunday–Saturday).
 */
function sundayOnOrBefore(date: Date): Date {
  return addDays(startOfDay(date), -date.getDay());
}

/**
 * The Sunday calendar-closest to a date (ties resolve to the earlier Sunday).
 * Used to anchor the "Proper N" weeks of the Season after Pentecost, which the
 * BCP defines as "the Sunday closest to" a fixed date.
 */
function sundayClosestTo(date: Date): Date {
  const dow = date.getDay();
  return dow <= 3 ? addDays(date, -dow) : addDays(date, 7 - dow);
}

/**
 * Identify which liturgical year a civil date belongs to and where it started.
 * A liturgical year runs from one Advent 1 to the next.
 */
function liturgicalYearStart(date: Date): { adventYearStart: number; advent1: Date } {
  const d = startOfDay(date);
  const thisYearsAdvent = adventSunday(d.getFullYear());
  if (d >= thisYearsAdvent) {
    return { adventYearStart: d.getFullYear(), advent1: thisYearsAdvent };
  }
  const prevYear = d.getFullYear() - 1;
  return { adventYearStart: prevYear, advent1: adventSunday(prevYear) };
}

/**
 * Year One vs Year Two. The BCP rule: Year One begins on the Advent preceding
 * an ODD-numbered year; Year Two precedes an EVEN-numbered year. The Advent in
 * calendar year `adventYearStart` opens the year that contains the following
 * January 1, so we test the parity of (adventYearStart + 1).
 */
function getLectionaryYear(adventYearStart: number): LectionaryYear {
  return (adventYearStart + 1) % 2 === 1 ? "Year One" : "Year Two";
}

/** Format a date as the lectionary's fixed-date key, e.g. "Dec 25" / "Jan 6". */
function calendarDateKey(date: Date): string {
  // Non-null assertion is safe: getMonth() is always 0–11, so MONTH_SHORT[m]
  // exists. We assert because noUncheckedIndexedAccess widens it to `| undefined`.
  const month = MONTH_SHORT[date.getMonth()]!;
  return `${month} ${date.getDate()}`;
}

/** Weekday name for a date (e.g. "Monday"). */
function weekdayName(date: Date): string {
  return WEEKDAY_NAMES[date.getDay()]!;
}

/** Whole-day difference a − b (positive when a is later). */
function dayDiff(a: Date, b: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / MS_PER_DAY);
}

/**
 * THE MAIN ENTRY POINT.
 * Resolve a calendar date to its liturgical position so we can look up readings.
 *
 * The return type is a fully-populated `LiturgicalDay` (never null): even for the
 * trickier fixed-date windows we always return a best-effort key, and the office
 * lookup decides whether it found a match.
 */
export function resolveLiturgicalDay(input: Date): LiturgicalDay {
  const date = startOfDay(input);
  const { adventYearStart, advent1 } = liturgicalYearStart(date);
  const year = getLectionaryYear(adventYearStart);
  const weekday = weekdayName(date);

  // Anchors for the liturgical year. Christmas falls in `adventYearStart`;
  // Easter/Pentecost fall in the following civil year.
  const civilYearOfEaster = adventYearStart + 1;
  const christmas = startOfDay(new Date(adventYearStart, 11, 25));
  const easter = computusEaster(civilYearOfEaster);
  const ashWednesday = addDays(easter, -46);
  const palmSunday = addDays(easter, -7);
  const pentecost = addDays(easter, 49);
  const epiphany = startOfDay(new Date(civilYearOfEaster, 0, 6)); // Jan 6

  // Helper to assemble the final object once we know season + week + dayKey.
  const make = (
    season: LiturgicalSeason,
    week: string,
    dayKey: string,
  ): LiturgicalDay => ({
    date,
    year,
    season,
    week,
    weekday,
    dayKey,
    seasonLabel: SEASON_LABELS[season],
  });

  // --- ADVENT: advent1 .. Dec 24 ----------------------------------------
  if (date >= advent1 && date < christmas) {
    const weekNum = Math.floor(dayDiff(date, advent1) / 7) + 1; // 1–4
    return make("Advent", `Week of ${weekNum} Advent`, weekday);
  }

  // --- CHRISTMAS: Dec 25 .. Jan 5 (fixed-date keys) ----------------------
  // Phase 1 best-effort: these offices are keyed by calendar date in the data.
  const jan6 = epiphany;
  if (date >= christmas && date < jan6) {
    return make("Christmas", "Christmas Day and Following", calendarDateKey(date));
  }

  // --- EPIPHANY -----------------------------------------------------------
  // Jan 6 through the Saturday after Epiphany are keyed by fixed date under
  // "The Epiphany and Following"; thereafter the numbered "Week of N Epiphany"
  // (weekday keys) run until Ash Wednesday.
  if (date >= jan6 && date < ashWednesday) {
    const firstSundayAfterEpiphany = addDays(sundayOnOrBefore(jan6), 7);
    if (date < firstSundayAfterEpiphany) {
      // Phase 1 best-effort fixed-date window right after Epiphany.
      return make("Epiphany", "The Epiphany and Following", calendarDateKey(date));
    }
    const weekNum = Math.floor(dayDiff(date, firstSundayAfterEpiphany) / 7) + 1;
    return make("Epiphany", `Week of ${weekNum} Epiphany`, weekday);
  }

  // --- LENT: Ash Wednesday .. Holy Saturday ------------------------------
  if (date >= ashWednesday && date < easter) {
    const firstSundayInLent = addDays(ashWednesday, 4); // Ash Wed is a Wednesday
    if (date < firstSundayInLent) {
      return make("Lent", "Ash Wednesday and Following", weekday);
    }
    if (date >= palmSunday) {
      return make("Lent", "Holy Week", weekday);
    }
    const weekNum = Math.floor(dayDiff(date, firstSundayInLent) / 7) + 1; // 1–5
    return make("Lent", `Week of ${weekNum} Lent`, weekday);
  }

  // --- EASTER: Easter Sunday .. the Day of Pentecost ---------------------
  if (date >= easter && date <= pentecost) {
    const weeksIn = Math.floor(dayDiff(date, easter) / 7);
    if (weeksIn === 0) return make("Easter", "Easter Week", weekday);
    if (weeksIn === 7) return make("Easter", "Pentecost", weekday);
    // weeksIn 1..6 -> "Week of 2 Easter" .. "Week of 7 Easter"
    return make("Easter", `Week of ${weeksIn + 1} Easter`, weekday);
  }

  // --- THE SEASON AFTER PENTECOST: Proper N ------------------------------
  // Each Proper's Sunday is "the Sunday closest to" a date 7 days apart,
  // starting with Proper 1 ≈ May 11. We anchor on that and count Sundays.
  const proper1Sunday = sundayClosestTo(startOfDay(new Date(civilYearOfEaster, 4, 11))); // May 11
  const thisWeeksSunday = sundayOnOrBefore(date);
  const properNum = Math.round(dayDiff(thisWeeksSunday, proper1Sunday) / 7) + 1;
  // Clamp into the range the lectionary actually defines (1–29).
  const clamped = Math.min(29, Math.max(1, properNum));
  return make("The Season after Pentecost", `Proper ${clamped}`, weekday);
}
