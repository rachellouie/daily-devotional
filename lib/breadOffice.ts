import "server-only";
import rawBreadData from "@/data/bread-2026.json";
import type { ReadingRef } from "@/types";

interface BreadEntry {
  readings: string[];
  feast: boolean;
  fast: boolean;
}

const breadData = rawBreadData as Record<string, BreadEntry>;

const ROLES: ReadingRef["role"][] = ["psalm", "first", "second", "gospel"];

export interface BreadDay {
  refs: ReadingRef[];
  feast: boolean;
  fast: boolean;
}

export function getReadingRefs(isoDate: string): BreadDay | null {
  const entry = breadData[isoDate];
  if (!entry) return null;

  const refs: ReadingRef[] = entry.readings.map((rawReference, i) => ({
    role: ROLES[i] ?? "first",
    rawReference,
  }));

  return { refs, feast: entry.feast, fast: entry.fast };
}

/**
 * Today's date as `YYYY-MM-DD`, anchored to a given IANA timezone rather than the
 * server's clock. The server runs in UTC (e.g. on Vercel), so formatting in the
 * reader's zone is what makes the reading roll over at THEIR local midnight — not
 * at UTC midnight, which on the US East Coast is ~8 PM the previous evening.
 *
 * `en-CA` is used purely because its date format is ISO `YYYY-MM-DD`. `now` is
 * injectable so the zone boundary can be tested at a fixed instant.
 */
export function getTodayIsoDate(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
