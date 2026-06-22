import "server-only";
import type { Reading, ReadingRef, ReadingSegment, Translation } from "@/types";

const BIBLE_IDS: Record<Translation, string> = {
  NIV: "78a9f6124f344018-01",
  NLT: "d6e14a625393b4da-01",
  MSG: "6f11a7de016f942e-01",
};

const API_BASE = "https://api.scripture.api.bible/v1";

export class ScriptureConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScriptureConfigError";
  }
}

function getApiKey(): string {
  const key = process.env.APIBIBLE_API_KEY;
  if (!key || key.trim().length === 0) {
    throw new ScriptureConfigError(
      "APIBIBLE_API_KEY is not set. Copy .env.local.example to .env.local and add your key from scripture.api.bible.",
    );
  }
  return key;
}

// ─── USFM reference converter ───────────────────────────────────────────────

interface BookEntry {
  name: string;
  usfm: string;
  singleChapter?: true;
}

// Longer / more-specific names first to prevent prefix conflicts.
// Both full names and abbreviations are listed (the BREAD data mixes them).
const BOOKS: BookEntry[] = [
  { name: "1 Corinthians", usfm: "1CO" },
  { name: "2 Corinthians", usfm: "2CO" },
  { name: "1 Thessalonians", usfm: "1TH" },
  { name: "2 Thessalonians", usfm: "2TH" },
  { name: "1 Timothy", usfm: "1TI" },
  { name: "2 Timothy", usfm: "2TI" },
  { name: "1 Samuel", usfm: "1SA" },
  { name: "2 Samuel", usfm: "2SA" },
  { name: "1 Kings", usfm: "1KI" },
  { name: "2 Kings", usfm: "2KI" },
  { name: "1 Peter", usfm: "1PE" },
  { name: "2 Peter", usfm: "2PE" },
  { name: "1 John", usfm: "1JN" },
  { name: "2 John", usfm: "2JN", singleChapter: true },
  { name: "3 John", usfm: "3JN", singleChapter: true },
  { name: "1 Cor.", usfm: "1CO" },
  { name: "2 Cor.", usfm: "2CO" },
  { name: "1 Thes.", usfm: "1TH" },
  { name: "2 Thes.", usfm: "2TH" },
  { name: "Deuteronomy", usfm: "DEU" },
  { name: "Ecclesiastes", usfm: "ECC" },
  { name: "Lamentations", usfm: "LAM" },
  { name: "Revelation", usfm: "REV" },
  { name: "Colossians", usfm: "COL" },
  { name: "Philippians", usfm: "PHP" },
  { name: "Ephesians", usfm: "EPH" },
  { name: "Galatians", usfm: "GAL" },
  { name: "Zechariah", usfm: "ZEC" },
  { name: "Habakkuk", usfm: "HAB" },
  { name: "Proverbs", usfm: "PRO" },
  { name: "Leviticus", usfm: "LEV" },
  { name: "Hebrews", usfm: "HEB" },
  { name: "Numbers", usfm: "NUM" },
  { name: "Matthew", usfm: "MAT" },
  { name: "Ezekiel", usfm: "EZK" },
  { name: "Jeremiah", usfm: "JER" },
  { name: "Genesis", usfm: "GEN" },
  { name: "Malachi", usfm: "MAL" },
  { name: "Joshua", usfm: "JOS" },
  { name: "Judges", usfm: "JDG" },
  { name: "Isaiah", usfm: "ISA" },
  { name: "Daniel", usfm: "DAN" },
  { name: "Romans", usfm: "ROM" },
  { name: "Esther", usfm: "EST" },
  { name: "Exodus", usfm: "EXO" },
  { name: "Lam.", usfm: "LAM" },
  { name: "Titus", usfm: "TIT" },
  { name: "James", usfm: "JAS" },
  { name: "Hosea", usfm: "HOS" },
  { name: "Micah", usfm: "MIC" },
  { name: "Psalm", usfm: "PSA" },
  { name: "Jonah", usfm: "JON" },
  { name: "Amos", usfm: "AMO" },
  { name: "Joel", usfm: "JOL" },
  { name: "Acts", usfm: "ACT" },
  { name: "Luke", usfm: "LUK" },
  { name: "Mark", usfm: "MRK" },
  { name: "Jude", usfm: "JUD", singleChapter: true },
  { name: "John", usfm: "JHN" },
  { name: "Job", usfm: "JOB" },
];

// Sorted longest-first at module load so prefix matching is unambiguous.
const BOOKS_SORTED = [...BOOKS].sort((a, b) => b.name.length - a.name.length);

// Reverse USFM → display name, preferring the longest (full) name when several
// spellings share a code ("Lam." and "Lamentations" both → LAM; we keep the
// full one). Used to render a human reference for a span whose fetch failed.
const USFM_TO_NAME: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const entry of BOOKS) {
    const existing = map[entry.usfm];
    if (!existing || entry.name.length > existing.length) map[entry.usfm] = entry.name;
  }
  return map;
})();

