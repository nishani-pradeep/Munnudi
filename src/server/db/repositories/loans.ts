import { and, asc, desc, eq, gte, isNotNull, isNull, lte, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { loans, loanLedger, loanRepayments } from "@/db/schema";
import type { MonthKey } from "@/domain/month";
import { monthsBetween } from "@/domain/month";
import { parsePaise, type Paise } from "@/domain/money";

export async function listLoans(propertyId: string, opts: { includeClosed: boolean }) {
  const rows = await db
    .select()
    .from(loans)
    .where(and(eq(loans.propertyId, propertyId), isNull(loans.deletedAt)))
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
    .where(and(eq(loans.id, loanId), eq(loans.propertyId, propertyId), eq(loans.active, true)))
    .returning({ id: loans.id });
  return result.length > 0;
}

export async function reopenLoan(propertyId: string, loanId: string): Promise<boolean> {
  const result = await db
    .update(loans)
    .set({ closedMonth: null, active: true, updatedAt: new Date() })
    .where(and(eq(loans.id, loanId), eq(loans.propertyId, propertyId), eq(loans.active, false)))
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

/** Get a single loan by ID, scoped by propertyId. */
export async function getLoan(
  propertyId: string,
  loanId: string,
): Promise<LoanRow | null> {
  const [row] = await db
    .select()
    .from(loans)
    .where(and(eq(loans.id, loanId), eq(loans.propertyId, propertyId)));
  return row ?? null;
}

/** Full ledger for a single loan, ordered chronologically. */
export async function getLoanLedger(propertyId: string, loanId: string) {
  return db
    .select()
    .from(loanLedger)
    .where(and(eq(loanLedger.loanId, loanId), eq(loanLedger.propertyId, propertyId)))
    .orderBy(asc(loanLedger.month));
}

export type LedgerRow = Awaited<ReturnType<typeof getLoanLedger>>[number];

/** Current outstanding for all active loans as of a given month. */
export async function listCurrentOutstandings(
  propertyId: string,
  asOfMonth: MonthKey,
): Promise<{ loanId: string; loanName: string; outstanding: Paise }[]> {
  const activeLoans = await listLoans(propertyId, { includeClosed: false });
  const results: { loanId: string; loanName: string; outstanding: Paise }[] = [];

  for (const loan of activeLoans) {
    const [latest] = await db
      .select({ effectiveOutstanding: loanLedger.effectiveOutstanding })
      .from(loanLedger)
      .where(
        and(
          eq(loanLedger.loanId, loan.id),
          lte(loanLedger.month, asOfMonth),
        ),
      )
      .orderBy(desc(loanLedger.month))
      .limit(1);

    const outstanding = latest?.effectiveOutstanding
      ? parsePaise(latest.effectiveOutstanding)
      : parsePaise(loan.openingOutstanding);

    results.push({ loanId: loan.id, loanName: loan.name, outstanding });
  }

  return results;
}

export async function listLedgerForRange(
  propertyId: string,
  fromMonth: MonthKey,
  toMonth: MonthKey,
) {
  return db
    .select({
      month: loanLedger.month,
      loanId: loanLedger.loanId,
      loanName: loans.name,
      effectiveOutstanding: loanLedger.effectiveOutstanding,
    })
    .from(loanLedger)
    .innerJoin(loans, eq(loans.id, loanLedger.loanId))
    .where(
      and(
        eq(loanLedger.propertyId, propertyId),
        gte(loanLedger.month, fromMonth),
        lte(loanLedger.month, toMonth),
      ),
    )
    .orderBy(loanLedger.month, loans.name);
}

export type LedgerRangeRow = Awaited<ReturnType<typeof listLedgerForRange>>[number];

/* ────────────────────── Soft-delete / restore ──────────────────────── */

/**
 * Soft-delete a loan ("entered by mistake"). Refuses if the loan still has
 * active (non-deleted) repayments — those must be removed first.
 */
export async function softDeleteLoan(
  propertyId: string,
  loanId: string,
): Promise<boolean> {
  const activeRepayments = await db
    .select({ id: loanRepayments.id })
    .from(loanRepayments)
    .where(
      and(
        eq(loanRepayments.loanId, loanId),
        isNull(loanRepayments.deletedAt),
      ),
    )
    .limit(1);

  if (activeRepayments.length > 0) {
    throw new Error(
      "Delete all repayments for this loan first before deleting the loan.",
    );
  }

  const result = await db
    .update(loans)
    .set({ deletedAt: new Date(), active: false, updatedAt: new Date() })
    .where(
      and(
        eq(loans.id, loanId),
        eq(loans.propertyId, propertyId),
        isNull(loans.deletedAt),
      ),
    )
    .returning({ id: loans.id });
  return result.length > 0;
}

/** Restore a previously soft-deleted loan. */
export async function restoreLoan(
  propertyId: string,
  loanId: string,
): Promise<boolean> {
  const result = await db
    .update(loans)
    .set({ deletedAt: null, active: true, closedMonth: null, updatedAt: new Date() })
    .where(
      and(
        eq(loans.id, loanId),
        eq(loans.propertyId, propertyId),
        isNotNull(loans.deletedAt),
      ),
    )
    .returning({ id: loans.id });
  return result.length > 0;
}

/** List soft-deleted loans for the "Recently deleted" panel. */
export async function listDeletedLoans(propertyId: string) {
  return db
    .select({ id: loans.id, name: loans.name, loanType: loans.loanType })
    .from(loans)
    .where(
      and(
        eq(loans.propertyId, propertyId),
        isNotNull(loans.deletedAt),
      ),
    )
    .orderBy(desc(loans.updatedAt));
}
