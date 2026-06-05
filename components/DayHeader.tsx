/**
 * components/DayHeader.tsx — the date + liturgical-season banner at the top.
 *
 * A pure presentational SERVER component: it takes already-computed data and
 * renders it. No "use client", no hooks, no fetching — so it ships zero JS to
 * the browser. Make a component a Client Component only when it needs
 * interactivity or browser APIs; this one needs neither.
 */
import type { LiturgicalDay } from "@/types";
import { formatLongDate } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

// Props interfaces are conventionally named `<Component>Props`.
interface DayHeaderProps {
  day: LiturgicalDay;
  title: string | null;
  office: string; // e.g. "morning" — capitalized for display below
}

export function DayHeader({ day, title, office }: DayHeaderProps) {
  const officeLabel = `${office[0]?.toUpperCase()}${office.slice(1)} Prayer`;

  return (
    <header className="space-y-3 border-b pb-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{day.seasonLabel}</Badge>
        <Badge variant="secondary">{day.year}</Badge>
        <Badge variant="outline">{day.week}</Badge>
      </div>

      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          {officeLabel}
        </p>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          {formatLongDate(day.date)}
        </h1>
        {/* `title` only exists on Sundays / holy days; render it when present. */}
        {title ? (
          <p className="mt-1 font-serif text-lg italic text-muted-foreground">
            {title}
          </p>
        ) : null}
      </div>
    </header>
  );
}
