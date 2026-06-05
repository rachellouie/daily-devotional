/**
 * lib/utils.ts — small, dependency-light shared helpers.
 *
 * `cn` is the shadcn/ui convention for merging Tailwind class names; every
 * generated UI component imports it. The date helpers live here so formatting
 * is consistent across DayHeader and anywhere else dates surface.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge class names, with later Tailwind utilities winning over earlier ones.
 * `clsx` handles conditional/array/object inputs; `twMerge` resolves Tailwind
 * conflicts (e.g. "p-2" + "p-4" -> "p-4" instead of both).
 *
 * `...inputs: ClassValue[]` is a typed rest parameter — any number of class
 * arguments, each typed as clsx's ClassValue.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format a Date as a long, human-readable string, e.g. "Monday, June 1, 2026".
 * Uses Intl, which is built into the runtime — no date library needed for this.
 */
export function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

/**
 * Convert any Date to a YYYY-MM-DD string in LOCAL time.
 *
 * We intentionally avoid `.toISOString()` here: that converts to UTC first, so
 * for users west of UTC it can roll back to "yesterday" near midnight — exactly
 * the kind of off-by-one-day bug that's miserable in a date-driven app.
 *
 * The return type `\`${number}-${number}-${number}\`` is a TEMPLATE LITERAL
 * TYPE: it constrains the string's shape at the type level, not just `string`.
 */
export function toLocalISODate(
  date: Date,
): `${number}-${number}-${number}` {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  // The cast is safe because we just built the string in this exact shape.
  return `${y}-${m}-${d}` as `${number}-${number}-${number}`;
}

/** Strip the time component so date math compares calendar days, not instants. */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Add (or subtract, with a negative count) whole days to a date immutably. */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
