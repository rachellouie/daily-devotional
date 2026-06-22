"use client";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { THEME_COOKIE, type ThemeMode } from "@/lib/preferences";

interface ThemeToggleProps {
  /** Initial mode from the server-read cookie (default "system"). */
  initial: ThemeMode;
}

const OPTIONS: { mode: ThemeMode; label: string; Icon: typeof Sun }[] = [
  { mode: "light", label: "Light", Icon: Sun },
  { mode: "dark", label: "Dark", Icon: Moon },
  { mode: "system", label: "System", Icon: Monitor },
];

const MEDIA = "(prefers-color-scheme: dark)";

/** Resolve a mode to the literal appearance, consulting the OS for "system". */
function prefersDark(mode: ThemeMode): boolean {
  if (mode === "system") {
    return (
      typeof window !== "undefined" && window.matchMedia(MEDIA).matches
    );
  }
  return mode === "dark";
}

/** Flip `.dark` on <html> to match the resolved mode. */
function applyTheme(mode: ThemeMode): void {
  document.documentElement.classList.toggle("dark", prefersDark(mode));
}

/**
 * 3-segment pill (styled like TranslationPicker) selecting Light / Dark /
 * System. Like VerseNumberToggle this is a PURE CLIENT CSS swap — it flips
 * `.dark` on <html> and persists the choice in a (non-httpOnly, display-only)
 * cookie; no re-fetch, no server round-trip.
 *
 * The active segment reflects the chosen MODE, not the resolved appearance — in
 * System mode the System segment is pressed even while the page renders dark
 * (spec AC 10). When the mode is System, an OS theme change updates the page
 * live via a matchMedia listener that is torn down when leaving System mode.
 *
 * The server never writes the pre-paint class (it can't resolve "system"); the
 * inline <head> script in app/layout.tsx owns first paint, so this component
 * only handles changes after hydration.
 */
export function ThemeToggle({ initial }: ThemeToggleProps) {
  const [mode, setMode] = useState<ThemeMode>(initial);

  // Live-follow the OS only while in System mode.
  useEffect(() => {
    if (mode !== "system") return;
    const mql = window.matchMedia(MEDIA);
    const onChange = () => applyTheme("system");
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [mode]);

  const select = (next: ThemeMode) => {
    setMode(next);
    applyTheme(next);
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${
      60 * 60 * 24 * 365
    }; samesite=lax`;
  };

  return (
    <div className="flex gap-1" role="group" aria-label="Theme">
      {OPTIONS.map(({ mode: m, label, Icon }) => (
        <button
          key={m}
          type="button"
          onClick={() => select(m)}
          aria-pressed={m === mode}
          aria-label={label}
          title={label}
          className={`rounded-full p-1.5 transition-colors ${
            m === mode
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          }`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