/**
 * Render a passage ID back to a human-readable reference, for the fallback case
 * where a span's fetch failed and there is no API canonical to show.
 * "LAM.3.1-LAM.3.9" → "Lamentations 3:1-9"; "PSA.103" → "Psalm 103".
 * Collapses a same-book/same-chapter range to "3:1-9" rather than "3:1-3:9".
 */
function passageIdToReference(passageId: string): string {
  const point = (p: string): { book: string; chapter: string; verse?: string } => {
    const [usfm, chapter, verse] = p.split(".");
    return { book: USFM_TO_NAME[usfm ?? ""] ?? (usfm ?? ""), chapter: chapter ?? "", verse };
  };
  const fmt = (pt: ReturnType<typeof point>) =>
    pt.verse ? `${pt.book} ${pt.chapter}:${pt.verse}` : `${pt.book} ${pt.chapter}`;

  const [startId, endId] = passageId.split("-");
  const start = point(startId ?? passageId);
  if (!endId) return fmt(start);

  const end = point(endId);
  // Same book + chapter → "Lamentations 3:1-9"; cross-chapter → ".. 3:1-4:7".
  if (start.book === end.book && start.chapter === end.chapter && start.verse && end.verse) {
    return `${start.book} ${start.chapter}:${start.verse}-${end.verse}`;
  }
  if (start.book === end.book) {
    return `${fmt(start)}-${end.chapter}${end.verse ? `:${end.verse}` : ""}`;
  }
  return `${fmt(start)}-${fmt(end)}`;
}

/**
 * Render the FULL set of passage IDs for one reading back to a single
 * human-readable heading, collapsing shared book/chapter the way the lectionary
 * writes it:
 *   ["NUM.13.1-NUM.13.3","NUM.13.21-NUM.13.30"] → "Numbers 13:1-3, 21-30"
 *   ["JOB.22.1-JOB.22.4","JOB.22.21-JOB.23.7"]  → "Job 22:1-4, 21-23:7"
 *   ["PSA.32"]                                   → "Psalm 32"
 *
 * Derived from our parsed IDs rather than the API canonical, so the heading is
 * stable even when a span's fetch fails, and a whole-chapter id collapses to a
 * bare chapter (the API would expand "PSA.32" to "Psalm 32:1-11"). The book is
 * shown once; a trailing span shows its chapter only when the chapter changed
 * from where the previous span ended — matching how a reader reads "…, 19-33"
 * (same chapter) versus "…, 3:1-6" (new chapter).
 */
export function passageIdsToReference(passageIds: string[]): string {
  interface Span {
    book: string;
    startCh: number;
    startV?: number;
    endCh: number;
    endV?: number;
  }

  const parse = (id: string): Span => {
    const [startId, endId] = id.split("-");
    const [usfm, sC, sV] = (startId ?? id).split(".");
    const book = USFM_TO_NAME[usfm ?? ""] ?? usfm ?? "";
    const startCh = Number.parseInt(sC ?? "", 10);
    const startV = sV !== undefined ? Number.parseInt(sV, 10) : undefined;
    if (!endId) return { book, startCh, startV, endCh: startCh, endV: startV };
    const [, eC, eV] = endId.split(".");
    return {
      book,
      startCh,
      startV,
      endCh: Number.parseInt(eC ?? "", 10),
      endV: eV !== undefined ? Number.parseInt(eV, 10) : undefined,
    };
  };

  const formatSpan = (s: Span, showBook: boolean, showChapter: boolean): string => {
    const prefix = showBook ? `${s.book} ` : "";
    // Whole chapter (no verses): "Psalm 32".
    if (s.startV === undefined) return `${prefix}${s.startCh}`;
    const start = showChapter ? `${s.startCh}:${s.startV}` : `${s.startV}`;
    // Single verse, or a range that collapses to one verse.
    if (s.endV === undefined || (s.endCh === s.startCh && s.endV === s.startV)) {
      return `${prefix}${start}`;
    }
    // Same-chapter range → "1-3"; cross-chapter range → "21-23:7".
    const end = s.endCh === s.startCh ? `${s.endV}` : `${s.endCh}:${s.endV}`;
    return `${prefix}${start}-${end}`;
  };

  let prevEndCh = -1;
  const parts = passageIds.map((id, i) => {
    const s = parse(id);
    const part = formatSpan(s, i === 0, i === 0 || s.startCh !== prevEndCh);
    prevEndCh = s.endCh;
    return part;
  });
  return parts.join(", ");
}

// ─── Multi-segment USFM converter ────────────────────────────────────────────

