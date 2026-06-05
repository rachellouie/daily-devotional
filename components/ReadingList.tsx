/**
 * components/ReadingList.tsx — renders the ordered list of ReadingCards.
 *
 * Thin layout wrapper. It owns spacing/empty-state so ReadingCard stays focused
 * on a single reading. Splitting "list" from "item" like this is what lets the
 * future audio/streaks features hang off the list level without touching cards.
 */
import type { Reading } from "@/types";
import { ReadingCard } from "@/components/ReadingCard";

interface ReadingListProps {
  readings: Reading[];
}

export function ReadingList({ readings }: ReadingListProps) {
  if (readings.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No readings are listed for this day.
      </p>
    );
  }

  return (
    <section className="space-y-6" aria-label="Today’s readings">
      {readings.map((reading) => (
        // `key` should be stable + unique; Reading.id is built for exactly this.
        <ReadingCard key={reading.id} reading={reading} />
      ))}
    </section>
  );
}
