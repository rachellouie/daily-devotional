// TEMPORARY smoke test — full Slice-4 coverage gate lives in lectionary-data.test.ts.
// Verifies toPassageIds parses EVERY reference in the live dataset to well-formed
// USFM passage IDs. Deleted after Slice 1 review.
import { describe, it, expect } from "vitest";
import { toPassageIds } from "@/lib/scripture";
import breadData from "@/data/bread-2026.json";

function collectStrings(node: unknown, out: Set<string>): void {
  if (Array.isArray(node)) node.forEach((n) => collectStrings(n, out));
  else if (node && typeof node === "object")
    Object.values(node).forEach((n) => collectStrings(n, out));
  else if (typeof node === "string") out.add(node);
}

// A well-formed passage ID is BOOK.CH[.V][-BOOK.CH[.V]] with only integer parts.
const ID = /^[1-3A-Z]{2,3}\.\d+(\.\d+)?(-[1-3A-Z]{2,3}\.\d+(\.\d+)?)?$/;

describe("coverage smoke (all live refs)", () => {
  const refs = new Set<string>();
  collectStrings(breadData, refs);
  // Scripture refs only — skip bare numbers and number-lists (psalm pointers).
  const scriptureRefs = [...refs].filter((r) => /[A-Za-z]/.test(r));

  it("every scripture ref parses to ≥1 segment", () => {
    const failures = scriptureRefs.filter((r) => {
      const ids = toPassageIds(r);
      return !ids || ids.length === 0;
    });
    expect({ count: failures.length, failures }).toEqual({ count: 0, failures: [] });
  });

  it("every produced passage ID is well-formed USFM", () => {
    const bad: { ref: string; ids: string[] }[] = [];
    for (const r of scriptureRefs) {
      const ids = toPassageIds(r);
      if (ids && ids.some((id) => !ID.test(id))) bad.push({ ref: r, ids });
    }
    expect(bad).toEqual([]);
  });
});