/** Parsed endpoint of a span: an explicit or inherited chapter + verse. */
interface VersePoint {
  chapter: number;
  verse: number;
}

/**
 * Parse a single comma-separated segment into one USFM passage ID, threading the
 * book and an inherited chapter context. Returns the ID plus the chapter the
 * segment *ended* in, so the next segment can inherit it (the lectionary writes
 * trailing spans bare, e.g. `…, 19-33` meaning "verses 19-33 of the chapter the
 * previous span ended in").
 *
 * `ctxChapter` is the chapter to fall back to when a segment omits its chapter
 * (null for the first segment of a normal book). `isFirst` distinguishes a bare
 * number that means a whole CHAPTER ("Psalm 103") from a trailing bare number
 * that means a VERSE ("…, 13").
 */
function parseSegment(
  seg: string,
  usfm: string,
  singleChapter: boolean,
  ctxChapter: number | null,
  isFirst: boolean,
): { passageId: string; endChapter: number } | null {
  // Drop part-verse markers (33a / 27b) → whole verse. The half-verse trim is a
  // presentation concern handled later against the fetched text, not here.
  const cleaned = seg.replace(/(\d+)[ab]\b/g, "$1");

  const hasColon = cleaned.includes(":");
  const dashIdx = cleaned.indexOf("-");
  const hasDash = dashIdx !== -1;

  // First bare number on a normal book is a WHOLE CHAPTER ("Psalm 103").
  // (Single-chapter books like Jude never take this path — their bare numbers
  // are verses.) No multi-chapter whole ranges exist in the data, so a lone
  // chapter is the only no-colon first-segment shape for normal books.
  if (!hasColon && isFirst && !singleChapter && !hasDash) {
    const chapter = Number.parseInt(cleaned, 10);
    if (Number.isNaN(chapter)) return null;
    return { passageId: `${usfm}.${chapter}`, endChapter: chapter };
  }

  // A single-chapter book's verses live in chapter 1; otherwise inherit context.
  const startCtx = singleChapter ? 1 : ctxChapter;

  // Parse "ch:v" (explicit chapter) or bare "v" (inherits `fallback`).
  const endpoint = (token: string, fallback: number | null): VersePoint | null => {
    if (token.includes(":")) {
      const [c, v] = token.split(":");
      const chapter = Number.parseInt(c ?? "", 10);
      const verse = Number.parseInt(v ?? "", 10);
      if (Number.isNaN(chapter) || Number.isNaN(verse)) return null;
      return { chapter, verse };
    }
    const verse = Number.parseInt(token, 10);
    if (Number.isNaN(verse) || fallback == null) return null;
    return { chapter: fallback, verse };
  };

  if (!hasDash) {
    // Single verse/point: "62:1" or trailing "13".
    const pt = endpoint(cleaned, startCtx);
    if (!pt) return null;
    return { passageId: `${usfm}.${pt.chapter}.${pt.verse}`, endChapter: pt.chapter };
  }

  const left = endpoint(cleaned.slice(0, dashIdx).trim(), startCtx);
  if (!left) return null;
  // The right endpoint inherits the LEFT's chapter when it omits one
  // ("62:1-12" → end verse 12 is in ch.62).
  const right = endpoint(cleaned.slice(dashIdx + 1).trim(), left.chapter);
  if (!right) return null;

  return {
    passageId: `${usfm}.${left.chapter}.${left.verse}-${usfm}.${right.chapter}.${right.verse}`,
    endChapter: right.chapter,
  };
}

/**
 * Convert a human-readable reference into one USFM passage ID **per contiguous
 * span**. A normal contiguous ref yields a one-element array; a non-contiguous
 * ref (`Lam. 3:1-9, 19-33`) yields one ID per comma-separated span, with book +
 * chapter context threaded forward. Returns null when the book is unrecognised
 * or no segment parses. Unparseable individual segments are dropped with a warn
 * (a safety net — the live 2026 data has none).
 */
export function toPassageIds(rawRef: string): string[] | null {
  // Normalize: en/em dash → hyphen; restore a missing space after an abbreviated
  // period ("1 Cor.7" → "1 Cor. 7"). The no-dot no-space case ("Ephesians4") is
  // handled by the book-boundary rule below.
  const normalized = rawRef.replace(/[–—]/g, "-").replace(/\.(\d)/, ". $1");

  let usfm = "";
  let singleChapter = false;
  let remainder = "";

  for (const entry of BOOKS_SORTED) {
    if (!normalized.startsWith(entry.name)) continue;
    const after = normalized.slice(entry.name.length);
    // The book name must end at a non-letter boundary so "John" doesn't swallow
    // "Jonah" and "Psalm" doesn't match "Psalms". A digit boundary is allowed so
    // a missing space ("Ephesians4") still resolves.
    if (after.length > 0 && /^[A-Za-z]/.test(after)) continue;
    usfm = entry.usfm;
    singleChapter = entry.singleChapter ?? false;
    remainder = after.trimStart();
    break;
  }

  if (!usfm || !remainder) return null;

  const segments = remainder
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  let ctxChapter: number | null = null;
  const ids: string[] = [];

  segments.forEach((seg, i) => {
    const parsed = parseSegment(seg, usfm, singleChapter, ctxChapter, i === 0);
    if (!parsed) {
      console.warn(`[scripture] dropped unparseable segment "${seg}" in "${rawRef}"`);
      return;
    }
    ids.push(parsed.passageId);
    ctxChapter = parsed.endChapter;
  });

  return ids.length > 0 ? ids : null;
}

