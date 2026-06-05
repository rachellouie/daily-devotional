import { describe, it, expect } from "vitest";
import { getReadingRefs } from "@/lib/breadOffice";

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
