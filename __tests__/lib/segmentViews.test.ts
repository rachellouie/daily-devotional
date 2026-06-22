import { describe, it, expect } from "vitest";
import { toSegmentViews, type SegmentView } from "@/components/segmentViews";
import type { ReadingSegment } from "@/types";

const seg = (text: string | null, reference = "ref"): ReadingSegment => ({ reference, text });
const gaps = (views: SegmentView[]) => views.filter((v) => v.kind === "gap").length;

describe("toSegmentViews (gap markers)", () => {
  // AC 14: one segment → no gap marker.
  it("single segment → no gap", () => {
    const views = toSegmentViews([seg("only span")]);
    expect(gaps(views)).toBe(0);
    expect(views).toEqual([{ kind: "text", text: "only span" }]);
  });

  // AC 13: two segments → exactly one gap, BETWEEN them.
  it("two segments → one gap between the spans", () => {
    const views = toSegmentViews([seg("first"), seg("second")]);
    expect(views).toEqual([
      { kind: "text", text: "first" },
      { kind: "gap" },
      { kind: "text", text: "second" },
    ]);
  });

  // AC 13: N segments → N-1 gaps, never at the start or end.
  it("three segments → two gaps, never leading or trailing", () => {
    const views = toSegmentViews([seg("a"), seg("b"), seg("c")]);
    expect(gaps(views)).toBe(2);
    expect(views[0]!.kind).not.toBe("gap");
    expect(views[views.length - 1]!.kind).not.toBe("gap");
  });

  // AC 15: a failed span (text null) becomes a fallback carrying its reference,
  // and the surrounding gap is unaffected.
  it("failed span → fallback view with its reference; gap preserved", () => {
    const views = toSegmentViews([seg("first"), seg(null, "Lamentations 3:19-33")]);
    expect(views).toEqual([
      { kind: "text", text: "first" },
      { kind: "gap" },
      { kind: "fallback", reference: "Lamentations 3:19-33" },
    ]);
  });

  // Empty-string text is real content, not a failure — only null is a failure.
  it("empty-string text is treated as text, not fallback", () => {
    const views = toSegmentViews([seg("")]);
    expect(views).toEqual([{ kind: "text", text: "" }]);
  });
});
