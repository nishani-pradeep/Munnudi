import { and, desc, eq, gte, isNull, isNotNull, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { loanRepayments, loans, loanLedger } from "@/db/schema";
import type { MonthKey } from "@/domain/month";

/* ────────────────────────── Active repayments ────────────────────────── */

export async function listForMonth(propertyId: string, month: MonthKey) {
  return db
    .select()
    .from(loanRepayments)
    .where(
      and(
        eq(loanRepayments.propertyId, propertyId),
        eq(loanRepayments.month, month),
        isNull(loanRepayments.deletedAt),
      ),
    )
    .orderBy(loanRepayments.createdAt);
}

export type RepaymentRow = Awaited<ReturnType<typeof listForMonth>>[number];

export async function listForLoan(propertyId: string, loanId: string) {
  return db
    .select()
    .from(loanRepayments)
    .where(
      and(
        eq(loanRepayments.propertyId, propertyId),
        eq(loanRepayments.loanId, loanId),
        isNull(loanRepayments.deletedAt),
      ),
    )
    .orderBy(desc(loanRepayments.month));
}

/* ────────────────────────── Deleted repayments ────────────────────────── */

export async function listDeletedForMonth(propertyId: string, month: MonthKey) {
  return db
    .select({
      id: loanRepayments.id,
      loanId: loanRepayments.loanId,
      month: loanRepayments.month,
      totalPayment: loanRepayments.totalPayment,
      deletedAt: loanRepayments.deletedAt,
    })
    .from(loanRepayments)
    .where(
      and(
        eq(loanRepayments.propertyId, propertyId),
        eq(loanRepayments.month, month),
        isNotNull(loanRepayments.deletedAt),
      ),
    )
    .orderBy(desc(loanRepayments.updatedAt));
}

export async function listDeletedForLoan(propertyId: string, loanId: string) {
  return db
    .select({
      id: loanRepayments.id,
      month: loanRepayments.month,
      totalPayment: loanRepayments.totalPayment,
      deletedAt: loanRepayments.deletedAt,
    })
    .from(loanRepayments)
    .where(
      and(
        eq(loanRepayments.propertyId, propertyId),
        eq(loanRepayments.loanId, loanId),
        isNotNull(loanRepayments.deletedAt),
      ),
    )
    .orderBy(desc(loanRepayments.updatedAt));
}

/* ────────────── Display join (month view with loan name) ─────────────── */

export async function listMonthForDisplay(propertyId: string, month: MonthKey) {
  return db
    .select({
      id: loanRepayments.id,
      loanId: loanRepayments.loanId,
      loanName: loans.name,
      totalPayment: loanRepayments.totalPayment,
      principalPaid: loanRepayments.principalPaid,
      interestPaid: loanRepayments.interestPaid,
      otherCharges: loanRepayments.otherCharges,
      outstandingAfterPayment: loanRepayments.outstandingAfterPayment,
    })
    .from(loanRepayments)
    .innerJoin(loans, eq(loanRepayments.loanId, loans.id))
    .where(
      and(
        eq(loanRepayments.propertyId, propertyId),
        eq(loanRepayments.month, month),
        isNull(loanRepayments.deletedAt),
      ),
    )
    .orderBy(loanRepayments.createdAt);
}

export type RepaymentDisplayRow = Awaited<ReturnType<typeof listMonthForDisplay>>[number];

/* ────────────────────────── Upsert / Soft-delete ─────────────────────── */

export type RepaymentInput = {
  loanId: string;
  month: MonthKey;
  paymentDate: string;
  totalPayment: string;
  principalPaid: string;
  interestPaid: string;
  otherCharges: string;
  principalAdjustment: string;
  adjustmentReason: string | null;
  outstandingAfterPayment: string | null;
  comment: string | null;
};

export async function upsertRepayment(propertyId: string, input: RepaymentInput) {
  const [loan] = await db
    .select({ id: loans.id })
    .from(loans)
    .where(and(eq(loans.id, input.loanId), eq(loans.propertyId, propertyId)));
  if (!loan) throw new Error("Loan not found for the active property.");

  const [row] = await db
    .insert(loanRepayments)
    .values({ propertyId, ...input })
    .onConflictDoUpdate({
      target: [loanRepayments.loanId, loanRepayments.month],
      targetWhere: isNull(loanRepayments.deletedAt),
      set: {
        paymentDate: input.paymentDate,
        totalPayment: input.totalPayment,
        principalPaid: input.principalPaid,
        interestPaid: input.interestPaid,
        otherCharges: input.otherCharges,
        principalAdjustment: input.principalAdjustment,
        adjustmentReason: input.adjustmentReason,
        outstandingAfterPayment: input.outstandingAfterPayment,
        comment: input.comment,
        updatedAt: new Date(),
      },
    })
    .returning({ id: loanRepayments.id });
  return row.id;
}

export async function softDeleteRepayment(propertyId: string, repaymentId: string) {
  const result = await db
    .update(loanRepayments)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(loanRepayments.id, repaymentId),
        eq(loanRepayments.propertyId, propertyId),
        isNull(loanRepayments.deletedAt),
      ),
    )
    .returning({ id: loanRepayments.id });
  return result.length > 0;
}

