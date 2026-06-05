import "server-only";
import type { Reading, ReadingRef, Translation } from "@/types";

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

/**
 * Convert a human-readable scripture reference (from bread-2026.json) to the
 * USFM passage ID that API.Bible expects, e.g. "Isaiah 62:1-12" → "ISA.62.1-ISA.62.12".
 * Returns null for unrecognised book names — the fetch layer treats null as a
 * graceful per-reading miss rather than a crash.
 */
export function toPassageId(rawRef: string): string | null {
  // Non-contiguous ranges ("Lam. 3:1-9, 19-33") — take first segment only.
  const ref = rawRef.split(",")[0]!.trim();

  // Normalise missing space after abbreviated period: "1 Cor.7" → "1 Cor. 7"
  const normalized = ref.replace(/\.(\d)/, ". $1");

  // Find the longest matching book name prefix.
  let usfm = "";
  let singleChapter = false;
  let remainder = "";

  for (const entry of BOOKS_SORTED) {
    if (!normalized.startsWith(entry.name)) continue;
    const after = normalized.slice(entry.name.length);
    // Require whitespace (or end of string) after the book name to avoid
    // "John" matching "Jonah".
    if (after.length > 0 && !/^\s/.test(after)) continue;
    usfm = entry.usfm;
    singleChapter = entry.singleChapter ?? false;
    remainder = after.trimStart();
    break;
  }

  if (!usfm || !remainder) return null;

  const colonIdx = remainder.indexOf(":");
  const dashIdx = remainder.indexOf("-");

  if (colonIdx === -1) {
    if (dashIdx === -1) {
      // "103" — whole chapter
      return `${usfm}.${remainder}`;
    }
    if (singleChapter) {
      // "17-25" for a single-chapter book like Jude → "JUD.1.17-JUD.1.25"
      const parts = remainder.split("-");
      return `${usfm}.1.${parts[0]}-${usfm}.1.${parts[1]}`;
    }
    // Chapter range with no verses — take first chapter
    return `${usfm}.${remainder.split("-")[0]}`;
  }

  // Has colon: "62:1-12" or "2:14-3:15"
  const chapter = remainder.slice(0, colonIdx);
  const versePart = remainder.slice(colonIdx + 1);
  const verseDash = versePart.indexOf("-");

  if (verseDash === -1) {
    // Single verse: "62:1"
    return `${usfm}.${chapter}.${versePart}`;
  }

  const verseStart = versePart.slice(0, verseDash);
  const verseEnd = versePart.slice(verseDash + 1);
  const crossColon = verseEnd.indexOf(":");

  if (crossColon !== -1) {
    // Cross-chapter: "2:14-3:15"
    const endChapter = verseEnd.slice(0, crossColon);
    const endVerse = verseEnd.slice(crossColon + 1);
    return `${usfm}.${chapter}.${verseStart}-${usfm}.${endChapter}.${endVerse}`;
  }

  // Same-chapter range: "62:1-12"
  return `${usfm}.${chapter}.${verseStart}-${usfm}.${chapter}.${verseEnd}`;
}

// ─── API fetch ───────────────────────────────────────────────────────────────

async function fetchPassage(
  ref: ReadingRef,
  translation: Translation,
  apiKey: string,
): Promise<{ canonical: string; text: string } | null> {
  const passageId = toPassageId(ref.rawReference);
  if (!passageId) return null;

  const bibleId = BIBLE_IDS[translation];
  const params = new URLSearchParams({
    "content-type": "text",
    "include-verse-numbers": "true",
    "include-titles": "false",
    "include-chapter-numbers": "false",
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
  const result = await fetchPassage(ref, translation, apiKey);
  return {
    id: `${ref.role}-${index}-${ref.rawReference}`,
    role: ref.role,
    rawReference: ref.rawReference,
    reference: result?.canonical ?? ref.rawReference,
    text: result?.text ?? null,
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
