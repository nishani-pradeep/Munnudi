import { describe, it, expect } from "vitest";
import {
  computeRentalTarget,
  computeRentCollected,
  computeRentPending,
  computeCollectionRate,
  computeMaintenancePaid,
  computeOperatingProfit,
  computePrincipalRepaid,
  computeInterestPaid,
  computeOutstandingPrincipal,
  computeTotalDebtPayments,
  computeDelta,
  buildRentChartSeries,
  buildExpenseByCategorySeries,
  buildPrincipalVsInterestSeries,
  buildOperatingProfitSeries,
  buildUnitCollectionMatrix,
  computeMissingDataFlags,
  type RentMonthRow,
  type ExpenseMonthRow,
  type RepaymentMonthRow,
  type LoanOutstanding,
  type MonthReviewStatus,
  type Measure,
} from "./kpi";
import { monthKey, formatMonthShort } from "./month";
import { fromRupees, ZERO, paise } from "./money";

// ---------------------------------------------------------------------------
// Shared test fixtures
// ---------------------------------------------------------------------------

const JAN = monthKey("2025-01");
const FEB = monthKey("2025-02");
const MAR = monthKey("2025-03");

const U1 = "unit-1";
const U2 = "unit-2";

function rentRow(
  overrides: Partial<RentMonthRow> & { month: RentMonthRow["month"]; unitId: string },
): RentMonthRow {
  return {
    isBillable: true,
    expectedRentSnapshot: fromRupees(10000),
    paidAmount: fromRupees(10000),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// 1. computeRentalTarget
// ---------------------------------------------------------------------------

describe("computeRentalTarget", () => {
  it("sums expectedRentSnapshot for billable units only", () => {
    const rows: RentMonthRow[] = [
      rentRow({ month: JAN, unitId: U1, expectedRentSnapshot: fromRupees(15000) }),
      rentRow({ month: JAN, unitId: U2, expectedRentSnapshot: fromRupees(9000), isBillable: false }),
    ];
    const result = computeRentalTarget(rows, [JAN], "current");
    expect(result).toEqual({ kind: "value", paise: fromRupees(15000), basisMonths: 1 });
  });

  it("marks months with no census rows as missing", () => {
    const result = computeRentalTarget([], [JAN, FEB], "tillNow");
    expect(result.kind).toBe("unknown");
    if (result.kind === "unknown") {
      expect(result.missing).toEqual([JAN, FEB]);
    }
  });

  it("computes average across basis months only", () => {
    const rows: RentMonthRow[] = [
      rentRow({ month: JAN, unitId: U1, expectedRentSnapshot: fromRupees(10000) }),
      rentRow({ month: FEB, unitId: U1, expectedRentSnapshot: fromRupees(20000) }),
    ];
    const result = computeRentalTarget(rows, [JAN, FEB], "average");
    expect(result).toEqual({ kind: "value", paise: fromRupees(15000), basisMonths: 2 });
  });
});

// ---------------------------------------------------------------------------
// 2. computeRentCollected
// ---------------------------------------------------------------------------

describe("computeRentCollected", () => {
  it("sums paidAmount for billable units with non-null payment", () => {
    const rows: RentMonthRow[] = [
      rentRow({ month: JAN, unitId: U1, paidAmount: fromRupees(10000) }),
      rentRow({ month: JAN, unitId: U2, paidAmount: fromRupees(8000) }),
    ];
    const result = computeRentCollected(rows, [JAN], "current");
    expect(result).toEqual({ kind: "value", paise: fromRupees(18000), basisMonths: 1 });
  });

  it("NULL paidAmount makes the month missing, not zero (NULL != 0)", () => {
    const rows: RentMonthRow[] = [
      rentRow({ month: JAN, unitId: U1, paidAmount: fromRupees(10000) }),
      rentRow({ month: JAN, unitId: U2, paidAmount: null }),
    ];
    const result = computeRentCollected(rows, [JAN], "current");
    // Month is partial: one unit has data, one doesn't
    expect(result.kind).toBe("partial");
    if (result.kind === "partial") {
      expect(result.missing).toContain(JAN);
      // The known amount is still accumulated
      expect(result.paise).toBe(fromRupees(10000));
    }
  });

  it("self-occupied units are excluded entirely", () => {
    const rows: RentMonthRow[] = [
      rentRow({ month: JAN, unitId: U1, isBillable: false, paidAmount: fromRupees(5000) }),
    ];
    const result = computeRentCollected(rows, [JAN], "current");
    // No billable units -> month is missing
    expect(result.kind).toBe("unknown");
  });

  it("average divides by basis months, excluding unknown months", () => {
    // 10 months with data, 2 months without -> average divides by 10
    const months = Array.from({ length: 12 }, (_, i) =>
      monthKey(`2025-${String(i + 1).padStart(2, "0")}`),
    );
    const rows: RentMonthRow[] = months.slice(0, 10).map((m) =>
      rentRow({ month: m, unitId: U1, paidAmount: fromRupees(10000) }),
    );
    // months[10] and months[11] have no rows -> missing

    const result = computeRentCollected(rows, months, "average");
    expect(result.kind).toBe("partial");
    if (result.kind === "partial") {
      expect(result.basisMonths).toBe(10);
      // Average = total 100000 / 10 = 10000 rupees
      expect(result.paise).toBe(fromRupees(10000));
      expect(result.missing).toHaveLength(2);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. computeRentPending
// ---------------------------------------------------------------------------

describe("computeRentPending", () => {
  it("floors pending per month, not globally", () => {
    // Jan: overpaid by 5000 (target 10000, paid 15000) -> pending 0
    // Feb: underpaid by 10000 (target 20000, paid 10000) -> pending 10000
    // Total pending should be 10000, NOT max(30000 - 25000, 0) = 5000
    const rows: RentMonthRow[] = [
      rentRow({ month: JAN, unitId: U1, expectedRentSnapshot: fromRupees(10000), paidAmount: fromRupees(15000) }),
      rentRow({ month: FEB, unitId: U1, expectedRentSnapshot: fromRupees(20000), paidAmount: fromRupees(10000) }),
    ];
    const result = computeRentPending(rows, [JAN, FEB], "tillNow");
    expect(result).toEqual({ kind: "value", paise: fromRupees(10000), basisMonths: 2 });
  });

  it("returns zero when all months are fully paid or overpaid", () => {
    const rows: RentMonthRow[] = [
      rentRow({ month: JAN, unitId: U1, expectedRentSnapshot: fromRupees(10000), paidAmount: fromRupees(10000) }),
    ];
    const result = computeRentPending(rows, [JAN], "current");
    expect(result).toEqual({ kind: "value", paise: ZERO, basisMonths: 1 });
  });

  it("marks months with null paidAmount as missing", () => {
    const rows: RentMonthRow[] = [
      rentRow({ month: JAN, unitId: U1, paidAmount: null }),
    ];
    const result = computeRentPending(rows, [JAN], "current");
    expect(result.kind).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// 4. computeCollectionRate
// ---------------------------------------------------------------------------

describe("computeCollectionRate", () => {
  it("uses ratio-of-sums, NOT mean-of-ratios", () => {
    // Jan: target 100, collected 100 (100%)
    // Feb: target 1000, collected 500 (50%)
    // Correct: 600/1100 = 54.545...%, NOT (100+50)/2 = 75%
    const rows: RentMonthRow[] = [
      rentRow({ month: JAN, unitId: U1, expectedRentSnapshot: fromRupees(100), paidAmount: fromRupees(100) }),
      rentRow({ month: FEB, unitId: U1, expectedRentSnapshot: fromRupees(1000), paidAmount: fromRupees(500) }),
    ];
    const result = computeCollectionRate(rows, [JAN, FEB], "tillNow");
    expect(result.kind).toBe("value");
    if (result.kind === "value") {
      expect(result.percent).toBeCloseTo(54.545, 2);
      expect(result.percent).not.toBeCloseTo(75, 1);
    }
  });

  it("returns null when target is zero (no billable units)", () => {
    // Billable units exist but have zero expected rent
    const rows: RentMonthRow[] = [
      rentRow({ month: JAN, unitId: U1, expectedRentSnapshot: ZERO, paidAmount: ZERO }),
    ];
    const result = computeCollectionRate(rows, [JAN], "current");
    expect(result).toEqual({ kind: "null" });
  });

  it("returns unknown when all months are missing", () => {
    const result = computeCollectionRate([], [JAN], "current");
    expect(result.kind).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// 5. computeMaintenancePaid
// ---------------------------------------------------------------------------

describe("computeMaintenancePaid", () => {
  it("sums maintenance expenses for reviewed months", () => {
    const expenses: ExpenseMonthRow[] = [
      { month: JAN, amount: fromRupees(5000), isMaintenance: true, categoryName: "Plumber" },
      { month: JAN, amount: fromRupees(3000), isMaintenance: true, categoryName: "Electrician" },
      { month: JAN, amount: fromRupees(1000), isMaintenance: false, categoryName: "Misc" },
    ];
    const reviews: MonthReviewStatus[] = [
      { month: JAN, expensesReviewedAt: new Date(), loansReviewedAt: null },
    ];
    const result = computeMaintenancePaid(expenses, reviews, [JAN], "current");
    expect(result).toEqual({ kind: "value", paise: fromRupees(8000), basisMonths: 1 });
  });

  it("marks unreviewed months as missing", () => {
    const expenses: ExpenseMonthRow[] = [
      { month: JAN, amount: fromRupees(5000), isMaintenance: true, categoryName: "Plumber" },
    ];
    const reviews: MonthReviewStatus[] = [
      { month: JAN, expensesReviewedAt: null, loansReviewedAt: null },
    ];
    const result = computeMaintenancePaid(expenses, reviews, [JAN], "current");
    expect(result.kind).toBe("partial");
    if (result.kind === "partial") {
      expect(result.missing).toContain(JAN);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. computeOperatingProfit
// ---------------------------------------------------------------------------

describe("computeOperatingProfit", () => {
  it("subtracts maintenance from collected", () => {
    const collected: Measure = { kind: "value", paise: fromRupees(50000), basisMonths: 1 };
    const maintenance: Measure = { kind: "value", paise: fromRupees(20000), basisMonths: 1 };
    const result = computeOperatingProfit(collected, maintenance);
    expect(result).toEqual({ kind: "value", paise: fromRupees(30000), basisMonths: 1 });
  });

  it("propagates partial status from either input", () => {
    const collected: Measure = {
      kind: "partial",
      paise: fromRupees(50000),
      basisMonths: 1,
      missing: [JAN],
    };
    const maintenance: Measure = { kind: "value", paise: fromRupees(20000), basisMonths: 1 };
    const result = computeOperatingProfit(collected, maintenance);
    expect(result.kind).toBe("partial");
    if (result.kind === "partial") {
      expect(result.paise).toBe(fromRupees(30000));
      expect(result.missing).toContain(JAN);
    }
  });

  it("returns unknown when either input is unknown", () => {
    const collected: Measure = { kind: "unknown", missing: [JAN] };
    const maintenance: Measure = { kind: "value", paise: fromRupees(20000), basisMonths: 1 };
    const result = computeOperatingProfit(collected, maintenance);
    expect(result.kind).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// 7 & 8. computePrincipalRepaid / computeInterestPaid
// ---------------------------------------------------------------------------

describe("computePrincipalRepaid", () => {
  it("sums principal payments across months", () => {
    const repayments: RepaymentMonthRow[] = [
      { month: JAN, loanId: "L1", principalPaid: fromRupees(5000), interestPaid: fromRupees(2000) },
      { month: FEB, loanId: "L1", principalPaid: fromRupees(5500), interestPaid: fromRupees(1800) },
    ];
    const loans = [{ loanId: "L1", expectsMonthlyPayment: true }];
    const result = computePrincipalRepaid(repayments, loans, [JAN, FEB], "tillNow");
    expect(result).toEqual({ kind: "value", paise: fromRupees(10500), basisMonths: 2 });
  });

  it("gold loan with zero principal is valid, not missing", () => {
    const repayments: RepaymentMonthRow[] = [
      { month: JAN, loanId: "L1", principalPaid: ZERO, interestPaid: fromRupees(3000) },
    ];
    const loans = [{ loanId: "L1", expectsMonthlyPayment: true }];
    const result = computePrincipalRepaid(repayments, loans, [JAN], "current");
    expect(result).toEqual({ kind: "value", paise: ZERO, basisMonths: 1 });
  });

  it("marks months missing if a monthly-payment loan has no repayment row", () => {
    const repayments: RepaymentMonthRow[] = [
      { month: JAN, loanId: "L1", principalPaid: fromRupees(5000), interestPaid: fromRupees(2000) },
      // No Feb row for L1
    ];
    const loans = [{ loanId: "L1", expectsMonthlyPayment: true }];
    const result = computePrincipalRepaid(repayments, loans, [JAN, FEB], "tillNow");
    expect(result.kind).toBe("partial");
    if (result.kind === "partial") {
      expect(result.missing).toContain(FEB);
    }
  });

  it("ignores non-monthly-payment loans for missing detection", () => {
    // Gold loans don't expect monthly payments
    const repayments: RepaymentMonthRow[] = [];
    const loans = [{ loanId: "L1", expectsMonthlyPayment: false }];
    const result = computePrincipalRepaid(repayments, loans, [JAN], "current");
    // No monthly loans -> no missing, but also no data -> basisMonths 1, ZERO
    expect(result).toEqual({ kind: "value", paise: ZERO, basisMonths: 1 });
  });
});

describe("computeInterestPaid", () => {
  it("sums interest payments", () => {
    const repayments: RepaymentMonthRow[] = [
      { month: JAN, loanId: "L1", principalPaid: fromRupees(5000), interestPaid: fromRupees(2000) },
      { month: JAN, loanId: "L2", principalPaid: fromRupees(3000), interestPaid: fromRupees(1500) },
    ];
    const loans = [
      { loanId: "L1", expectsMonthlyPayment: true },
      { loanId: "L2", expectsMonthlyPayment: true },
    ];
    const result = computeInterestPaid(repayments, loans, [JAN], "current");
    expect(result).toEqual({ kind: "value", paise: fromRupees(3500), basisMonths: 1 });
  });
});

// ---------------------------------------------------------------------------
// 9. computeOutstandingPrincipal
// ---------------------------------------------------------------------------

describe("computeOutstandingPrincipal", () => {
  it("sums current outstandings (stock, not flow)", () => {
    const outstandings: LoanOutstanding[] = [
      { loanId: "L1", loanName: "Home Loan", outstanding: fromRupees(500000) },
      { loanId: "L2", loanName: "Gold Loan", outstanding: fromRupees(100000) },
    ];
    const result = computeOutstandingPrincipal(outstandings);
    expect(result).toEqual({ kind: "value", paise: fromRupees(600000) });
  });

  it("returns unknown when there are no outstandings", () => {
    const result = computeOutstandingPrincipal([]);
    expect(result).toEqual({ kind: "unknown" });
  });
});

// ---------------------------------------------------------------------------
// 10. computeTotalDebtPayments
// ---------------------------------------------------------------------------

describe("computeTotalDebtPayments", () => {
  it("sums principal and interest measures", () => {
    const principal: Measure = { kind: "value", paise: fromRupees(5000), basisMonths: 1 };
    const interest: Measure = { kind: "value", paise: fromRupees(2000), basisMonths: 1 };
    const result = computeTotalDebtPayments(principal, interest);
    expect(result).toEqual({ kind: "value", paise: fromRupees(7000), basisMonths: 1 });
  });

  it("merges missing lists from both inputs", () => {
    const principal: Measure = { kind: "partial", paise: fromRupees(5000), basisMonths: 1, missing: [JAN] };
    const interest: Measure = { kind: "partial", paise: fromRupees(2000), basisMonths: 1, missing: [FEB] };
    const result = computeTotalDebtPayments(principal, interest);
    expect(result.kind).toBe("partial");
    if (result.kind === "partial") {
      expect(result.missing).toContain(JAN);
      expect(result.missing).toContain(FEB);
    }
  });

  it("propagates unknown from either input", () => {
    const principal: Measure = { kind: "unknown", missing: [JAN] };
    const interest: Measure = { kind: "value", paise: fromRupees(2000), basisMonths: 1 };
    const result = computeTotalDebtPayments(principal, interest);
    expect(result.kind).toBe("unknown");
  });
});

// ---------------------------------------------------------------------------
// 11. computeDelta
// ---------------------------------------------------------------------------

describe("computeDelta", () => {
  it("computes positive delta as 'up'", () => {
    const current: Measure = { kind: "value", paise: fromRupees(50000), basisMonths: 1 };
    const prior: Measure = { kind: "value", paise: fromRupees(40000), basisMonths: 1 };
    const result = computeDelta(current, prior);
    expect(result).toEqual({ paise: fromRupees(10000), direction: "up" });
  });

  it("computes negative delta as 'down'", () => {
    const current: Measure = { kind: "value", paise: fromRupees(30000), basisMonths: 1 };
    const prior: Measure = { kind: "value", paise: fromRupees(40000), basisMonths: 1 };
    const result = computeDelta(current, prior);
    expect(result).toEqual({ paise: paise(-1000000), direction: "down" });
  });

  it("returns flat when both are equal", () => {
    const current: Measure = { kind: "value", paise: fromRupees(40000), basisMonths: 1 };
    const prior: Measure = { kind: "value", paise: fromRupees(40000), basisMonths: 1 };
    const result = computeDelta(current, prior);
    expect(result).toEqual({ paise: ZERO, direction: "flat" });
  });

  it("returns null when either measure is unknown", () => {
    const current: Measure = { kind: "unknown", missing: [JAN] };
    const prior: Measure = { kind: "value", paise: fromRupees(40000), basisMonths: 1 };
    expect(computeDelta(current, prior)).toBeNull();
    expect(computeDelta(prior, current)).toBeNull();
  });

  it("works with partial measures", () => {
    const current: Measure = { kind: "partial", paise: fromRupees(50000), basisMonths: 1, missing: [FEB] };
    const prior: Measure = { kind: "value", paise: fromRupees(40000), basisMonths: 1 };
    const result = computeDelta(current, prior);
    expect(result).toEqual({ paise: fromRupees(10000), direction: "up" });
  });
});

// ---------------------------------------------------------------------------
// 12. buildRentChartSeries
// ---------------------------------------------------------------------------

describe("buildRentChartSeries", () => {
  it("returns per-month expected and collected in rupees", () => {
    const rows: RentMonthRow[] = [
      rentRow({ month: JAN, unitId: U1, expectedRentSnapshot: fromRupees(15000), paidAmount: fromRupees(15000) }),
      rentRow({ month: JAN, unitId: U2, expectedRentSnapshot: fromRupees(9000), paidAmount: fromRupees(8000) }),
      rentRow({ month: FEB, unitId: U1, expectedRentSnapshot: fromRupees(15000), paidAmount: fromRupees(15000) }),
    ];
    const series = buildRentChartSeries(rows, [JAN, FEB]);
    expect(series).toHaveLength(2);
    expect(series[0].expected).toBe(24000);
    expect(series[0].collected).toBe(23000);
    expect(series[1].expected).toBe(15000);
    expect(series[1].collected).toBe(15000);
  });

  it("includes all months even if no data (chart continuity)", () => {
    const series = buildRentChartSeries([], [JAN, FEB, MAR]);
    expect(series).toHaveLength(3);
    expect(series[0]).toEqual({ month: formatMonthShort(JAN), expected: 0, collected: 0 });
    expect(series[1]).toEqual({ month: formatMonthShort(FEB), expected: 0, collected: 0 });
    expect(series[2]).toEqual({ month: formatMonthShort(MAR), expected: 0, collected: 0 });
  });

  it("excludes self-occupied units from chart totals", () => {
    const rows: RentMonthRow[] = [
      rentRow({ month: JAN, unitId: U1, expectedRentSnapshot: fromRupees(15000), paidAmount: fromRupees(15000) }),
      rentRow({ month: JAN, unitId: U2, expectedRentSnapshot: fromRupees(9000), paidAmount: fromRupees(9000), isBillable: false }),
    ];
    const series = buildRentChartSeries(rows, [JAN]);
    expect(series[0].expected).toBe(15000);
    expect(series[0].collected).toBe(15000);
  });
});

// ---------------------------------------------------------------------------
// 13. buildExpenseByCategorySeries
// ---------------------------------------------------------------------------

describe("buildExpenseByCategorySeries", () => {
  it("pivots expenses by category per month", () => {
    const expenses: ExpenseMonthRow[] = [
      { month: JAN, amount: fromRupees(5000), isMaintenance: true, categoryName: "Plumber" },
      { month: JAN, amount: fromRupees(3000), isMaintenance: true, categoryName: "Electrician" },
      { month: FEB, amount: fromRupees(2000), isMaintenance: true, categoryName: "Plumber" },
    ];
    const series = buildExpenseByCategorySeries(expenses, [JAN, FEB]);
    expect(series).toHaveLength(2);
    expect(series[0]["Plumber"]).toBe(5000);
    expect(series[0]["Electrician"]).toBe(3000);
    expect(series[1]["Plumber"]).toBe(2000);
    expect(series[1]["Electrician"]).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 14. buildPrincipalVsInterestSeries
// ---------------------------------------------------------------------------

describe("buildPrincipalVsInterestSeries", () => {
  it("returns per-month principal and interest in rupees", () => {
    const repayments: RepaymentMonthRow[] = [
      { month: JAN, loanId: "L1", principalPaid: fromRupees(5000), interestPaid: fromRupees(2000) },
      { month: JAN, loanId: "L2", principalPaid: fromRupees(3000), interestPaid: fromRupees(1500) },
      { month: FEB, loanId: "L1", principalPaid: fromRupees(5500), interestPaid: fromRupees(1800) },
    ];
    const series = buildPrincipalVsInterestSeries(repayments, [JAN, FEB]);
    expect(series[0].principal).toBe(8000);
    expect(series[0].interest).toBe(3500);
    expect(series[1].principal).toBe(5500);
    expect(series[1].interest).toBe(1800);
  });

  it("shows zero for months with no repayments", () => {
    const series = buildPrincipalVsInterestSeries([], [JAN]);
    expect(series[0]).toEqual({ month: formatMonthShort(JAN), principal: 0, interest: 0 });
  });
});

// ---------------------------------------------------------------------------
// 15. buildOperatingProfitSeries
// ---------------------------------------------------------------------------

describe("buildOperatingProfitSeries", () => {
  it("computes per-month profit = collected - expenses", () => {
    const rentRows: RentMonthRow[] = [
      rentRow({ month: JAN, unitId: U1, paidAmount: fromRupees(15000) }),
    ];
    const expenses: ExpenseMonthRow[] = [
      { month: JAN, amount: fromRupees(5000), isMaintenance: true, categoryName: "Plumber" },
    ];
    const series = buildOperatingProfitSeries(rentRows, expenses, [JAN]);
    expect(series[0].profit).toBe(10000);
  });
});

// ---------------------------------------------------------------------------
// 16. buildUnitCollectionMatrix
// ---------------------------------------------------------------------------

describe("buildUnitCollectionMatrix", () => {
  it("categorizes payment status per unit per month", () => {
    const rows: RentMonthRow[] = [
      rentRow({ month: JAN, unitId: U1, expectedRentSnapshot: fromRupees(10000), paidAmount: fromRupees(10000) }),
      rentRow({ month: JAN, unitId: U2, expectedRentSnapshot: fromRupees(10000), paidAmount: fromRupees(5000) }),
      rentRow({ month: FEB, unitId: U1, expectedRentSnapshot: fromRupees(10000), paidAmount: null }),
      rentRow({ month: FEB, unitId: U2, expectedRentSnapshot: fromRupees(10000), paidAmount: ZERO }),
    ];
    const matrix = buildUnitCollectionMatrix(rows, [JAN, FEB]);
    const u1 = matrix.find((m) => m.unitId === U1)!;
    const u2 = matrix.find((m) => m.unitId === U2)!;
    expect(u1.months[JAN]).toBe("paid");
    expect(u1.months[FEB]).toBe("pending");
    expect(u2.months[JAN]).toBe("partial");
    expect(u2.months[FEB]).toBe("unpaid");
  });

  it("marks self-occupied units", () => {
    const rows: RentMonthRow[] = [
      rentRow({ month: JAN, unitId: U1, isBillable: false }),
    ];
    const matrix = buildUnitCollectionMatrix(rows, [JAN]);
    expect(matrix[0].months[JAN]).toBe("self");
  });
});

// ---------------------------------------------------------------------------
// 17. computeMissingDataFlags
// ---------------------------------------------------------------------------

describe("computeMissingDataFlags", () => {
  it("flags billable units without rent payment", () => {
    const rows: RentMonthRow[] = [
      rentRow({ month: JAN, unitId: U1, paidAmount: null }),
      rentRow({ month: JAN, unitId: U2, paidAmount: fromRupees(10000) }),
    ];
    const flags = computeMissingDataFlags(rows, [], [], JAN);
    expect(flags).toHaveLength(1);
    expect(flags[0].severity).toBe("warning");
    expect(flags[0].message).toContain("1 unit(s)");
  });

  it("flags missing rent census", () => {
    const flags = computeMissingDataFlags([], [], [], JAN);
    expect(flags.some((f) => f.message.includes("No rent census"))).toBe(true);
  });

  it("flags loans missing repayment", () => {
    const loans = [{ loanId: "L1", name: "Home Loan", expectsMonthlyPayment: true }];
    const flags = computeMissingDataFlags(
      [rentRow({ month: JAN, unitId: U1 })], // has rent data
      [], // no repayments
      loans,
      JAN,
    );
    expect(flags.some((f) => f.message.includes("Home Loan"))).toBe(true);
    expect(flags.find((f) => f.message.includes("Home Loan"))!.severity).toBe("info");
  });

  it("does not flag loans without expectsMonthlyPayment", () => {
    const loans = [{ loanId: "L1", name: "Gold Loan", expectsMonthlyPayment: false }];
    const flags = computeMissingDataFlags(
      [rentRow({ month: JAN, unitId: U1 })],
      [],
      loans,
      JAN,
    );
    expect(flags.some((f) => f.message.includes("Gold Loan"))).toBe(false);
  });
});
