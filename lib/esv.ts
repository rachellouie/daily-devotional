/**
 * lib/esv.ts — fetches scripture text from the ESV API (api.esv.org).
 *
 * SERVER-ONLY. This module reads `process.env.ESV_API_KEY`, which has no
 * NEXT_PUBLIC_ prefix and therefore is never bundled into client JS. Because
 * page.tsx is a Server Component, these functions run on the server and the key
 * stays on the server — the browser only ever receives the rendered passage text.
 * (This is one of the concrete wins of the App Router; see app/page.tsx.)
 *
 * Verified response shape (checked against the live API before writing this):
 *   200 -> { query, canonical, passages: string[] }
 *   403 -> { detail: "Authentication credentials were not provided." }
 */
import "server-only"; // build-time guard: importing this from a Client Component errors.
import type {
  EsvPassageResponse,
  Reading,
  ReadingRef,
  Translation,
} from "@/types";

const ESV_ENDPOINT = "https://api.esv.org/v3/passage/text/";
const TRANSLATION: Translation = "ESV"; // Phase 1 is ESV-only.

/**
 * Thrown when the API key is missing/blank. It's a CONFIG problem (not a
 * per-reading hiccup), so we surface it loudly and let the page's error boundary
 * render a helpful message instead of silently showing empty passages.
 *
 * Extending the built-in Error and setting `name` is the idiomatic way to make a
 * custom error type that survives `instanceof` checks.
 */
export class EsvConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EsvConfigError";
  }
}

/** Read + validate the key once per call site. */
function getApiKey(): string {
  const key = process.env.ESV_API_KEY;
  if (!key || key.trim().length === 0) {
    throw new EsvConfigError(
      "ESV_API_KEY is not set. Copy .env.local.example to .env.local and add your key from https://api.esv.org/.",
    );
  }
  return key;
}

/**
 * Query-string flags for the text endpoint. We keep verse numbers (useful for a
 * study app) but strip headings/footnotes/copyright so we control presentation.
 */
function buildUrl(reference: string): string {
  const params = new URLSearchParams({
    q: reference,
    "include-passage-references": "false",
    "include-verse-numbers": "true",
    "include-first-verse-numbers": "true",
    "include-footnotes": "false",
    "include-headings": "false",
    "include-short-copyright": "false",
    "include-passage-horizontal-lines": "false",
    "include-heading-horizontal-lines": "false",
  });
  return `${ESV_ENDPOINT}?${params.toString()}`;
}

/**
 * Fetch the text for a single reference. Returns `{ canonical, text }` on
 * success, or null if the passage couldn't be fetched/parsed (a per-reading
 * failure that should degrade gracefully, NOT take down the whole page).
 *
 * Note the explicit `Promise<...>` return type — annotating async return types
 * is a small habit that makes the contract obvious and catches mistakes inside
 * the function body.
 */
async function fetchPassageText(
  reference: string,
  apiKey: string,
): Promise<{ canonical: string; text: string } | null> {
  try {
    const res = await fetch(buildUrl(reference), {
      headers: { Authorization: `Token ${apiKey}` },
      // Lectionary readings for a given date never change, so cache for a day.
      // This also keeps us well under ESV's rate limits.
      next: { revalidate: 60 * 60 * 24 },
    });

    if (!res.ok) {
      // 401/403 with a present key usually means a bad key — worth flagging.
      if (res.status === 401 || res.status === 403) {
        throw new EsvConfigError(
          `ESV API rejected the request (${res.status}). Check that ESV_API_KEY is valid.`,
        );
      }
      return null;
    }

    // `as EsvPassageResponse` narrows the untyped JSON to our modeled subset.
    const data = (await res.json()) as EsvPassageResponse;
    const text = data.passages.map((p) => p.trim()).join("\n\n").trim();
    if (text.length === 0) return null;
    return { canonical: data.canonical, text };
  } catch (err) {
    // Re-throw config errors (caller wants to know); swallow transient ones.
    if (err instanceof EsvConfigError) throw err;
    return null;
  }
}

/**
 * Turn one ReadingRef into a fully-populated Reading by fetching its text.
 * On a non-config failure, `text` is null and the UI shows a friendly fallback.
 */
async function resolveReading(
  ref: ReadingRef,
  index: number,
  apiKey: string,
): Promise<Reading> {
  const result = await fetchPassageText(ref.rawReference, apiKey);
  return {
    id: `${ref.role}-${index}-${ref.rawReference}`,
    role: ref.role,
    rawReference: ref.rawReference,
    reference: result?.canonical ?? ref.rawReference,
    text: result?.text ?? null,
    translation: TRANSLATION,
  };
}

/**
 * Fetch all readings for a day in parallel.
 *
 * `Promise.all` issues every request at once and resolves when all finish —
 * far faster than awaiting them in a loop. A missing API key throws before any
 * request goes out (fail fast); individual passage failures resolve to a
 * text-less Reading rather than rejecting the whole batch.
 */
export async function fetchReadings(refs: ReadingRef[]): Promise<Reading[]> {
  const apiKey = getApiKey();
  return Promise.all(refs.map((ref, i) => resolveReading(ref, i, apiKey)));
}
