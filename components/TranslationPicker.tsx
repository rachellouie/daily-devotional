"use client";
import { setTranslation } from "@/app/actions/translation";
import type { Translation } from "@/types";

const TRANSLATIONS: Translation[] = ["NIV", "NLT", "MSG"];

interface TranslationPickerProps {
  activeTranslation: Translation;
}

export function TranslationPicker({ activeTranslation }: TranslationPickerProps) {
  return (
    <div className="flex gap-1" role="group" aria-label="Translation">
      {TRANSLATIONS.map((t) => (
        <button
          key={t}
          onClick={() => void setTranslation(t)}
          aria-pressed={t === activeTranslation}
          className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
            t === activeTranslation
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
