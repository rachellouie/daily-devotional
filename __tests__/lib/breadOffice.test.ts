import { describe, it, expect } from "vitest";
import { getReadingRefs, getTodayIsoDate } from "@/lib/breadOffice";

// The reading must roll over at the READER'S local midnight, not the server's
// UTC. These pin a fixed instant and assert the date the reader sees in their
// zone — the regression test for the "rolls at ~8 PM ET" bug.
describe("getTodayIsoDate", () => {
  it("uses the given zone's local date, not the server's UTC date", () => {
    // 02:00 UTC on the 23rd is still 22:00 on the 22nd in New York (EDT, UTC-4).
    const instant = new Date("2026-06-23T02:00:00Z");
    expect(getTodayIsoDate("America/New_York", instant)).toBe("2026-06-22");
    expect(getTodayIsoDate("UTC", instant)).toBe("2026-06-23");
  });

  it("rolls to the next day exactly at the zone's local midnight", () => {
    // 04:00 UTC == 00:00 EDT on the 23rd: New York has just ticked over.
    const instant = new Date("2026-06-23T04:00:00Z");
    expect(getTodayIsoDate("America/New_York", instant)).toBe("2026-06-23");
  });

  it("honors a west-coast zone independently", () => {
    // 04:00 UTC is still 21:00 on the 22nd in Los Angeles (PDT, UTC-7).
    const instant = new Date("2026-06-23T04:00:00Z");
    expect(getTodayIsoDate("America/Los_Angeles", instant)).toBe("2026-06-22");
  });
});

describe("getReadingRefs", () => {
  it("returns null for a date not in the plan", () => {
    expect(getReadingRefs("2099-01-01")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(getReadingRefs("")).toBeNull();
  });

  it("returns four ReadingRefs for 2026-01-01", () => {
    const result = getReadingRefs("2026-01-01");
    expect(result).not.toBeNull();
    expect(result!.refs).toHaveLength(4);
  });

  it("maps readings to correct roles: psalm, first, second, gospel", () => {
    const result = getReadingRefs("2026-01-01");
    expect(result!.refs[0]).toMatchObject({ role: "psalm", rawReference: "Psalm 103" });
    expect(result!.refs[1]).toMatchObject({ role: "first", rawReference: "Isaiah 62:1-12" });
    expect(result!.refs[2]).toMatchObject({ role: "second", rawReference: "Revelation 19:11-16" });
    expect(result!.refs[3]).toMatchObject({ role: "gospel", rawReference: "Matthew 1:18-25" });
  });

  it("returns feast and fast flags", () => {
    const result = getReadingRefs("2026-01-01");
    expect(result!.feast).toBe(false);
    expect(result!.fast).toBe(false);
  });
});
