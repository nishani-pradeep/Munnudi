import { describe, it, expect } from "vitest";
import { computeUsage } from "./utilities";

describe("computeUsage", () => {
  it("computes current minus previous when both readings are entered", () => {
    expect(computeUsage(1200, 1350, null)).toBe(150);
  });

  it("returns null (never 0) when a reading is missing — not entered != zero", () => {
    expect(computeUsage(null, 1350, null)).toBeNull();
    expect(computeUsage(1200, null, null)).toBeNull();
    expect(computeUsage(null, null, null)).toBeNull();
  });

  it("usage_override always wins, even when both readings are present", () => {
    expect(computeUsage(1200, 1350, 999)).toBe(999);
    expect(computeUsage(null, null, 42)).toBe(42);
  });

  it("rounds the computed difference to 3 decimal places", () => {
    expect(computeUsage(100, 100.1234, null)).toBe(0.123);
  });
});
