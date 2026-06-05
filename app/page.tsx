import { cookies } from "next/headers";
import { getReadingRefs, getTodayIsoDate } from "@/lib/breadOffice";
import { fetchReadings } from "@/lib/scripture";
import { ReadingList } from "@/components/ReadingList";
import { TranslationPicker } from "@/components/TranslationPicker";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
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

export default async function HomePage() {
  const translation = getTranslation();
  const today = getTodayIsoDate();
  const day = getReadingRefs(today);

  if (!day) {
    return (
      <main className="container max-w-2xl py-10">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Daily Devotional
            </p>
            <h1 className="font-serif text-3xl font-semibold tracking-tight">
              {formatDate(today)}
            </h1>
          </div>
          <TranslationPicker activeTranslation={translation} />
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
    <main className="container max-w-2xl py-10">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Daily Devotional · Bridgetown BREAD 2026
          </p>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            {formatDate(today)}
          </h1>
          {day.feast && (
            <p className="mt-1 font-serif text-lg italic text-amber-600">
              Feast Day
            </p>
          )}
          {day.fast && (
            <p className="mt-1 font-serif text-lg italic text-muted-foreground">
              Fast Day
            </p>
          )}
        </div>
        <TranslationPicker activeTranslation={translation} />
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
