/**
 * Pure KPI calculation engine for Munnudi dashboard.
 *
 * Every function here is a pure function: no DB, no framework, no side-effects.
 * Repositories fetch the inputs; this module only computes derived KPIs.
 *
 * All monetary values are integer paise (branded Paise). Chart builders convert
 * to rupees (paise / 100) for readable axis labels. Scope controls aggregation:
 * "current" = single month, "tillNow" = cumulative sum, "average" = mean per month.
 */

import {
  type Paise,
  ZERO,
  paise,
  sum,
  add,
  subtract,
  clampAtZero,
} from "./money";
import { type MonthKey, formatMonthShort } from "./month";

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export type KpiScope = "current" | "tillNow" | "average";

export type Measure =
  | { kind: "value"; paise: Paise; basisMonths: number }
  | { kind: "partial"; paise: Paise; basisMonths: number; missing: MonthKey[] }
  | { kind: "unknown"; missing: MonthKey[] };

export type RatioMeasure =
  | { kind: "value"; percent: number; basisMonths: number }
  | { kind: "partial"; percent: number; basisMonths: number; missing: MonthKey[] }
  | { kind: "unknown"; missing: MonthKey[] }
  | { kind: "null" }; // target is zero, ratio undefined

export type StockMeasure =
  | { kind: "value"; paise: Paise }
  | { kind: "unknown" };

export type Delta =
  | { paise: Paise; direction: "up" | "down" | "flat" }
  | null;

// Input types (what repositories hand to domain)

export type RentMonthRow = {
  month: MonthKey;
  unitId: string;
  isBillable: boolean;
  expectedRentSnapshot: Paise;
  paidAmount: Paise | null;
};

export type ExpenseMonthRow = {
  month: MonthKey;
  amount: Paise;
  isMaintenance: boolean;
  categoryName: string;
};

export type RepaymentMonthRow = {
  month: MonthKey;
  loanId: string;
  principalPaid: Paise;
  interestPaid: Paise;
};

export type LoanOutstanding = {
  loanId: string;
  loanName: string;
  outstanding: Paise;
};

export type MonthReviewStatus = {
  month: MonthKey;
  expensesReviewedAt: Date | null;
  loansReviewedAt: Date | null;
};

