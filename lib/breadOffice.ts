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

export function getTodayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}