// ─── API fetch ───────────────────────────────────────────────────────────────

/**
 * Fetch ONE contiguous passage ID. Returns the canonical reference + text, or
 * null on a graceful miss (non-2xx other than auth, empty body, network error).
 * A 401/403 is a configuration error and is thrown — it isn't per-passage.
 */
async function fetchSegment(
  passageId: string,
  translation: Translation,
  apiKey: string,
): Promise<{ canonical: string; text: string } | null> {
  const bibleId = BIBLE_IDS[translation];
  // We fetch structured HTML (not plain text) so verse numbers, chapter markers,
  // and poetry come back as styleable elements (span.v, h2.c, p.q1/q2/p) that the
  // reader can subtly style and toggle. include-chapter-numbers surfaces the
  // h2.c divider the API emits at a chapter boundary within a cross-chapter span.
  //
  // SECURITY NOTE: this HTML is injected via dangerouslySetInnerHTML in
  // ReadingCard WITHOUT sanitization. That is a deliberate, documented decision
  // (see specs/scripture-html-rendering.md): no user input reaches this path —
  // passage IDs are generated by us from the bundled lectionary and fetched
  // server-side over TLS from a single fixed vendor (API.Bible). The only route
  // to malicious markup is the vendor/CDN being compromised or a TLS MITM, and
  // even then <script> does not execute via dangerouslySetInnerHTML. CSP is the
  // noted future hardening lever if the threat model ever changes.
  const params = new URLSearchParams({
    "content-type": "html",
    "include-verse-numbers": "true",
    "include-titles": "false",
    "include-chapter-numbers": "true",
  });

  const url = `${API_BASE}/bibles/${bibleId}/passages/${encodeURIComponent(passageId)}?${params}`;

  try {
    const res = await fetch(url, {
      headers: { "api-key": apiKey },
      // Passage text for a given date never changes; cache aggressively.
      next: { revalidate: 60 * 60 * 24 },
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        throw new ScriptureConfigError(
          `API.Bible rejected the request (${res.status}). Check APIBIBLE_API_KEY.`,
        );
      }
      return null;
    }

    const data = (await res.json()) as {
      data: { content: string; reference: string; copyright: string };
    };
    const text = data.data.content.trim();
    if (!text) return null;
    return { canonical: data.data.reference, text };
  } catch (err) {
    if (err instanceof ScriptureConfigError) throw err;
    return null;
  }
}

async function resolveReading(
  ref: ReadingRef,
  index: number,
  translation: Translation,
  apiKey: string,
): Promise<Reading> {
  const passageIds = toPassageIds(ref.rawReference);

  // Unparseable reference: no IDs to fetch. Still surface ONE segment carrying
  // the raw reference so the card shows something the reader can look up.
  if (!passageIds) {
    return {
      id: `${ref.role}-${index}-${ref.rawReference}`,
      role: ref.role,
      rawReference: ref.rawReference,
      reference: ref.rawReference,
      segments: [{ reference: ref.rawReference, text: null }],
      translation,
    };
  }

  // Fetch every span in parallel, then stitch in order.
  const results = await Promise.all(
    passageIds.map((id) => fetchSegment(id, translation, apiKey)),
  );

  const segments: ReadingSegment[] = results.map((result, i) => ({
    // On success the API canonical; on failure derive a human ref from the ID so
    // the span's reference still renders (AC 11).
    reference: result?.canonical ?? passageIdToReference(passageIds[i]!),
    text: result?.text ?? null,
  }));

  return {
    id: `${ref.role}-${index}-${ref.rawReference}`,
    role: ref.role,
    rawReference: ref.rawReference,
    // Heading reflects EVERY span (collapsed), derived from our IDs so it's
    // stable even when a fetch fails and whole chapters read as "Psalm 32".
    reference: passageIdsToReference(passageIds),
    segments,
    translation,
  };
}

export async function fetchReadings(
  refs: ReadingRef[],
  translation: Translation,
): Promise<Reading[]> {
  const apiKey = getApiKey();
  return Promise.all(
    refs.map((ref, i) => resolveReading(ref, i, translation, apiKey)),
  );
}
