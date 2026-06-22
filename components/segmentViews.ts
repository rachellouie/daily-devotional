/**
 * components/segmentViews.ts — pure view-model for ReadingCard.
 *
 * Flattens a reading's segments into an ordered render list, inserting a gap
 * marker BETWEEN consecutive spans (never at the start or end). Kept JSX-free so
 * the gap-marker logic (ACs 13–15) is unit-testable in the node test env without
 * a DOM or React renderer — ReadingCard just maps these views to elements.
 */
import type { ReadingSegment } from "@/types";

export type SegmentView =
  | { kind: "gap" }
  | { kind: "text"; text: string }
  | { kind: "fallback"; reference: string };

export function toSegmentViews(segments: ReadingSegment[]): SegmentView[] {
  const views: SegmentView[] = [];
  segments.forEach((segment, i) => {
    if (i > 0) views.push({ kind: "gap" });
    views.push(
      segment.text !== null
        ? { kind: "text", text: segment.text }
        : { kind: "fallback", reference: segment.reference },
    );
  });
  return views;
}
