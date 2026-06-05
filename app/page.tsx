/**
 * app/page.tsx — the home page. An ASYNC SERVER COMPONENT.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS IS BETTER THAN THE OLD pages/ ROUTER
 * ─────────────────────────────────────────────────────────────────────────
 * In the old Pages Router you'd fetch in `getServerSideProps`, serialize the
 * result to JSON, ship it to the client, and re-hydrate it into a component.
 * Data fetching lived in a separate function from the component that used it.
 *
 * In the App Router the component IS the data fetch. Because this function is
 * `async` and runs on the server, we can simply `await` our data inline. The
 * benefits, concretely for this app:
 *
 *   1. The ESV_API_KEY and the fetch happen on the SERVER. The browser receives
 *      only rendered HTML — the key and even the ESV endpoint never ship to the
 *      client. (Contrast with a `useEffect` fetch, which would expose the key.)
 *   2. No client-side data-fetching waterfall, no loading spinner wiring, no
 *      useState/useEffect. Less JS shipped, faster first paint.
 *   3. `loading.tsx` and `error.tsx` (siblings of this file) are wired up
 *      automatically by the router via Suspense + error boundaries — we don't
 *      manage `isLoading`/`error` state by hand.
 *
 * Rule for this codebase: fetch in Server Components; reach for "use client" +
 * useEffect ONLY when you need interactivity or browser APIs (Phase 2: dark-mode
 * toggle, audio playback, saved preferences).
 */
import { resolveLiturgicalDay } from "@/lib/liturgicalCalendar";
import { getDayPlan } from "@/lib/dailyOffice";
import { fetchReadings } from "@/lib/esv";
import { DayHeader } from "@/components/DayHeader";
import { ReadingList } from "@/components/ReadingList";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

// Always render for the actual current date rather than caching one day's HTML
// forever. (Individual ESV passages are still cached for a day inside lib/esv.)
export const dynamic = "force-dynamic";

export default async function HomePage() {
  // 1. Where are we in the church year today?
  const today = new Date();
  const day = resolveLiturgicalDay(today);

  // 2. Which office + readings does the lectionary assign? (Phase 1: morning.)
  const plan = getDayPlan(day, "morning");

  // If the date couldn't be resolved to an office, show a clear empty state
  // instead of throwing — the rest of the page (date, season) is still useful.
  if (!plan) {
    return (
      <main className="container max-w-2xl py-10">
        <DayHeader day={day} title={null} office="morning" />
        <Alert className="mt-8">
          <AlertTitle>No reading found for today</AlertTitle>
          <AlertDescription>
            We resolved today as {day.seasonLabel}, {day.week}, {day.weekday},
            but couldn’t find a matching office in the bundled lectionary. This
            usually means a fixed-date holy day the Phase&nbsp;1 calendar engine
            doesn’t map yet.
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  // 3. Fetch the scripture text for every reading in parallel (server-side).
  //    A thrown EsvConfigError here bubbles to app/error.tsx.
  const readings = await fetchReadings(plan.refs);

  return (
    <main className="container max-w-2xl py-10">
      <DayHeader day={plan.day} title={plan.title} office={plan.office} />
      <div className="mt-8">
        <ReadingList readings={readings} />
      </div>
      <footer className="mt-12 border-t pt-6 text-xs text-muted-foreground">
        Scripture quotations are from the ESV® Bible, © Crossway. Lectionary data
        from the Book of Common Prayer (2019). For personal, non-commercial use.
      </footer>
    </main>
  );
}
