"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TZ_COOKIE } from "@/lib/preferences";

interface TimezoneSyncProps {
  /**
   * The zone the server used for THIS render (the `tz` cookie, or the NYC
   * fallback when it was absent/invalid). We compare it to the real browser zone.
   */
  serverTimeZone: string;
}

/**
 * Bridges the browser's real IANA timezone to the server so the daily rollover
 * lands on the READER'S local midnight, not the server's UTC.
 *
 * The readings are fetched in a Server Component that can't see the browser zone
 * on first paint, so the flow is: write the detected zone to a (display-only,
 * non-httpOnly) cookie the server reads on the next render, and — if this render
 * used a DIFFERENT zone (first-ever visit, or the reader traveled / DST flipped)
 * — fire one soft `router.refresh()` so the correct day re-renders server-side.
 * Steady state (cookie already matches) is a no-op. Renders nothing.
 */
export function TimezoneSync({ serverTimeZone }: TimezoneSyncProps) {
  const router = useRouter();

  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return;
    document.cookie = `${TZ_COOKIE}=${tz}; path=/; max-age=${
      60 * 60 * 24 * 365
    }; samesite=lax`;
    if (tz !== serverTimeZone) router.refresh();
  }, [serverTimeZone, router]);

  return null;
}
