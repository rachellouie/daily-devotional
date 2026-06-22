import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ScriptureConfigError,
  toPassageIds,
  passageIdsToReference,
  fetchReadings,
} from "@/lib/scripture";
import type { ReadingRef } from "@/types";

// ─── toPassageIds (multi-segment) ────────────────────────────────────────────
//
// Fixtures are REAL references drawn from data/bread-2026.json (the live
// dataset). Each comment notes the shape it exercises.

describe("toPassageIds", () => {
  // ── Single-segment shapes: one-element array, no regression vs old converter ──

  it("whole chapter (Psalm 103)", () => {
    expect(toPassageIds("Psalm 103")).toEqual(["PSA.103"]);
  });

  it("same-chapter verse range (Isaiah 62:1-12)", () => {
    expect(toPassageIds("Isaiah 62:1-12")).toEqual(["ISA.62.1-ISA.62.12"]);
  });

  it("cross-chapter range (Joshua 3:14-4:7)", () => {
    expect(toPassageIds("Joshua 3:14-4:7")).toEqual(["JOS.3.14-JOS.4.7"]);
  });

  it("single-chapter book verse range (Jude 17-25)", () => {
    expect(toPassageIds("Jude 17-25")).toEqual(["JUD.1.17-JUD.1.25"]);
  });

  it("normalizes missing space after abbreviation (1 Cor.7:25-31)", () => {
    expect(toPassageIds("1 Cor.7:25-31")).toEqual(["1CO.7.25-1CO.7.31"]);
  });

  it("normalizes missing space, no dot (Ephesians4:17-32)", () => {
    expect(toPassageIds("Ephesians4:17-32")).toEqual(["EPH.4.17-EPH.4.32"]);
  });

  // ── Same-chapter multi-segment (35 of the 40 real comma-refs) ──

  // Trailing range inherits book AND chapter.
  it("two same-chapter ranges (Lam. 3:1-9, 19-33)", () => {
    expect(toPassageIds("Lam. 3:1-9, 19-33")).toEqual([
      "LAM.3.1-LAM.3.9",
      "LAM.3.19-LAM.3.33",
    ]);
  });

  it("two same-chapter ranges, full book name (Ezekiel 18:1-4, 25-32)", () => {
    expect(toPassageIds("Ezekiel 18:1-4, 25-32")).toEqual([
      "EZK.18.1-EZK.18.4",
      "EZK.18.25-EZK.18.32",
    ]);
  });

  // Trailing SINGLE verse inherits chapter.
  it("range then single verse (Revelation 22:12-17, 21)", () => {
    expect(toPassageIds("Revelation 22:12-17, 21")).toEqual([
      "REV.22.12-REV.22.17",
      "REV.22.21",
    ]);
  });

  // No space after the comma + trailing single verse.
  it("no-space comma, trailing verse (Revelation 14:1-7,13)", () => {
    expect(toPassageIds("Revelation 14:1-7,13")).toEqual([
      "REV.14.1-REV.14.7",
      "REV.14.13",
    ]);
  });

  // ── Cross-chapter multi-segment (5 of the 40 real comma-refs) ──

  // Second segment names its own chapter explicitly (skips ch.2).
  it("trailing segment with explicit new chapter (Matthew 1:1-17, 3:1-6)", () => {
    expect(toPassageIds("Matthew 1:1-17, 3:1-6")).toEqual([
      "MAT.1.1-MAT.1.17",
      "MAT.3.1-MAT.3.6",
    ]);
  });

  // Second segment's START inherits ch.22, then crosses into ch.23.
  it("trailing segment inherits then crosses chapter (Job 22:1-4, 21-23:7)", () => {
    expect(toPassageIds("Job 22:1-4, 21-23:7")).toEqual([
      "JOB.22.1-JOB.22.4",
      "JOB.22.21-JOB.23.7",
    ]);
  });

  // HARD: segment 1 crosses ch.4→5; trailing verses inherit ch.5 (where seg 1
  // ENDED), not ch.4.
  it("trailing verses inherit the chapter where seg 1 ended (Joshua 4:19-5:1, 10-15)", () => {
    expect(toPassageIds("Joshua 4:19-5:1, 10-15")).toEqual([
      "JOS.4.19-JOS.5.1",
      "JOS.5.10-JOS.5.15",
    ]);
  });

  // HARD: segment 1 crosses ch.32→33; trailing verses inherit ch.33.
  it("trailing verses inherit chapter from crossing seg 1 (Job 32:1-33:1, 19-28)", () => {
    expect(toPassageIds("Job 32:1-33:1, 19-28")).toEqual([
      "JOB.32.1-JOB.33.1",
      "JOB.33.19-JOB.33.28",
    ]);
  });

  // ── Part-verse a/b markers (7 real refs): strip a/b → whole-verse passage ID.
  //    (Half-verse TRIMMING is Slice 3; here we only ensure they PARSE cleanly.)

  it("strips trailing part-verse marker (1 Samuel 16:1-13a)", () => {
    expect(toPassageIds("1 Samuel 16:1-13a")).toEqual(["1SA.16.1-1SA.16.13"]);
  });

  it("strips leading part-verse marker (2 Cor. 11:21b-31)", () => {
    expect(toPassageIds("2 Cor. 11:21b-31")).toEqual(["2CO.11.21-2CO.11.31"]);
  });

  it("strips part-verse on a cross-chapter end (Acts 7:44-8:1a)", () => {
    expect(toPassageIds("Acts 7:44-8:1a")).toEqual(["ACT.7.44-ACT.8.1"]);
  });

  it("returns null for unrecognised book", () => {
    expect(toPassageIds("FakeBook 1:1")).toBeNull();
  });
});