export async function restoreRepayment(propertyId: string, repaymentId: string) {
  const [deleted] = await db
    .select({ loanId: loanRepayments.loanId, month: loanRepayments.month })
    .from(loanRepayments)
    .where(
      and(
        eq(loanRepayments.id, repaymentId),
        eq(loanRepayments.propertyId, propertyId),
        isNotNull(loanRepayments.deletedAt),
      ),
    );
  if (!deleted) return false;

  const [conflict] = await db
    .select({ id: loanRepayments.id })
    .from(loanRepayments)
    .where(
      and(
        eq(loanRepayments.loanId, deleted.loanId),
        eq(loanRepayments.month, deleted.month),
        isNull(loanRepayments.deletedAt),
      ),
    );
  if (conflict) {
    throw new Error("An active repayment already exists for this loan and month.");
  }

  const result = await db
    .update(loanRepayments)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(loanRepayments.id, repaymentId))
    .returning({ id: loanRepayments.id });
  return result.length > 0;
}

/* ──────────────────── Ledger query (v_loan_ledger view) ──────────────── */

export async function getLoanLedger(propertyId: string, loanId: string) {
  return db
    .select()
    .from(loanLedger)
    .where(and(eq(loanLedger.propertyId, propertyId), eq(loanLedger.loanId, loanId)))
    .orderBy(loanLedger.month);
}

export type LedgerRow = Awaited<ReturnType<typeof getLoanLedger>>[number];

/* ────── Outstanding balances for all active loans at a given month ───── */

export async function listCurrentOutstandings(propertyId: string, month: MonthKey) {
  // For each active loan, resolve the effective outstanding from the ledger
  // (or fall back to opening outstanding). We use a subquery-like approach:
  // fetch the most recent ledger row for each loan up to and including `month`.
  const allActive = await db
    .select({ id: loans.id, openingOutstanding: loans.openingOutstanding })
    .from(loans)
    .where(and(eq(loans.propertyId, propertyId), eq(loans.active, true)));

  // For each loan, find the latest ledger row up to month
  const results: { loanId: string; outstanding: string }[] = [];

  for (const loan of allActive) {
    const [latest] = await db
      .select({ effectiveOutstanding: loanLedger.effectiveOutstanding })
      .from(loanLedger)
      .where(and(eq(loanLedger.loanId, loan.id), lte(loanLedger.month, month)))
      .orderBy(desc(loanLedger.month))
      .limit(1);

    results.push({
      loanId: loan.id,
      outstanding: latest?.effectiveOutstanding ?? loan.openingOutstanding,
    });
  }

  return results;
}

export async function listForMonthRange(
  propertyId: string,
  fromMonth: MonthKey,
  toMonth: MonthKey,
) {
  return db
    .select({
      month: loanRepayments.month,
      loanId: loanRepayments.loanId,
      principalPaid: loanRepayments.principalPaid,
      interestPaid: loanRepayments.interestPaid,
    })
    .from(loanRepayments)
    .where(
      and(
        eq(loanRepayments.propertyId, propertyId),
        gte(loanRepayments.month, fromMonth),
        lte(loanRepayments.month, toMonth),
        isNull(loanRepayments.deletedAt),
      ),
    )
    .orderBy(loanRepayments.month);
}

export type RepaymentRangeRow = Awaited<ReturnType<typeof listForMonthRange>>[number];
