import { describe, it, expect, vi, beforeEach } from "vitest";
import { ScriptureConfigError, toPassageId, fetchReadings } from "@/lib/scripture";
import type { ReadingRef } from "@/types";

// ─── toPassageId ────────────────────────────────────────────────────────────

describe("toPassageId", () => {
  it("converts whole chapter (Psalm 103)", () => {
    expect(toPassageId("Psalm 103")).toBe("PSA.103");
  });

  it("converts same-chapter verse range", () => {
    expect(toPassageId("Isaiah 62:1-12")).toBe("ISA.62.1-ISA.62.12");
  });

  it("converts abbreviated book with dot (1 Cor. with space)", () => {
    expect(toPassageId("1 Cor. 1:1-19")).toBe("1CO.1.1-1CO.1.19");
  });

  it("normalizes missing space after period (1 Cor.7:25-31)", () => {
    expect(toPassageId("1 Cor.7:25-31")).toBe("1CO.7.25-1CO.7.31");
  });

  it("converts cross-chapter range", () => {
    expect(toPassageId("1 Cor. 2:14-3:15")).toBe("1CO.2.14-1CO.3.15");
  });

  it("handles Lamentations abbreviation", () => {
    expect(toPassageId("Lam. 1:1-12")).toBe("LAM.1.1-LAM.1.12");
  });

  it("handles single-chapter book (Jude verse range)", () => {
    expect(toPassageId("Jude 17-25")).toBe("JUD.1.17-JUD.1.25");
  });

  it("takes first segment of non-contiguous passage", () => {
    expect(toPassageId("Lam. 3:1-9, 19-33")).toBe("LAM.3.1-LAM.3.9");
  });

  it("handles John (not confused with 1 John)", () => {
    expect(toPassageId("John 6:1-14")).toBe("JHN.6.1-JHN.6.14");
  });

  it("handles 1 John", () => {
    expect(toPassageId("1 John 1:1-7")).toBe("1JN.1.1-1JN.1.7");
  });

  it("returns null for unrecognised book", () => {
    expect(toPassageId("FakeBook 1:1")).toBeNull();
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

  it("returns Reading with text on 200 response", async () => {
    vi.stubEnv("APIBIBLE_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          content: "[1] Bless the LORD, O my soul!",
          reference: "Psalms 103",
          copyright: "...",
        },
      }),
    } as Response);

    const refs: ReadingRef[] = [{ role: "psalm", rawReference: "Psalm 103" }];
    const readings = await fetchReadings(refs, "NIV");

    expect(readings).toHaveLength(1);
    expect(readings[0]!.text).toBe("[1] Bless the LORD, O my soul!");
    expect(readings[0]!.reference).toBe("Psalms 103");
    expect(readings[0]!.translation).toBe("NIV");
    expect(readings[0]!.role).toBe("psalm");
  });

  it("returns null text on non-2xx response", async () => {
    vi.stubEnv("APIBIBLE_API_KEY", "test-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({}),
    } as Response);

    const refs: ReadingRef[] = [{ role: "psalm", rawReference: "Psalm 103" }];
    const readings = await fetchReadings(refs, "NIV");
    expect(readings[0]!.text).toBeNull();
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