// ─── passageIdsToReference (combined heading) ───────────────────────────────
// #1: the card heading must reflect EVERY span, collapsing shared book/chapter
// the way the lectionary writes it. Derived from our parsed IDs (not the API
// canonical), so it's stable even when a fetch fails and #3a (whole-chapter
// Psalm → "Psalm 32", not "Psalm 32:1-11") falls out for free.
describe("passageIdsToReference", () => {
  it("single contiguous range → book + verse range", () => {
    expect(passageIdsToReference(["NUM.12.1-NUM.12.16"])).toBe("Numbers 12:1-16");
  });

  it("whole-chapter id → bare chapter (Psalm 32, not 32:1-11)", () => {
    expect(passageIdsToReference(["PSA.32"])).toBe("Psalm 32");
  });

  it("same-chapter non-contiguous → trailing span drops book + chapter", () => {
    expect(passageIdsToReference(["NUM.13.1-NUM.13.3", "NUM.13.21-NUM.13.30"])).toBe(
      "Numbers 13:1-3, 21-30",
    );
  });

  it("non-contiguous with a cross-chapter second span", () => {
    expect(passageIdsToReference(["JOB.22.1-JOB.22.4", "JOB.22.21-JOB.23.7"])).toBe(
      "Job 22:1-4, 21-23:7",
    );
  });

  it("chapter changes between spans → trailing span shows its chapter", () => {
    expect(passageIdsToReference(["MAT.1.1-MAT.1.17", "MAT.3.1-MAT.3.6"])).toBe(
      "Matthew 1:1-17, 3:1-6",
    );
  });

  it("two distinct chapters → both spans show chapters", () => {
    expect(passageIdsToReference(["JOB.25.1-JOB.25.6", "JOB.27.1-JOB.27.6"])).toBe(
      "Job 25:1-6, 27:1-6",
    );
  });

  it("cross-chapter first span, then same-chapter trailing", () => {
    expect(passageIdsToReference(["JOS.4.19-JOS.5.1", "JOS.5.10-JOS.5.15"])).toBe(
      "Joshua 4:19-5:1, 10-15",
    );
  });

  it("trailing single verse → bare verse", () => {
    expect(passageIdsToReference(["REV.22.12-REV.22.17", "REV.22.21"])).toBe(
      "Revelation 22:12-17, 21",
    );
  });

  it("Lamentations same-chapter two-segment", () => {
    expect(passageIdsToReference(["LAM.3.1-LAM.3.9", "LAM.3.19-LAM.3.33"])).toBe(
      "Lamentations 3:1-9, 19-33",
    );
  });
});

// ─── fetchReadings ───────────────────────────────────────────────────────────

