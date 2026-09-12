import { describe, it, expect } from "vitest";
import {
  monthKey,
  isMonthKey,
  fromParts,
  addMonths,
  previousMonth,
  nextMonth,
  compareMonths,
  monthsBetween,
  monthRange,
  currentMonthKey,
  formatMonthLong,
  formatMonthShort,
} from "./month";

describe("monthKey validation", () => {
  it("accepts well-formed keys", () => {
    expect(isMonthKey("2025-01")).toBe(true);
    expect(isMonthKey("2025-12")).toBe(true);
  });

  it("rejects out-of-range and malformed months", () => {
    // Postgres would happily store '2025-13' in a text column; the regex is
    // what makes that impossible, so it is tested explicitly.
    expect(isMonthKey("2025-13")).toBe(false);
    expect(isMonthKey("2025-00")).toBe(false);
    expect(isMonthKey("2025-1")).toBe(false);
    expect(isMonthKey("25-01")).toBe(false);
    expect(isMonthKey("")).toBe(false);
    expect(() => monthKey("2025-13")).toThrow(TypeError);
  });
});

describe("ordering", () => {
  it("sorts lexicographically in chronological order", () => {
    const unsorted = ["2025-10", "2024-02", "2025-02", "2024-11"].map(monthKey);
    expect([...unsorted].sort()).toEqual(["2024-02", "2024-11", "2025-02", "2025-10"]);
  });

  it("compares months", () => {
    expect(compareMonths(monthKey("2025-01"), monthKey("2025-02"))).toBeLessThan(0);
    expect(compareMonths(monthKey("2025-02"), monthKey("2025-01"))).toBeGreaterThan(0);
    expect(compareMonths(monthKey("2025-01"), monthKey("2025-01"))).toBe(0);
  });
});

describe("arithmetic", () => {
  it("crosses year boundaries correctly", () => {
    expect(addMonths(monthKey("2025-12"), 1)).toBe("2026-01");
    expect(addMonths(monthKey("2025-01"), -1)).toBe("2024-12");
    expect(nextMonth(monthKey("2025-12"))).toBe("2026-01");
    expect(previousMonth(monthKey("2025-01"))).toBe("2024-12");
  });

  it("handles multi-year offsets", () => {
    expect(addMonths(monthKey("2025-06"), 24)).toBe("2027-06");
    expect(addMonths(monthKey("2025-06"), -18)).toBe("2023-12");
  });

  it("counts months between", () => {
    expect(monthsBetween(monthKey("2025-01"), monthKey("2025-12"))).toBe(11);
    expect(monthsBetween(monthKey("2024-12"), monthKey("2025-01"))).toBe(1);
  });
});

describe("monthRange", () => {
  it("is dense and inclusive, so missing months stay visible", () => {
    expect(monthRange(monthKey("2025-01"), monthKey("2025-04"))).toEqual([
      "2025-01",
      "2025-02",
      "2025-03",
      "2025-04",
    ]);
  });

  it("returns a single month when from === to", () => {
    expect(monthRange(monthKey("2025-05"), monthKey("2025-05"))).toEqual(["2025-05"]);
  });

  it("returns empty when reversed", () => {
    expect(monthRange(monthKey("2025-05"), monthKey("2025-01"))).toEqual([]);
  });
});

describe("currentMonthKey timezone handling", () => {
  it("uses the property timezone, not the server's UTC clock", () => {
    // 2025-04-01 02:00 IST === 2025-03-31 20:30 UTC.
    // A naive toISOString() would report March; in IST it is April.
    const instant = new Date("2025-03-31T20:30:00Z");
    expect(currentMonthKey("Asia/Kolkata", instant)).toBe("2025-04");
    expect(currentMonthKey("UTC", instant)).toBe("2025-03");
  });

  it("handles the last instant of a month in IST", () => {
    // 2025-12-31 23:59 IST === 2025-12-31 18:29 UTC
    const instant = new Date("2025-12-31T18:29:00Z");
    expect(currentMonthKey("Asia/Kolkata", instant)).toBe("2025-12");
  });
});

describe("labels", () => {
  it("formats long and short labels without drifting a month", () => {
    expect(formatMonthLong(monthKey("2025-03"))).toBe("March 2025");
    expect(formatMonthLong(monthKey("2025-01"))).toBe("January 2025");
    expect(formatMonthShort(monthKey("2025-03"))).toBe("Mar 25");
  });
});

describe("fromParts", () => {
  it("zero-pads", () => {
    expect(fromParts(2025, 3)).toBe("2025-03");
  });
  it("rejects invalid input", () => {
    expect(() => fromParts(2025, 13)).toThrow(RangeError);
    expect(() => fromParts(2025, 0)).toThrow(RangeError);
  });
});
