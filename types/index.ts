/**
 * types/index.ts — the single source of truth for every type in the app.
 *
 * Why one file? In a small app, co-locating types makes the domain model
 * legible at a glance and prevents circular imports. Every other module imports
 * FROM here and never defines its own duplicate shapes. (When the app grows,
 * you'd split this by domain — e.g. types/liturgy.ts, types/esv.ts.)
 *
 * This file is heavily commented because it doubles as a TypeScript study sheet.
 * Patterns demonstrated: union types, interfaces, optional properties, utility
 * types (Pick/Omit/Record), type aliases, and `as const` literal narrowing.
 */

/* ------------------------------------------------------------------ *
 * 1. LITERAL UNION TYPES
 *
 * A union type (`A | B | C`) says a value is exactly one of a fixed set.
 * Unlike a TS `enum`, a string-literal union has ZERO runtime footprint —
 * it compiles away entirely and is just plain strings at runtime. This is the
 * idiomatic way to model "one of these known strings" in modern TS.
 * ------------------------------------------------------------------ */

/** The two-year cycle of the BCP Daily Office Lectionary. */
export type LectionaryYear = "Year One" | "Year Two";

/** Liturgical seasons, exactly as they appear in the bundled JSON `season` field. */
export type LiturgicalSeason =
  | "Advent"
  | "Christmas"
  | "Epiphany"
  | "Lent"
  | "Easter"
  | "The Season after Pentecost";

/**
 * The offices (times of prayer). Phase 1 only renders "morning", but the type
 * already includes the others so future code is type-checked against the full
 * set the day it's added. Adding "compline" here later would immediately flag
 * every `switch` that forgot to handle it.
 */
export type OfficeTime = "morning" | "midday" | "evening" | "compline";

/**
 * Bible translations. ESV is the only one wired up in Phase 1; the others are
 * here so the translation-picker feature has a type to target. `as const`-style
 * unions like this pair naturally with exhaustive `switch` statements.
 */
export type Translation = "ESV" | "NIV" | "KJV" | "RSV";

/* ------------------------------------------------------------------ *
 * 2. RAW DATA SHAPES (what the bundled JSON literally contains)
 *
 * These interfaces describe the on-disk JSON from reubenlillie/daily-office.
 * We keep "raw" types separate from our cleaned-up "app" types so the messy
 * shape of an external data source never leaks into our UI components. The
 * parser in lib/dailyOffice.ts is the single boundary that converts Raw -> App.
 * ------------------------------------------------------------------ */

/**
 * The `lessons` object on a raw office. Note how many fields are OPTIONAL (`?`):
 * the lectionary doesn't specify every reading every day, and a few days nest
 * readings under morning/evening instead. Optional properties are `T | undefined`,
 * and because we set `noUncheckedIndexedAccess`, the compiler forces us to
 * handle the undefined case everywhere we touch them.
 */
export interface RawLessons {
  first?: string; // usually Hebrew Bible / Apocrypha, e.g. "Isa 1:1–9"
  altFirst?: string; // optional replacement for `first`
  second?: string; // usually an Epistle
  altSecond?: string;
  third?: string; // rare third reading
  gospel?: string; // e.g. "Matt 25:1–13"
  altGospel?: string;
  // A few special offices nest readings under a time of day instead:
  morning?: Partial<Record<"first" | "second", string>>;
  evening?: Partial<Record<"first" | "second", string>>;
}

/** Psalm references, split by office. Each entry is a reference string like "119:1–24". */
export interface RawPsalms {
  morning?: string[];
  evening?: string[];
}

/** One office object exactly as it appears in the JSON files. */
export interface RawOffice {
  year: LectionaryYear;
  season: LiturgicalSeason;
  week?: string; // e.g. "Week of 1 Advent", "Proper 4"; absent on a few special eves
  day: string; // weekday ("Monday") OR a fixed calendar date ("Dec 24")
  title?: string; // present on Sundays / holy days only
  psalms: RawPsalms;
  lessons: RawLessons;
  notes?: string;
}

/**
 * A whole lectionary file is just an array of offices.
 * Type ALIAS (vs interface): aliases can name any type, including arrays and
 * unions; interfaces can only describe object shapes. Rule of thumb used here:
 * `interface` for object shapes, `type` for unions/aliases/derived types.
 */
export type RawLectionary = RawOffice[];