describe("fetchReadings", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("throws ScriptureConfigError when APIBIBLE_API_KEY is missing", async () => {
    vi.stubEnv("APIBIBLE_API_KEY", "");
    const refs: ReadingRef[] = [{ role: "psalm", rawReference: "Psalm 103" }];
    await expect(fetchReadings(refs, "NIV")).rejects.toBeInstanceOf(ScriptureConfigError);
  });

  // AC 12: a contiguous ref produces a one-segment Reading.
  it("contiguous ref → single segment with text on 200", async () => {
    vi.stubEnv("APIBIBLE_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          // HTML content-type (Slice 1): verse numbers/poetry come back as markup.
          content:
            '<p class="q1"><span data-sid="PSA 103:1" class="v">1</span>Bless the LORD, O my soul!</p>',
          reference: "Psalms 103",
          copyright: "...",
        },
      }),
    } as Response);

    const refs: ReadingRef[] = [{ role: "psalm", rawReference: "Psalm 103" }];
    const readings = await fetchReadings(refs, "NIV");

    expect(readings).toHaveLength(1);
    expect(readings[0]!.segments).toHaveLength(1);
    expect(readings[0]!.segments[0]!.text).toBe(
      '<p class="q1"><span data-sid="PSA 103:1" class="v">1</span>Bless the LORD, O my soul!</p>',
    );
    // Segment reference reflects what the API returned for that span ("Psalms 103").
    expect(readings[0]!.segments[0]!.reference).toBe("Psalms 103");
    // The card HEADING is derived from our parsed IDs — normalized to "Psalm 103".
    expect(readings[0]!.reference).toBe("Psalm 103");
    expect(readings[0]!.translation).toBe("NIV");
    expect(readings[0]!.role).toBe("psalm");
  });

  // AC 10: a 2-segment ref stitches both fetches into an ordered segments array.
  it("non-contiguous ref → stitches both segments in order", async () => {
    vi.stubEnv("APIBIBLE_API_KEY", "test-key");
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: { content: "verses 1-9", reference: "Lamentations 3:1-9", copyright: "" },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: { content: "verses 19-33", reference: "Lamentations 3:19-33", copyright: "" },
        }),
      } as Response);

    const refs: ReadingRef[] = [{ role: "first", rawReference: "Lam. 3:1-9, 19-33" }];
    const readings = await fetchReadings(refs, "NIV");

    expect(spy).toHaveBeenCalledTimes(2);
    const segs = readings[0]!.segments;
    expect(segs).toHaveLength(2);
    expect(segs[0]!.text).toBe("verses 1-9");
    expect(segs[0]!.reference).toBe("Lamentations 3:1-9");
    expect(segs[1]!.text).toBe("verses 19-33");
    expect(segs[1]!.reference).toBe("Lamentations 3:19-33");
    // #1: the overall heading shows BOTH spans, collapsed (not just the first).
    expect(readings[0]!.reference).toBe("Lamentations 3:1-9, 19-33");
  });

  // AC 11: when the SECOND segment fails, the reading is NOT dropped — the failed
  // segment keeps text:null but a populated reference so the reader can look it up.
  it("non-contiguous ref → failed second segment keeps a reference", async () => {
    vi.stubEnv("APIBIBLE_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: { content: "verses 1-9", reference: "Lamentations 3:1-9", copyright: "" },
        }),
      } as Response)
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) } as Response);

    const refs: ReadingRef[] = [{ role: "first", rawReference: "Lam. 3:1-9, 19-33" }];
    const readings = await fetchReadings(refs, "NIV");

    const segs = readings[0]!.segments;
    expect(segs).toHaveLength(2);
    expect(segs[0]!.text).toBe("verses 1-9");
    expect(segs[1]!.text).toBeNull();
    // Reference derived from the parse survives the failed fetch (human-readable).
    expect(segs[1]!.reference).toBeTruthy();
    expect(segs[1]!.reference).toContain("Lamentations");
  });

  // A single-segment failure still yields one segment (text null, ref preserved).
  it("contiguous ref → single null-text segment on non-2xx", async () => {
    vi.stubEnv("APIBIBLE_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({}),
    } as Response);

    const refs: ReadingRef[] = [{ role: "psalm", rawReference: "Psalm 103" }];
    const readings = await fetchReadings(refs, "NIV");
    expect(readings[0]!.segments).toHaveLength(1);
    expect(readings[0]!.segments[0]!.text).toBeNull();
    expect(readings[0]!.segments[0]!.reference).toBeTruthy();
    expect(readings[0]!.rawReference).toBe("Psalm 103");
  });

  it("uses the correct Bible ID for NLT", async () => {
    vi.stubEnv("APIBIBLE_API_KEY", "test-key");
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { content: "text", reference: "Psalm 103", copyright: "" } }),
    } as Response);

    await fetchReadings([{ role: "psalm", rawReference: "Psalm 103" }], "NLT");
    expect(spy.mock.calls[0]?.[0]).toContain("d6e14a625393b4da-01");
  });

  it("uses the correct Bible ID for MSG", async () => {
    vi.stubEnv("APIBIBLE_API_KEY", "test-key");
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { content: "text", reference: "Psalm 103", copyright: "" } }),
    } as Response);

    await fetchReadings([{ role: "psalm", rawReference: "Psalm 103" }], "MSG");
    expect(spy.mock.calls[0]?.[0]).toContain("6f11a7de016f942e-01");
  });

  // Slice 1 (HTML rendering): scripture is fetched as structured HTML with
  // chapter numbers, so verse numbers / chapter markers / poetry are styleable.
  it("fetches content-type=html with chapter numbers", async () => {
    vi.stubEnv("APIBIBLE_API_KEY", "test-key");
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          content: '<p class="p"><span data-sid="PSA 103:1" class="v">1</span>Bless the LORD.</p>',
          reference: "Psalm 103",
          copyright: "",
        },
      }),
    } as Response);

    await fetchReadings([{ role: "psalm", rawReference: "Psalm 103" }], "NIV");
    const url = spy.mock.calls[0]?.[0] as string;
    expect(url).toContain("content-type=html");
    expect(url).toContain("include-chapter-numbers=true");
  });

  it("sends the api-key header", async () => {
    vi.stubEnv("APIBIBLE_API_KEY", "my-real-key");
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { content: "text", reference: "ref", copyright: "" } }),
    } as Response);

    await fetchReadings([{ role: "psalm", rawReference: "Psalm 103" }], "NIV");
    const headers = spy.mock.calls[0]?.[1]?.headers as Record<string, string>;
    expect(headers?.["api-key"]).toBe("my-real-key");
  });
});
