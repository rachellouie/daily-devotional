/**
 * components/ReadingCard.tsx — renders ONE scripture reading.
 *
 * Presentational Server Component. Given a fully-resolved `Reading`, it shows the
 * role label ("Gospel"), the canonical reference, and the passage text. A reading
 * has one segment per contiguous span; a non-contiguous reference (e.g.
 * "Lam. 3:1-9, 19-33") renders each span with a minimal inline "…" between them
 * so the appointed verses read continuously and the omission reads as intentional.
 * A span whose fetch failed shows a non-blocking inline message with its own
 * reference, so one bad span never blanks the whole reading.
 */
import type { Reading, ReadingRole, ReadingRoleLabels } from "@/types";
import { toSegmentViews } from "@/components/segmentViews";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * `Record<ReadingRole, string>` (aliased as ReadingRoleLabels in types) makes
 * this table EXHAUSTIVE: if someone adds a role to the union, TypeScript errors
 * here until a label is provided. That's a compile-time guarantee you can't get
 * from a plain object.
 */
const ROLE_LABELS: ReadingRoleLabels = {
  psalm: "Psalm",
  first: "First Reading",
  second: "Second Reading",
  third: "Third Reading",
  gospel: "Gospel",
};

interface ReadingCardProps {
  reading: Reading;
}

export function ReadingCard({ reading }: ReadingCardProps) {
  const label = ROLE_LABELS[reading.role];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="font-serif">{reading.reference}</CardTitle>
          <Badge variant="secondary">{reading.translation}</Badge>
        </div>
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {(() => {
          // Track whether we've emitted the first TEXT span yet — only that span's
          // leading chapter marker (h2.c) is suppressed by `.scripture--lead`,
          // since the card title already names the opening chapter. Gaps and
          // failed spans don't count as "the leading text".
          let leadingTextEmitted = false;
          return toSegmentViews(reading.segments).map((view, i) => {
            const key = `${reading.id}-view-${i}`;
            if (view.kind === "gap") {
              // Inline gap marker between spans (U+2026 horizontal ellipsis):
              // minimal, no annotation, so skipped verses read as an intentional
              // pause rather than missing text. Only ever BETWEEN segments.
              return (
                <p key={key} className="font-serif text-base leading-relaxed text-muted-foreground">
                  …
                </p>
              );
            }
            if (view.kind === "text") {
              const isLead = !leadingTextEmitted;
              leadingTextEmitted = true;
              // API.Bible HTML (span.v / h2.c / p.q1|q2|p) rendered as-is. Scoped
              // `.scripture` CSS (globals.css) hides the redundant p.cl label,
              // suppresses the lead chapter marker, styles verse numbers subtly,
              // and turns mid-reading chapter changes into a "— N —" divider. The
              // API's own paragraph/poetry structure gives us indentation for free
              // (no whitespace-pre-line). See the security note in lib/scripture.ts
              // for why this HTML is injected without sanitization.
              return (
                <div
                  key={key}
                  className={`scripture font-serif text-base leading-relaxed${
                    isLead ? " scripture--lead" : ""
                  }`}
                  dangerouslySetInnerHTML={{ __html: view.text }}
                />
              );
            }
            return (
              <p key={key} className="text-sm italic text-muted-foreground">
                Couldn’t load this passage right now. Reference: {view.reference}.
              </p>
            );
          });
        })()}
      </CardContent>
    </Card>
  );
}

// Re-exported for callers that want the label map (e.g. future audio playlist).
export { ROLE_LABELS };
export type { ReadingRole };