/* ------------------------------------------------------------------ *
 * 3. APP-LEVEL DOMAIN TYPES (clean shapes our UI actually consumes)
 * ------------------------------------------------------------------ */

/**
 * The result of resolving a calendar date to its place in the church year.
 * lib/liturgicalCalendar.ts produces this; lib/dailyOffice.ts uses it as the
 * lookup key into the bundled JSON.
 */
export interface LiturgicalDay {
  /** The calendar date this was computed for, normalized to midnight local. */
  date: Date;
  year: LectionaryYear;
  season: LiturgicalSeason;
  /** Matches a RawOffice.week value, e.g. "Week of 2 Lent" or "Proper 4". */
  week: string;
  /** The real calendar weekday, e.g. "Monday" — used for display. */
  weekday: string;
  /**
   * The value to match against RawOffice.day when looking up the office.
   * Usually the weekday name ("Monday"), BUT during Christmas/Epiphany the
   * lectionary keys some offices by fixed calendar date instead ("Dec 25",
   * "Jan 6"). Keeping this separate from `weekday` makes that dual-keying
   * explicit instead of hidden.
   */
  dayKey: string;
  /** Human-friendly season label for the UI, e.g. "The Season after Pentecost". */
  seasonLabel: string;
}

/**
 * A single scripture reading AFTER we've fetched its text from ESV.
 * `role` lets the UI label it ("First Reading", "Gospel", "Psalm").
 */
export interface Reading {
  /** Stable id for React keys + future bookmarking. */
  id: string;
  role: ReadingRole;
  /** The canonical reference returned by ESV, e.g. "Ecclesiastes 2:1–15". */
  reference: string;
  /** The original reference string from the lectionary (abbreviated). */
  rawReference: string;
  /** Passage text from ESV, or null if it couldn't be fetched. */
  text: string | null;
  translation: Translation;
}

/** What kind of reading this is — drives the label and ordering in the UI. */
export type ReadingRole = "psalm" | "first" | "second" | "third" | "gospel";

/**
 * Everything the home page needs to render one day's morning prayer.
 * This is the top-level object page.tsx builds and hands to the components.
 */
export interface DailyOffice {
  day: LiturgicalDay;
  office: OfficeTime;
  title: string | null; // e.g. "The First Sunday of Advent", when present
  readings: Reading[];
}

/* ------------------------------------------------------------------ *
 * 4. ESV API TYPES
 * ------------------------------------------------------------------ */

/**
 * The slice of the ESV `/v3/passage/text/` JSON response we care about.
 * The real payload has more fields; we model only what we use. Modeling a
 * SUBSET like this is a deliberate, common pattern — you don't owe the compiler
 * a full mirror of someone else's API.
 */
export interface EsvPassageResponse {
  query: string;
  canonical: string;
  passages: string[]; // one string per passage; we join/take the first
}

/* ------------------------------------------------------------------ *
 * 5. UTILITY-TYPE DEMONSTRATIONS
 *
 * These show off TS "utility types" — generic helpers that transform other
 * types. They're real, used shapes, not throwaway examples.
 * ------------------------------------------------------------------ */

/**
 * `Omit<T, K>` — copy a type but drop some keys.
 * A Reading before its text has been fetched: identical to Reading minus the
 * fields that only exist post-fetch. Using Omit keeps this in lockstep with
 * Reading automatically — add a field to Reading and this updates for free.
 */
export type PendingReading = Omit<Reading, "text">;

/**
 * `Pick<T, K>` — the inverse: keep only some keys.
 * A compact reference used for the lectionary lookup and bookmarking, before
 * any ESV text exists.
 */
export type ReadingRef = Pick<Reading, "role" | "rawReference">;

/**
 * `Record<K, V>` — an object type with known keys K and uniform value type V.
 * Used to map each ReadingRole to its display label in one type-safe table;
 * if you add a role to the union, TS errors until you add its label here.
 */
export type ReadingRoleLabels = Record<ReadingRole, string>;

/**
 * A discriminated union for async results. The shared literal `status` field is
 * the "discriminant": once you check `result.status === "error"`, TS NARROWS the
 * type and knows `.error` exists (and `.data` does not). This is the safest way
 * to model loading/success/error without optional-field soup.
 */
export type AsyncResult<T> =
  | { status: "success"; data: T }
  | { status: "error"; error: string };
