import { cookies } from "next/headers";
import { getReadingRefs, getTodayIsoDate } from "@/lib/breadOffice";
import { fetchReadings } from "@/lib/scripture";
import { ReadingList } from "@/components/ReadingList";
import { TranslationPicker } from "@/components/TranslationPicker";
import { VerseNumberToggle } from "@/components/VerseNumberToggle";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  VERSE_NUMBERS_COOKIE,
  parseVerseNumbersPref,
  THEME_COOKIE,
  parseThemePref,
} from "@/lib/preferences";
import type { Translation } from "@/types";

// Always render from live data — one day's readings change at midnight.
export const dynamic = "force-dynamic";

const COPYRIGHTS: Record<Translation, string> = {
  NIV: "Scripture taken from the Holy Bible, NIV®. © 1973–2011 Biblica, Inc.™ Used by permission of Zondervan.",
  NLT: "Scripture quotations taken from the Holy Bible, New Living Translation, © 1996–2015 Tyndale House Foundation.",
  MSG: "Scripture taken from THE MESSAGE. © 1993–2018 by Eugene H. Peterson. Used by permission of NavPress.",
};

function getTranslation(): Translation {
  const raw = cookies().get("translation")?.value;
  return raw === "NLT" || raw === "MSG" ? raw : "NIV";
}

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// DEV-ONLY review affordance: `?date=YYYY-MM-DD` jumps to any day's readings so
// non-contiguous passages (gap markers) can be eyeballed without waiting for the
// calendar to land on one. Gated to non-production so the LIVE site always reads
// the real today; the override stays available in local dev.
function resolveDate(searchParams: { date?: string }): string {
  const override =
    process.env.NODE_ENV !== "production" ? searchParams.date : undefined;
  return override && /^\d{4}-\d{2}-\d{2}$/.test(override)
    ? override
    : getTodayIsoDate();
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  const translation = getTranslation();
  // Verse numbers are hidden by default; the cookie (written client-side by the
  // toggle) drives the initial SSR class so the preference survives reload.
  const showVerseNumbers = parseVerseNumbersPref(
    cookies().get(VERSE_NUMBERS_COOKIE)?.value,
  );
  // Theme defaults to "system"; the inline <head> script (app/layout.tsx) owns
  // the pre-paint class, so this only seeds ThemeToggle's initial active segment.
  const themeMode = parseThemePref(cookies().get(THEME_COOKIE)?.value);
  const mainClass = `container max-w-2xl py-10${
    showVerseNumbers ? " show-verse-numbers" : ""
  }`;
  const today = resolveDate(searchParams);
  const day = getReadingRefs(today);

  if (!day) {
    return (
      <main className={mainClass}>
        <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Daily Devotional
            </p>
            <h1 className="font-serif text-3xl font-semibold tracking-tight">
              {formatDate(today)}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle initial={themeMode} />
            <span className="h-5 w-px bg-border" aria-hidden="true" />
            <VerseNumberToggle initial={showVerseNumbers} />
            <span className="h-5 w-px bg-border" aria-hidden="true" />
            <TranslationPicker activeTranslation={translation} />
          </div>
        </header>
        <Alert className="mt-8">
          <AlertTitle>No reading for today</AlertTitle>
          <AlertDescription>
            Today ({today}) doesn&apos;t have a reading in the Bridgetown BREAD 2026
            plan.
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  const readings = await fetchReadings(day.refs, translation);

  return (
    <main className={mainClass}>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Daily Devotional · Bridgetown BREAD 2026
          </p>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            {formatDate(today)}
          </h1>
          {day.feast && (
            <p className="mt-1 font-serif text-lg italic text-amber-600 dark:text-amber-400">
              Feast Day
            </p>
          )}
          {day.fast && (
            <p className="mt-1 font-serif text-lg italic text-muted-foreground">
              Fast Day
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle initial={themeMode} />
          <span className="h-5 w-px bg-border" aria-hidden="true" />
          <VerseNumberToggle initial={showVerseNumbers} />
          <span className="h-5 w-px bg-border" aria-hidden="true" />
          <TranslationPicker activeTranslation={translation} />
        </div>
      </header>

      <div className="mt-8">
        <ReadingList readings={readings} />
      </div>

      <footer className="mt-12 border-t pt-6 text-xs text-muted-foreground">
        {COPYRIGHTS[translation]} Lectionary from the Bridgetown Church BREAD 2026
        plan. For personal, non-commercial use.
      </footer>
    </main>
  );
}
