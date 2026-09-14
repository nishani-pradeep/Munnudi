import { and, desc, eq, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { loans, loanLedger } from "@/db/schema";
import type { MonthKey } from "@/domain/month";
import { monthsBetween } from "@/domain/month";
import { parsePaise, type Paise } from "@/domain/money";

export async function listLoans(propertyId: string, opts: { includeClosed: boolean }) {
  const rows = await db
    .select()
    .from(loans)
    .where(eq(loans.propertyId, propertyId))
    .orderBy(loans.name);
  return opts.includeClosed ? rows : rows.filter((l) => l.active);
}

export type LoanRow = Awaited<ReturnType<typeof listLoans>>[number];

export type LoanInput = {
  name: string;
  loanType: string;
  lender: string | null;
  originalPrincipal: string | null;
  openingOutstanding: string;
  openingAsOfMonth: MonthKey;
  interestRate: string | null;
  scheduledEmi: string | null;
  remainingTenureMonths: number | null;
  expectsMonthlyPayment: boolean;
};

export async function createLoan(propertyId: string, input: LoanInput) {
  const [row] = await db
    .insert(loans)
    .values({ propertyId, ...input })
    .returning({ id: loans.id });
  return row.id;
}

/** Scoped by propertyId — the chokepoint (decision 8) applied to loan edits. */
export async function updateLoan(
  propertyId: string,
  loanId: string,
  input: LoanInput,
): Promise<boolean> {
  const result = await db
    .update(loans)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(loans.id, loanId), eq(loans.propertyId, propertyId)))
    .returning({ id: loans.id });
  return result.length > 0;
}

export async function closeLoan(
  propertyId: string,
  loanId: string,
  closedMonth: MonthKey,
): Promise<boolean> {
  const result = await db
    .update(loans)
    .set({ closedMonth, active: false, updatedAt: new Date() })
    .where(and(eq(loans.id, loanId), eq(loans.propertyId, propertyId)))
    .returning({ id: loans.id });
  return result.length > 0;
}

export async function reopenLoan(propertyId: string, loanId: string): Promise<boolean> {
  const result = await db
    .update(loans)
    .set({ closedMonth: null, active: true, updatedAt: new Date() })
    .where(and(eq(loans.id, loanId), eq(loans.propertyId, propertyId)))
    .returning({ id: loans.id });
  return result.length > 0;
}

export type AmortizationAnchor = {
  /** Balance to amortize from, as of just before `targetMonth`. */
  outstanding: Paise;
  /** Months remaining as of `targetMonth`, or null when tenure was never recorded. */
  remainingTenureMonths: number | null;
};

/**
 * Resolves "where are we in the schedule right now" for a loan (see
 * docs/IMPLEMENTATION_PLAN.md's amortization-anchor note): the latest
 * *effective* outstanding from v_loan_ledger strictly before targetMonth
 * (so prepayments/adjustments already recorded are respected), falling back
 * to openingOutstanding when no repayment exists yet. Tenure ticks down by
 * elapsed months from openingAsOfMonth — a deliberate simplification, not
 * bank-grade amortization.
 */
export async function resolveAmortizationAnchor(
  loan: LoanRow,
  targetMonth: MonthKey,
): Promise<AmortizationAnchor> {
  const [latest] = await db
    .select({ effectiveOutstanding: loanLedger.effectiveOutstanding })
    .from(loanLedger)
    .where(and(eq(loanLedger.loanId, loan.id), lt(loanLedger.month, targetMonth)))
    .orderBy(desc(loanLedger.month))
    .limit(1);

  const outstanding = latest?.effectiveOutstanding
    ? parsePaise(latest.effectiveOutstanding)
    : parsePaise(loan.openingOutstanding);

  if (loan.remainingTenureMonths === null) {
    return { outstanding, remainingTenureMonths: null };
  }

  const elapsed = monthsBetween(loan.openingAsOfMonth as MonthKey, targetMonth);
  const remainingTenureMonths = Math.max(0, loan.remainingTenureMonths - Math.max(0, elapsed));
  return { outstanding, remainingTenureMonths };
}
