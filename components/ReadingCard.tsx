/**
 * components/ReadingCard.tsx — renders ONE scripture reading.
 *
 * Presentational Server Component. Given a fully-resolved `Reading`, it shows the
 * role label ("Gospel"), the canonical reference, and the passage text. If the
 * text failed to load (text === null) it shows a non-blocking inline message so
 * one bad reading never blanks the whole page.
 */
import type { Reading, ReadingRole, ReadingRoleLabels } from "@/types";
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
      <CardContent>
        {reading.text ? (
          // `whitespace-pre-line` preserves the paragraph/verse line breaks that
          // the ESV API returns as "\n" without us re-parsing the text.
          <p className="whitespace-pre-line font-serif text-base leading-relaxed">
            {reading.text}
          </p>
        ) : (
          <p className="text-sm italic text-muted-foreground">
            Couldn’t load this passage right now. Reference: {reading.rawReference}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Re-exported for callers that want the label map (e.g. future audio playlist).
export { ROLE_LABELS };
export type { ReadingRole };
