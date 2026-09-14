import { describe, it, expect } from "vitest";
import { computeEmi, generateAmortizationSchedule, nextExpectedRepayment } from "./loans";
import { fromRupees, ZERO, sum } from "./money";

describe("computeEmi", () => {
  it("matches the standard textbook example: Rs 1,00,000 at 10% p.a. for 12 months", () => {
    // Cross-checked empirically: this is the commonly-cited reference figure
    // for this exact loan/rate/tenure combination.
    expect(computeEmi(fromRupees(100000), 10, 12)).toBe(fromRupees(8791.59));
  });

  it("is a plain division when the rate is zero", () => {
    expect(computeEmi(fromRupees(120000), 0, 12)).toBe(fromRupees(10000));
  });

  it("returns zero once the tenure or balance is exhausted", () => {
    expect(computeEmi(fromRupees(100000), 10, 0)).toBe(ZERO);
    expect(computeEmi(ZERO, 10, 12)).toBe(ZERO);
  });
});

describe("generateAmortizationSchedule", () => {
  it("fully amortizes: final balance is exactly zero, no leftover or shortfall", () => {
    const steps = generateAmortizationSchedule(fromRupees(100000), 10, 12);
    expect(steps).toHaveLength(12);
    expect(steps.at(-1)!.closingBalance).toBe(ZERO);
  });

  it("total principal across the schedule equals the original outstanding exactly", () => {
    // Verifies the per-month rounding never leaks or double-counts a paisa.
    const steps = generateAmortizationSchedule(fromRupees(100000), 10, 12);
    const totalPrincipal = sum(steps.map((s) => s.principal));
    expect(totalPrincipal).toBe(fromRupees(100000));
  });

  it("principal rises and interest falls month over month (reducing balance)", () => {
    const steps = generateAmortizationSchedule(fromRupees(100000), 10, 12);
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i].principal).toBeGreaterThan(steps[i - 1].principal);
      expect(steps[i].interest).toBeLessThan(steps[i - 1].interest);
    }
  });

  it("caps the final month's principal so the balance never goes negative", () => {
    // A tenure of 1 month must pay off the entire balance in one step,
    // exercising the cap directly rather than relying on 12 months of
    // rounding to happen to land on exactly zero.
    const steps = generateAmortizationSchedule(fromRupees(50000), 10, 1);
    expect(steps).toHaveLength(1);
    expect(steps[0].closingBalance).toBe(ZERO);
    expect(steps[0].principal).toBe(fromRupees(50000));
  });

  it("returns an empty schedule once tenure or balance is exhausted", () => {
    expect(generateAmortizationSchedule(fromRupees(100000), 10, 0)).toEqual([]);
    expect(generateAmortizationSchedule(ZERO, 10, 12)).toEqual([]);
  });

  it("zero-interest schedule is a flat, equal principal split", () => {
    const steps = generateAmortizationSchedule(fromRupees(120000), 0, 12);
    expect(steps.every((s) => s.principal === fromRupees(10000))).toBe(true);
    expect(steps.every((s) => s.interest === ZERO)).toBe(true);
  });
});

describe("nextExpectedRepayment", () => {
  it("returns the first schedule step", () => {
    const next = nextExpectedRepayment(fromRupees(100000), 10, 12);
    expect(next).not.toBeNull();
    expect(next!.monthIndex).toBe(0);
    expect(next!.emi).toBe(fromRupees(8791.59));
  });

  it("returns null once nothing remains to amortize", () => {
    expect(nextExpectedRepayment(fromRupees(100000), 10, 0)).toBeNull();
    expect(nextExpectedRepayment(ZERO, 10, 12)).toBeNull();
  });
});
