"use client";
import { useState } from "react";
import { VERSE_NUMBERS_COOKIE } from "@/lib/preferences";

interface VerseNumberToggleProps {
  /** Initial state from the server-read cookie (default hidden). */
  initial: boolean;
}

/**
 * Pill toggle (styled to match TranslationPicker) that shows/hides scripture
 * verse numbers. Deliberately PURE CLIENT-SIDE: the numbers are already in the
 * DOM, so toggling just flips a class on the <main> container — instant, no
 * re-fetch and no server round-trip (spec AC 5). The choice is persisted in a
 * (non-httpOnly, display-only) cookie that the server reads on the next load to
 * set the initial class, so the preference survives reload without a flash.
 *
 * The button and the readings live in separate subtrees, so the shared <main>
 * ancestor is the minimal coordination point for the CSS class.
 */
export function VerseNumberToggle({ initial }: VerseNumberToggleProps) {
  const [show, setShow] = useState(initial);

  const toggle = () => {
    const next = !show;
    setShow(next);
    document.querySelector("main")?.classList.toggle("show-verse-numbers", next);
    document.cookie = `${VERSE_NUMBERS_COOKIE}=${next}; path=/; max-age=${
      60 * 60 * 24 * 365
    }; samesite=lax`;
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={show}
      aria-label="Show verse numbers"
      className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
        show
          ? "bg-primary text-primary-foreground"
          : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
      }`}
    >
      Verse #s
    </button>
  );
}
