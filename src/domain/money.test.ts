import { describe, it, expect } from "vitest";
import {
  paise,
  fromRupees,
  parsePaise,
  toNumericString,
  add,
  subtract,
  sum,
  clampAtZero,
  formatInr,
  formatInrWhole,
  ZERO,
} from "./money";

describe("parsePaise", () => {
  it("parses Postgres numeric strings exactly", () => {
    expect(parsePaise("0.00")).toBe(0);
    expect(parsePaise("123.45")).toBe(12345);
    expect(parsePaise("1234567.89")).toBe(123456789);
    expect(parsePaise("100")).toBe(10000);
    expect(parsePaise("0.5")).toBe(50);
    expect(parsePaise("-250.75")).toBe(-25075);
  });

  it("avoids the float trap that parseFloat*100 would hit", () => {
    // Documents precisely why parsePaise does not use parseFloat.
    expect(parseFloat("1234567.89") * 100).not.toBe(123456789);
    expect(parseFloat("1234567.89") * 100).toBeCloseTo(123456788.99999999, 6);
    // Our parser is exact.
    expect(parsePaise("1234567.89")).toBe(123456789);
  });

  it("rejects malformed input rather than silently coercing", () => {
    expect(() => parsePaise("abc")).toThrow(TypeError);
    expect(() => parsePaise("")).toThrow(TypeError);
    expect(() => parsePaise("1,234.00")).toThrow(TypeError);
  });

  it("refuses to silently truncate sub-paise precision", () => {
    // numeric(14,2) cannot produce this; if it appears the caller has a bug.
    expect(() => parsePaise("1.234")).toThrow(RangeError);
  });

  it("round-trips through toNumericString", () => {
    for (const s of ["0.00", "123.45", "1234567.89", "-250.75", "0.05"]) {
      expect(toNumericString(parsePaise(s))).toBe(
        // normalise "0.5" style inputs to 2dp for comparison
        toNumericString(parsePaise(s)),
      );
    }
    expect(toNumericString(paise(12345))).toBe("123.45");
    expect(toNumericString(paise(-25075))).toBe("-250.75");
    expect(toNumericString(paise(5))).toBe("0.05");
    expect(toNumericString(ZERO)).toBe("0.00");
  });
});

describe("arithmetic", () => {
  it("is exact for values that would drift in float rupees", () => {
    // 0.1 + 0.2 !== 0.3 in float; in paise it is exact.
    expect(add(fromRupees(0.1), fromRupees(0.2))).toBe(fromRupees(0.3));
  });

  it("adds, subtracts and sums", () => {
    expect(add(paise(12345), paise(100))).toBe(12445);
    expect(subtract(paise(12345), paise(345))).toBe(12000);
    expect(sum([paise(100), paise(200), paise(300)])).toBe(600);
    expect(sum([])).toBe(0);
  });

  it("clamps at zero for per-month Rent Pending", () => {
    expect(clampAtZero(paise(-500))).toBe(0);
    expect(clampAtZero(paise(500))).toBe(500);
  });

  it("rejects non-integer paise", () => {
    expect(() => paise(1.5)).toThrow(RangeError);
  });
});

describe("INR formatting (PRD 15)", () => {
  /*
   * These assert EXACT strings on purpose. Indian lakh/crore grouping requires
   * full ICU data; without it the output silently degrades to Western grouping
   * (Rs 123,456.00). A snapshot of the exact string is the only thing that
   * catches that regression.
   */
  it("uses Indian lakh/crore digit grouping, not Western", () => {
    expect(formatInr(fromRupees(123456))).toBe("₹1,23,456.00");
    expect(formatInr(fromRupees(1234567.89))).toBe("₹12,34,567.89");
    expect(formatInr(fromRupees(12345678.5))).toBe("₹1,23,45,678.50");
  });

  it("renders the rupee sign, never the INR code", () => {
    expect(formatInr(fromRupees(100))).toContain("₹");
    expect(formatInr(fromRupees(100))).not.toContain("INR");
  });

  it("formats zero and negatives with an explicit sign prefix", () => {
    expect(formatInr(ZERO)).toBe("₹0.00");
    // Operating Profit can legitimately go negative; the format is a decision,
    // not an accident: minus-prefixed, not parenthesised.
    expect(formatInr(fromRupees(-123456))).toBe("-₹1,23,456.00");
  });

  it("formats whole rupees for dense dashboard cards", () => {
    expect(formatInrWhole(fromRupees(123456))).toBe("₹1,23,456");
    expect(formatInrWhole(ZERO)).toBe("₹0");
  });
});
