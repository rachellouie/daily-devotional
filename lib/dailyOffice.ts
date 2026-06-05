/**
 * lib/dailyOffice.ts — the lectionary data layer.
 *
 * Responsibilities (and ONLY these):
 *   1. Load the bundled lectionary JSON (no network — it's imported at build time).
 *   2. Given a LiturgicalDay (from lib/liturgicalCalendar.ts), find the matching
 *      office.
 *   3. Flatten that office into an ordered list of `ReadingRef`s for a given
 *      time of prayer.
 *
 * It deliberately knows NOTHING about ESV or React. Scripture text is fetched
 * elsewhere (lib/esv.ts); this layer only produces references. Keeping the data
 * source isolated behind this module means swapping it later (a different
 * lectionary, a database, the live API if it ever returns JSON) touches one file.
 *
 * Phase-1 reading-selection decision (documented):
 *   The bundled data splits PSALMS into morning/evening but lists LESSONS
 *   (first/second/gospel) as a single pool. For Morning Prayer we therefore use
 *   the morning psalms plus all listed lessons. When Evening Prayer is added it
 *   will reuse this same function with `office = "evening"` and the evening
 *   psalms; revisit the lesson split then.
 */
import yearOneData from "@/data/dol-year-1.min.json";
import yearTwoData from "@/data/dol-year-2.min.json";
import type {
  LectionaryYear,
  LiturgicalDay,
  OfficeTime,
  RawLectionary,
  RawOffice,
  ReadingRef,
} from "@/types";

/**
 * JSON imports come in loosely typed. We cast once, here, through `unknown` —
 * the standard escape hatch for "I know the runtime shape better than the
 * compiler does." After this line the data is fully typed as RawLectionary and
 * no `any` ever appears.
 */
const YEAR_ONE = yearOneData as unknown as RawLectionary;
const YEAR_TWO = yearTwoData as unknown as RawLectionary;

/** Pick the correct year's data. A plain mapping keeps the union exhaustive. */
function selectLectionary(year: LectionaryYear): RawLectionary {
  return year === "Year One" ? YEAR_ONE : YEAR_TWO;
}

/**
 * Find the single office matching a resolved liturgical day.
 *
 * Matching strategy, in order:
 *   1. Exact: season + week + dayKey.
 *   2. Fixed-date fallback: season + dayKey (some Christmas/Epiphany offices
 *      omit/repeat week labels).
 * Returns null when nothing matches — the caller renders an error state rather
 * than guessing. Returning `RawOffice | null` (not `RawOffice`) forces callers
 * to handle the miss; that's strictNullChecks doing its job.
 */
export function findOffice(day: LiturgicalDay): RawOffice | null {
  const offices = selectLectionary(day.year);

  const exact = offices.find(
    (o) =>
      o.season === day.season &&
      o.week === day.week &&
      o.day === day.dayKey,
  );
  if (exact) return exact;

  const byDate = offices.find(
    (o) => o.season === day.season && o.day === day.dayKey,
  );
  return byDate ?? null;
}

/**
 * Normalize a raw lectionary reference for display/lookup. The source uses an
 * en-dash (–) in ranges and BCP "(optional)" / "[alternate]" lengthening marks;
 * we strip those so they don't confuse the ESV query later.
 */
function cleanReference(raw: string): string {
  return raw
    .replace(/[–—]/g, "-") // en/em dash -> hyphen
    .replace(/[()[\]]/g, "") // drop optional/alternate brackets
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Flatten an office into ordered reading references for one time of prayer.
 *
 * Order matters liturgically and for the UI: psalms first, then the lessons in
 * canonical order (first → second → third → gospel). We honor the `alt*` fields
 * by preferring the base reading and only falling back to the alternate when the
 * base is missing.
 */
export function getReadingRefs(
  office: RawOffice,
  time: OfficeTime,
): ReadingRef[] {
  const refs: ReadingRef[] = [];

  // --- Psalms (split by time of prayer in the data) ---
  // Phase 1 supports morning + evening psalms; other times fall back to morning.
  const psalmList =
    time === "evening" ? office.psalms.evening : office.psalms.morning;
  for (const psalm of psalmList ?? []) {
    refs.push({ role: "psalm", rawReference: `Psalm ${cleanReference(psalm)}` });
  }

  // --- Lessons ---
  // A few special offices nest lessons under morning/evening; prefer those when
  // present for the requested time, otherwise use the shared lesson pool.
  const nested =
    time === "evening" ? office.lessons.evening : office.lessons.morning;
  if (nested) {
    if (nested.first) refs.push({ role: "first", rawReference: cleanReference(nested.first) });
    if (nested.second) refs.push({ role: "second", rawReference: cleanReference(nested.second) });
    return refs;
  }

  const { lessons } = office;
  const first = lessons.first ?? lessons.altFirst;
  const second = lessons.second ?? lessons.altSecond;
  const gospel = lessons.gospel ?? lessons.altGospel;

  if (first) refs.push({ role: "first", rawReference: cleanReference(first) });
  if (second) refs.push({ role: "second", rawReference: cleanReference(second) });
  if (lessons.third) refs.push({ role: "third", rawReference: cleanReference(lessons.third) });
  if (gospel) refs.push({ role: "gospel", rawReference: cleanReference(gospel) });

  return refs;
}

/**
 * Convenience result bundling the resolved day, its title, and reading refs —
 * everything the page needs BEFORE fetching scripture text.
 */
export interface DayPlan {
  day: LiturgicalDay;
  office: OfficeTime;
  title: string | null;
  refs: ReadingRef[];
}

/**
 * Build the full plan for a liturgical day + time of prayer, or null if the day
 * can't be found in the lectionary.
 */
export function getDayPlan(
  day: LiturgicalDay,
  time: OfficeTime = "morning",
): DayPlan | null {
  const office = findOffice(day);
  if (!office) return null;
  return {
    day,
    office: time,
    title: office.title ?? null,
    refs: getReadingRefs(office, time),
  };
}
