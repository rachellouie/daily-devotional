/**
 * app/loading.tsx — the LOADING UI for this route segment.
 *
 * The App Router renders this automatically (via React Suspense) while the async
 * Server Component in page.tsx is awaiting its data — specifically while the ESV
 * passages are being fetched. You don't import or trigger it; placing the file
 * here is the entire wiring. This replaces the manual `if (isLoading) return ...`
 * pattern from the Pages Router.
 *
 * It's a skeleton screen (layout-shaped placeholders) rather than a spinner,
 * which preserves the page's shape and feels faster.
 */
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="container max-w-2xl py-10">
      {/* Header placeholder */}
      <div className="space-y-3 border-b pb-6">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-24 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-9 w-72" />
      </div>

      {/* Reading-card placeholders */}
      <div className="mt-8 space-y-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-lg border p-6">
            <Skeleton className="mb-2 h-6 w-40" />
            <Skeleton className="mb-4 h-4 w-28" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
