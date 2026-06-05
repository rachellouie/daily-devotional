/**
 * app/error.tsx — the ERROR BOUNDARY for this route segment.
 *
 * If the Server Component throws (e.g. EsvConfigError when the API key is
 * missing), the App Router catches it and renders this instead of a blank page.
 *
 * Two required conventions:
 *   • Error boundaries MUST be Client Components ("use client") — React error
 *     boundaries rely on client-side lifecycle. This is the one place in the
 *     happy path where "use client" is mandatory, not a choice.
 *   • The component receives `error` and a `reset()` callback to retry the
 *     segment without a full page reload.
 */
"use client";

import { useEffect } from "react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

// Next augments the thrown Error with an optional `digest` (a server-side hash
// used to correlate with server logs). We model that with an intersection type.
interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // In a real app you'd send this to your error tracker (Sentry, etc.).
    console.error(error);
  }, [error]);

  return (
    <main className="container max-w-2xl py-10">
      <Alert variant="destructive">
        <AlertTitle>Something went wrong loading today’s readings</AlertTitle>
        <AlertDescription className="space-y-3">
          <p>{error.message}</p>
          <button
            onClick={reset}
            className="rounded-md border border-current px-3 py-1 text-sm font-medium hover:bg-destructive/10"
          >
            Try again
          </button>
        </AlertDescription>
      </Alert>
    </main>
  );
}