export type MissingDataFlag = {
  severity: "warning" | "info";
  message: string;
  href: string;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Group rows by month. Returns a Map where every month in `months` is present
 * (possibly with an empty array).
 */
function groupByMonth<T extends { month: MonthKey }>(
  rows: readonly T[],
  months: readonly MonthKey[],
): Map<MonthKey, T[]> {
  const map = new Map<MonthKey, T[]>();
  for (const m of months) map.set(m, []);
  for (const r of rows) {
    const bucket = map.get(r.month);
    if (bucket) bucket.push(r);
  }
  return map;
}

/**
 * Apply scope to a total paise value and basis month count.
 */
function applyScope(
  totalPaise: Paise,
  basisMonths: number,
  scope: KpiScope,
): Paise {
  if (scope === "average" && basisMonths > 0) {
    return paise(Math.round(totalPaise / basisMonths));
  }
  return totalPaise;
}

/**
 * Wrap a computed paise total into the correct Measure variant.
 *
 * `hasPartialData` should be true when some data was accumulated from
 * months that are counted as "missing" (e.g. a month where only some
 * units have entries). This prevents the measure from being reported
 * as fully "unknown" when partial data exists.
 */
function wrapMeasure(
  totalPaise: Paise,
  basisMonths: number,
  missing: MonthKey[],
  scope: KpiScope,
  hasPartialData = false,
): Measure {
  const scopedPaise = applyScope(totalPaise, basisMonths, scope);

  if (basisMonths === 0 && missing.length > 0 && !hasPartialData) {
    return { kind: "unknown", missing };
  }
  if (missing.length > 0) {
    return { kind: "partial", paise: scopedPaise, basisMonths, missing };
  }
  return { kind: "value", paise: scopedPaise, basisMonths };
}

// ---------------------------------------------------------------------------
// KPI functions
// ---------------------------------------------------------------------------

/**
 * 1. Rental target: SUM(expectedRentSnapshot) WHERE isBillable.
 *
 * Months with zero census rows are "missing" -- we cannot distinguish
 * "no units exist" from "census not yet generated".
 */
export function computeRentalTarget(
  rows: RentMonthRow[],
  months: MonthKey[],
  scope: KpiScope,
): Measure {
  const byMonth = groupByMonth(rows, months);
  let total = ZERO;
  let basisMonths = 0;
  const missing: MonthKey[] = [];

  for (const m of months) {
    const monthRows = byMonth.get(m)!;
    if (monthRows.length === 0) {
      missing.push(m);
      continue;
    }
    basisMonths++;
    const monthTarget = sum(
      monthRows.filter((r) => r.isBillable).map((r) => r.expectedRentSnapshot),
    );
    total = add(total, monthTarget);
  }

  return wrapMeasure(total, basisMonths, missing, scope);
}

/**
 * 2. Rent collected: SUM(paidAmount) WHERE isBillable AND paidAmount IS NOT NULL.
 *
 * A null paidAmount means "not yet entered" -- the month is treated as missing
 * if ANY billable unit in that month has a null paidAmount.
 */
export function computeRentCollected(
  rows: RentMonthRow[],
  months: MonthKey[],
  scope: KpiScope,
): Measure {
  const byMonth = groupByMonth(rows, months);
  let total = ZERO;
  let basisMonths = 0;
  const missing: MonthKey[] = [];
  let hasPartialData = false;

  for (const m of months) {
    const monthRows = byMonth.get(m)!;
    const billable = monthRows.filter((r) => r.isBillable);

    if (billable.length === 0) {
      // No census data at all
      missing.push(m);
      continue;
    }

    const hasNull = billable.some((r) => r.paidAmount === null);
    if (hasNull) {
      missing.push(m);
      // Still add whatever IS known to the total for partial reporting
      const known = billable
        .filter((r) => r.paidAmount !== null)
        .map((r) => r.paidAmount!);
      if (known.length > 0) hasPartialData = true;
      total = add(total, sum(known));
      continue;
    }

    basisMonths++;
    const monthCollected = sum(billable.map((r) => r.paidAmount!));
    total = add(total, monthCollected);
  }

  return wrapMeasure(total, basisMonths, missing, scope, hasPartialData);
}

/**
 * 3. Rent pending: PER-MONTH MAX(target - collected, 0), then sum.
 *
 * The floor is per-month: overpayment in January does NOT offset underpayment
 * in February. This prevents a misleading low-pending figure when one month
 * overpays but another is seriously short.
 */
export function computeRentPending(
  rows: RentMonthRow[],
  months: MonthKey[],
  scope: KpiScope,
): Measure {
  const byMonth = groupByMonth(rows, months);
  let total = ZERO;
  let basisMonths = 0;
  const missing: MonthKey[] = [];

  for (const m of months) {
    const monthRows = byMonth.get(m)!;
    const billable = monthRows.filter((r) => r.isBillable);

    if (billable.length === 0) {
      missing.push(m);
      continue;
    }

    const hasNull = billable.some((r) => r.paidAmount === null);
    if (hasNull) {
      missing.push(m);
      continue;
    }

    basisMonths++;
    const monthTarget = sum(billable.map((r) => r.expectedRentSnapshot));
    const monthCollected = sum(billable.map((r) => r.paidAmount!));
    const monthPending = clampAtZero(subtract(monthTarget, monthCollected));
    total = add(total, monthPending);
  }

  return wrapMeasure(total, basisMonths, missing, scope);
}

/**
 * 4. Collection rate: (total collected / total target) * 100.
 *
 * CRITICAL: this is the ratio of sums, NOT the mean of per-month ratios.
 * Example: Jan target 100, collected 100 (100%); Feb target 1000, collected 500
 * (50%). Correct rate = 600/1100 = 54.5%, NOT (100+50)/2 = 75%.
 */
export function computeCollectionRate(
  rows: RentMonthRow[],
  months: MonthKey[],
  scope: KpiScope,
): RatioMeasure {
  void scope; // kept for API consistency; ratio has no average variant
  const byMonth = groupByMonth(rows, months);
  let totalTarget = ZERO;
  let totalCollected = ZERO;
  let basisMonths = 0;
  const missing: MonthKey[] = [];

  for (const m of months) {
    const monthRows = byMonth.get(m)!;
    const billable = monthRows.filter((r) => r.isBillable);

    if (billable.length === 0) {
      missing.push(m);
      continue;
    }

    const hasNull = billable.some((r) => r.paidAmount === null);
    if (hasNull) {
      missing.push(m);
      continue;
    }

    basisMonths++;
    totalTarget = add(
      totalTarget,
      sum(billable.map((r) => r.expectedRentSnapshot)),
    );
    totalCollected = add(
      totalCollected,
      sum(billable.map((r) => r.paidAmount!)),
    );
  }

  if (basisMonths === 0 && missing.length > 0) {
    return { kind: "unknown", missing };
  }

  if (totalTarget === ZERO) {
    return { kind: "null" };
  }

  const percent = (totalCollected / totalTarget) * 100;

  if (missing.length > 0) {
    return { kind: "partial", percent, basisMonths, missing };
  }
  return { kind: "value", percent, basisMonths };
}

/**
 * 5. Maintenance paid: SUM(amount) WHERE isMaintenance.
 *
 * Months where the expenses haven't been reviewed are "missing" -- we
 * cannot distinguish zero maintenance from not-yet-entered.
 */
export function computeMaintenancePaid(
  expenses: ExpenseMonthRow[],
  reviews: MonthReviewStatus[],
  months: MonthKey[],
  scope: KpiScope,
): Measure {
  const reviewByMonth = new Map(reviews.map((r) => [r.month, r]));
  const expenseByMonth = groupByMonth(expenses, months);
  let total = ZERO;
  let basisMonths = 0;
  const missing: MonthKey[] = [];
  let hasPartialData = false;

  for (const m of months) {
    const review = reviewByMonth.get(m);
    if (!review || review.expensesReviewedAt === null) {
      missing.push(m);
      // Still add whatever maintenance amounts exist for partial data
      const monthExpenses = expenseByMonth.get(m)!;
      const maint = monthExpenses
        .filter((e) => e.isMaintenance)
        .map((e) => e.amount);
      if (maint.length > 0) hasPartialData = true;
      total = add(total, sum(maint));
      continue;
    }

    basisMonths++;
    const monthExpenses = expenseByMonth.get(m)!;
    const maint = monthExpenses
      .filter((e) => e.isMaintenance)
      .map((e) => e.amount);
    total = add(total, sum(maint));
  }

  return wrapMeasure(total, basisMonths, missing, scope, hasPartialData);
}

/**
 * 6. Operating profit = collected - maintenance.
 *
 * Propagates partial/unknown from inputs.
 */
export function computeOperatingProfit(
  collected: Measure,
  maintenance: Measure,
): Measure {
  if (collected.kind === "unknown" || maintenance.kind === "unknown") {
    const missing = [
      ...(collected.kind === "unknown" ? collected.missing : []),
      ...(maintenance.kind === "unknown" ? maintenance.missing : []),
    ];
    return { kind: "unknown", missing };
  }

  const profit = subtract(collected.paise, maintenance.paise);
  const allMissing = [
    ...(collected.kind === "partial" ? collected.missing : []),
    ...(maintenance.kind === "partial" ? maintenance.missing : []),
  ];
  // Deduplicate missing months
  const uniqueMissing = Array.from(new Set(allMissing)) as MonthKey[];
  const basisMonths = Math.max(collected.basisMonths, maintenance.basisMonths);

  if (uniqueMissing.length > 0) {
    return { kind: "partial", paise: profit, basisMonths, missing: uniqueMissing };
  }
  return { kind: "value", paise: profit, basisMonths };
}

/**
 * 7. Principal repaid: SUM(principalPaid).
 *
 * Missing = months where a loan with expectsMonthlyPayment has no repayment row.
 */
export function computePrincipalRepaid(
  repayments: RepaymentMonthRow[],
  loans: { loanId: string; expectsMonthlyPayment: boolean }[],
  months: MonthKey[],
  scope: KpiScope,
): Measure {
  const monthlyLoans = loans.filter((l) => l.expectsMonthlyPayment);
  const byMonth = groupByMonth(repayments, months);
  let total = ZERO;
  let basisMonths = 0;
  const missing: MonthKey[] = [];

  for (const m of months) {
    const monthRows = byMonth.get(m)!;
    const loanIdsWithData = new Set(monthRows.map((r) => r.loanId));
    const hasMissing = monthlyLoans.some((l) => !loanIdsWithData.has(l.loanId));

    if (hasMissing) {
      missing.push(m);
      // Still tally whatever data exists
      total = add(total, sum(monthRows.map((r) => r.principalPaid)));
      continue;
    }

    basisMonths++;
    total = add(total, sum(monthRows.map((r) => r.principalPaid)));
  }

  return wrapMeasure(total, basisMonths, missing, scope);
}

/**
 * 8. Interest paid: SUM(interestPaid), same missing logic as principal.
 */
export function computeInterestPaid(
  repayments: RepaymentMonthRow[],
  loans: { loanId: string; expectsMonthlyPayment: boolean }[],
  months: MonthKey[],
  scope: KpiScope,
): Measure {
  const monthlyLoans = loans.filter((l) => l.expectsMonthlyPayment);
  const byMonth = groupByMonth(repayments, months);
  let total = ZERO;
  let basisMonths = 0;
  const missing: MonthKey[] = [];

  for (const m of months) {
    const monthRows = byMonth.get(m)!;
    const loanIdsWithData = new Set(monthRows.map((r) => r.loanId));
    const hasMissing = monthlyLoans.some((l) => !loanIdsWithData.has(l.loanId));

    if (hasMissing) {
      missing.push(m);
      total = add(total, sum(monthRows.map((r) => r.interestPaid)));
      continue;
    }

    basisMonths++;
    total = add(total, sum(monthRows.map((r) => r.interestPaid)));
  }

  return wrapMeasure(total, basisMonths, missing, scope);
}

/**
 * 9. Outstanding principal: a stock (point-in-time), not a flow.
 *
 * No scope or averaging -- just the current sum of outstandings.
 */
export function computeOutstandingPrincipal(
  outstandings: LoanOutstanding[],
): StockMeasure {
  if (outstandings.length === 0) {
    return { kind: "unknown" };
  }
  return {
    kind: "value",
    paise: sum(outstandings.map((o) => o.outstanding)),
  };
}

/**
 * 10. Total debt payments = principal + interest.
 */
export function computeTotalDebtPayments(
  principal: Measure,
  interest: Measure,
): Measure {
  if (principal.kind === "unknown" && interest.kind === "unknown") {
    const missing = principal.missing.concat(interest.missing);
    const unique = Array.from(new Set(missing)) as MonthKey[];
    return { kind: "unknown", missing: unique };
  }

  if (principal.kind === "unknown") {
    return { kind: "unknown", missing: principal.missing };
  }
  if (interest.kind === "unknown") {
    return { kind: "unknown", missing: interest.missing };
  }

  const totalPaise = add(principal.paise, interest.paise);
  const allMissing = [
    ...(principal.kind === "partial" ? principal.missing : []),
    ...(interest.kind === "partial" ? interest.missing : []),
  ];
  const uniqueMissing = Array.from(new Set(allMissing)) as MonthKey[];
  const basisMonths = Math.max(principal.basisMonths, interest.basisMonths);

  if (uniqueMissing.length > 0) {
    return { kind: "partial", paise: totalPaise, basisMonths, missing: uniqueMissing };
  }
  return { kind: "value", paise: totalPaise, basisMonths };
}

/**
 * 11. Delta between two measures (e.g. current vs prior month).
 */
export function computeDelta(current: Measure, prior: Measure): Delta {
  if (current.kind === "unknown" || prior.kind === "unknown") {
    return null;
  }
  const diff = subtract(current.paise, prior.paise);
  const direction: "up" | "down" | "flat" =
    diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  return { paise: diff, direction };
}

// ---------------------------------------------------------------------------
// Chart data builders
// ---------------------------------------------------------------------------

/**
 * 12. Rent chart series: per-month expected vs collected in rupees.
 */
export function buildRentChartSeries(
  rows: RentMonthRow[],
  months: MonthKey[],
): { month: string; expected: number; collected: number }[] {
  const byMonth = groupByMonth(rows, months);

  return months.map((m) => {
    const monthRows = byMonth.get(m)!;
    const billable = monthRows.filter((r) => r.isBillable);
    const expected = sum(billable.map((r) => r.expectedRentSnapshot));
    const collected = sum(
      billable.filter((r) => r.paidAmount !== null).map((r) => r.paidAmount!),
    );
    return {
      month: formatMonthShort(m),
      expected: expected / 100,
      collected: collected / 100,
    };
  });
}

/**
 * 13. Expense breakdown by category per month.
 */
export function buildExpenseByCategorySeries(
  expenses: ExpenseMonthRow[],
  months: MonthKey[],
): { month: string; [category: string]: number | string }[] {
  // Discover all category names
  const categorySet = new Set<string>();
  for (const e of expenses) categorySet.add(e.categoryName);
  const categories = Array.from(categorySet);

  const byMonth = groupByMonth(expenses, months);

  return months.map((m) => {
    const monthExpenses = byMonth.get(m)!;
    const row: { month: string; [category: string]: number | string } = {
      month: formatMonthShort(m),
    };

    for (const cat of categories) {
      const catExpenses = monthExpenses.filter((e) => e.categoryName === cat);
      row[cat] = sum(catExpenses.map((e) => e.amount)) / 100;
    }

    return row;
  });
}

/**
 * 14. Principal vs interest per month.
 */
export function buildPrincipalVsInterestSeries(
  repayments: RepaymentMonthRow[],
  months: MonthKey[],
): { month: string; principal: number; interest: number }[] {
  const byMonth = groupByMonth(repayments, months);

  return months.map((m) => {
    const monthRows = byMonth.get(m)!;
    return {
      month: formatMonthShort(m),
      principal: sum(monthRows.map((r) => r.principalPaid)) / 100,
      interest: sum(monthRows.map((r) => r.interestPaid)) / 100,
    };
  });
}

/**
 * 15. Operating profit per month = collected rent - all expenses.
 */
export function buildOperatingProfitSeries(
  rentRows: RentMonthRow[],
  expenses: ExpenseMonthRow[],
  months: MonthKey[],
): { month: string; profit: number }[] {
  const rentByMonth = groupByMonth(rentRows, months);
  const expenseByMonth = groupByMonth(expenses, months);

  return months.map((m) => {
    const billable = rentByMonth.get(m)!.filter((r) => r.isBillable);
    const collected = sum(
      billable.filter((r) => r.paidAmount !== null).map((r) => r.paidAmount!),
    );
    const totalExpenses = sum(expenseByMonth.get(m)!.map((e) => e.amount));
    const profit = subtract(collected, totalExpenses);
    return {
      month: formatMonthShort(m),
      profit: profit / 100,
    };
  });
}

/**
 * 16. Unit collection matrix: payment status per unit per month.
 *
 * Status codes: "paid" (full), "partial", "unpaid" (zero), "pending" (null),
 * "self" (non-billable), "" (no census row).
 */
export function buildUnitCollectionMatrix(
  rows: RentMonthRow[],
  months: MonthKey[],
): { unitId: string; unitCode: string; months: Record<string, string> }[] {
  // Discover all unique units
  const unitIds = Array.from(new Set(rows.map((r) => r.unitId)));

  return unitIds.map((unitId) => {
    const unitRows = rows.filter((r) => r.unitId === unitId);
    const monthStatuses: Record<string, string> = {};

    for (const m of months) {
      const row = unitRows.find((r) => r.month === m);
      if (!row) {
        monthStatuses[m] = "";
        continue;
      }
      if (!row.isBillable) {
        monthStatuses[m] = "self";
        continue;
      }
      if (row.paidAmount === null) {
        monthStatuses[m] = "pending";
        continue;
      }
      if (row.paidAmount === ZERO) {
        monthStatuses[m] = "unpaid";
      } else if (row.paidAmount >= row.expectedRentSnapshot) {
        monthStatuses[m] = "paid";
      } else {
        monthStatuses[m] = "partial";
      }
    }

    return {
      unitId,
      unitCode: unitId, // caller can enrich with display name
      months: monthStatuses,
    };
  });
}

/**
 * 17. Loan balance series: outstanding per loan per month, plus a total line.
 *
 * Input rows come from `listLedgerForRange` -- they already have
 * effectiveOutstanding as a Postgres numeric string. The caller must
 * parsePaise them before passing them in.
 */
export type LoanLedgerPoint = {
  month: MonthKey;
  loanId: string;
  loanName: string;
  outstanding: Paise;
};

export function buildLoanBalanceSeries(
  rows: LoanLedgerPoint[],
  months: MonthKey[],
): { month: string; total: number; [loanName: string]: number | string }[] {
  const loanNames = Array.from(new Set(rows.map((r) => r.loanName)));
  const byMonth = groupByMonth(rows, months);

  return months.map((m) => {
    const monthRows = byMonth.get(m)!;
    const row: { month: string; total: number; [loanName: string]: number | string } = {
      month: formatMonthShort(m),
      total: 0,
    };

    let monthTotal = ZERO;
    for (const name of loanNames) {
      const loan = monthRows.find((r) => r.loanName === name);
      const val = loan ? loan.outstanding : ZERO;
      row[name] = val / 100;
      monthTotal = add(monthTotal, val);
    }
    row.total = monthTotal / 100;
    return row;
  });
}

/**
 * 18. Utility trend series: usage per unit per month for a given utility type.
 *
 * Usage = usageOverride ?? (currentReading - previousReading).
 * When neither reading is present, usage is null (not charted).
 */
export type UtilityTrendRow = {
  month: MonthKey;
  unitId: string;
  unitCode: string;
  utilityType: string;
  previousReading: string | null;
  currentReading: string | null;
  usageOverride: string | null;
};

export function buildUtilityTrendSeries(
  rows: UtilityTrendRow[],
  months: MonthKey[],
  utilityType: string,
): { month: string; [unitCode: string]: number | string | null }[] {
  const filtered = rows.filter((r) => r.utilityType === utilityType);
  const unitCodes = Array.from(new Set(filtered.map((r) => r.unitCode)));

  return months.map((m) => {
    const row: { month: string; [unitCode: string]: number | string | null } = {
      month: formatMonthShort(m),
    };

    for (const code of unitCodes) {
      const rec = filtered.find((r) => r.month === m && r.unitCode === code);
      if (!rec) {
        row[code] = null;
        continue;
      }

      if (rec.usageOverride !== null) {
        row[code] = Number(rec.usageOverride);
      } else if (rec.currentReading !== null && rec.previousReading !== null) {
        row[code] = Number(rec.currentReading) - Number(rec.previousReading);
      } else {
        row[code] = null;
      }
    }

    return row;
  });
}

/**
 * 19. Missing data flags for the current month.
 */
export function computeMissingDataFlags(
  rentRows: RentMonthRow[],
  repayments: RepaymentMonthRow[],
  activeLoans: {
    loanId: string;
    name: string;
    expectsMonthlyPayment: boolean;
  }[],
  month: MonthKey,
): MissingDataFlag[] {
  const flags: MissingDataFlag[] = [];

  // Check for billable units with no rent entry
  const monthRent = rentRows.filter((r) => r.month === month);
  const billableWithoutPay = monthRent.filter(
    (r) => r.isBillable && r.paidAmount === null,
  );
  if (billableWithoutPay.length > 0) {
    flags.push({
      severity: "warning",
      message: `${billableWithoutPay.length} unit(s) have no rent entry for this month`,
      href: `/rent?month=${month}`,
    });
  }

  // Check for no census data at all
  if (monthRent.length === 0) {
    flags.push({
      severity: "warning",
      message: "No rent census generated for this month",
      href: `/rent?month=${month}`,
    });
  }

  // Check for loans expecting monthly payments without repayment data
  const monthRepayments = repayments.filter((r) => r.month === month);
  const repaymentLoanIds = new Set(monthRepayments.map((r) => r.loanId));
  const monthlyLoans = activeLoans.filter((l) => l.expectsMonthlyPayment);

  for (const loan of monthlyLoans) {
    if (!repaymentLoanIds.has(loan.loanId)) {
      flags.push({
        severity: "info",
        message: `No repayment recorded for "${loan.name}" this month`,
        href: `/loans/${loan.loanId}?month=${month}`,
      });
    }
  }

  return flags;
}
