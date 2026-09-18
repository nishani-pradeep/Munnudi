"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { actionClient } from "./client";
import { getActivePropertyId } from "@/server/db/scope";
import {
  createLoan,
  updateLoan,
  closeLoan,
  reopenLoan,
  softDeleteLoan,
  restoreLoan,
} from "@/server/db/repositories/loans";
import {
  upsertRepayment,
  softDeleteRepayment,
  restoreRepayment,
} from "@/server/db/repositories/loan-repayments";
import { monthKey } from "@/domain/month";
import { parsePaise, toNumericString } from "@/domain/money";

const MONEY_RE = /^\d+(\.\d{1,2})?$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function moneyOrNull(v: string): string | null {
  return v === "" ? null : toNumericString(parsePaise(v));
}

const loanFieldsSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  loanType: z.enum(["HOME_LOAN", "GOLD_LOAN", "OTHER"]),
  lender: z.string().trim(),
  originalPrincipal: z
    .string()
    .trim()
    .refine((v) => v === "" || MONEY_RE.test(v), "Invalid amount"),
  openingOutstanding: z
    .string()
    .trim()
    .refine((v) => MONEY_RE.test(v), "Enter a valid amount"),
  openingAsOfMonth: z.string().regex(MONTH_RE, "Invalid month"),
  interestRate: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || /^\d+(\.\d{1,3})?$/.test(v),
      "Enter a valid rate, e.g. 8.5",
    ),
  scheduledEmi: z
    .string()
    .trim()
    .refine((v) => v === "" || MONEY_RE.test(v), "Invalid amount"),
  remainingTenureMonths: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || /^\d+$/.test(v),
      "Enter a whole number of months",
    ),
  expectsMonthlyPayment: z.boolean(),
});

export const createLoanAction = actionClient
  .inputSchema(loanFieldsSchema)
  .action(async ({ parsedInput }) => {
    const propertyId = await getActivePropertyId();
    await createLoan(propertyId, {
      name: parsedInput.name,
      loanType: parsedInput.loanType,
      lender: parsedInput.lender === "" ? null : parsedInput.lender,
      originalPrincipal: moneyOrNull(parsedInput.originalPrincipal),
      openingOutstanding: toNumericString(parsePaise(parsedInput.openingOutstanding)),
      openingAsOfMonth: monthKey(parsedInput.openingAsOfMonth),
      interestRate: parsedInput.interestRate === "" ? null : parsedInput.interestRate,
      scheduledEmi: moneyOrNull(parsedInput.scheduledEmi),
      remainingTenureMonths:
        parsedInput.remainingTenureMonths === ""
          ? null
          : Number(parsedInput.remainingTenureMonths),
      expectsMonthlyPayment: parsedInput.expectsMonthlyPayment,
    });

    revalidatePath("/loans");
    return { ok: true as const };
  });

export const updateLoanAction = actionClient
  .inputSchema(loanFieldsSchema.extend({ loanId: z.string().uuid() }))
  .action(async ({ parsedInput }) => {
    const propertyId = await getActivePropertyId();
    const updated = await updateLoan(propertyId, parsedInput.loanId, {
      name: parsedInput.name,
      loanType: parsedInput.loanType,
      lender: parsedInput.lender === "" ? null : parsedInput.lender,
      originalPrincipal: moneyOrNull(parsedInput.originalPrincipal),
      openingOutstanding: toNumericString(parsePaise(parsedInput.openingOutstanding)),
      openingAsOfMonth: monthKey(parsedInput.openingAsOfMonth),
      interestRate: parsedInput.interestRate === "" ? null : parsedInput.interestRate,
      scheduledEmi: moneyOrNull(parsedInput.scheduledEmi),
      remainingTenureMonths:
        parsedInput.remainingTenureMonths === ""
          ? null
          : Number(parsedInput.remainingTenureMonths),
      expectsMonthlyPayment: parsedInput.expectsMonthlyPayment,
    });
    if (!updated) throw new Error("Loan not found for the active property.");

    revalidatePath("/loans");
    return { ok: true as const };
  });

export const closeLoanAction = actionClient
  .inputSchema(
    z.object({
      loanId: z.string().uuid(),
      closedMonth: z.string().regex(MONTH_RE, "Invalid month"),
    }),
  )
  .action(async ({ parsedInput }) => {
    const propertyId = await getActivePropertyId();
    const closed = await closeLoan(propertyId, parsedInput.loanId, monthKey(parsedInput.closedMonth));
    if (!closed) throw new Error("Loan not found for the active property.");

    revalidatePath("/loans");
    return { ok: true as const };
  });

export const reopenLoanAction = actionClient
  .inputSchema(z.object({ loanId: z.string().uuid() }))
  .action(async ({ parsedInput }) => {
    const propertyId = await getActivePropertyId();
    const reopened = await reopenLoan(propertyId, parsedInput.loanId);
    if (!reopened) throw new Error("Loan not found for the active property.");

    revalidatePath("/loans");
    return { ok: true as const };
  });

export const deleteLoanAction = actionClient
  .inputSchema(z.object({ loanId: z.string().uuid() }))
  .action(async ({ parsedInput }) => {
    const propertyId = await getActivePropertyId();
    const deleted = await softDeleteLoan(propertyId, parsedInput.loanId);
    if (!deleted) throw new Error("Loan not found for the active property.");

    revalidatePath("/loans");
    return { ok: true as const };
  });

export const restoreLoanAction = actionClient
  .inputSchema(z.object({ loanId: z.string().uuid() }))
  .action(async ({ parsedInput }) => {
    const propertyId = await getActivePropertyId();
    const restored = await restoreLoan(propertyId, parsedInput.loanId);
    if (!restored) throw new Error("Deleted loan not found for the active property.");

    revalidatePath("/loans");
    return { ok: true as const };
  });

const repaymentFieldsSchema = z.object({
  loanId: z.string().uuid(),
  month: z.string().regex(MONTH_RE, "Invalid month"),
  paymentDate: z.string().refine((v) => DATE_RE.test(v), "Enter a valid date"),
  totalPayment: z
    .string()
    .trim()
    .refine((v) => MONEY_RE.test(v) && Number(v) > 0, "Total payment must be greater than 0"),
  principalPaid: z
    .string()
    .trim()
    .refine((v) => v === "" || MONEY_RE.test(v), "Invalid amount"),
  interestPaid: z
    .string()
    .trim()
    .refine((v) => v === "" || MONEY_RE.test(v), "Invalid amount"),
  otherCharges: z
    .string()
    .trim()
    .refine((v) => v === "" || MONEY_RE.test(v), "Invalid amount"),
  principalAdjustment: z
    .string()
    .trim()
    .refine((v) => v === "" || /^-?\d+(\.\d{1,2})?$/.test(v), "Invalid amount"),
  adjustmentReason: z.string().trim().max(500).optional(),
  outstandingAfterPayment: z
    .string()
    .trim()
    .refine((v) => v === "" || MONEY_RE.test(v), "Invalid amount"),
  comment: z.string().trim().max(500).optional(),
});

export const saveLoanRepaymentAction = actionClient
  .inputSchema(repaymentFieldsSchema)
  .action(async ({ parsedInput }) => {
    const propertyId = await getActivePropertyId();

    const totalVal = Number(parsedInput.totalPayment) || 0;
    const partsSum =
      (parsedInput.principalPaid === "" ? 0 : Number(parsedInput.principalPaid)) +
      (parsedInput.interestPaid === "" ? 0 : Number(parsedInput.interestPaid)) +
      (parsedInput.otherCharges === "" ? 0 : Number(parsedInput.otherCharges));
    if (partsSum > totalVal) {
      throw new Error("Principal + Interest + Other charges cannot exceed total payment.");
    }

    const principalPaid = parsedInput.principalPaid === ""
      ? "0.00"
      : toNumericString(parsePaise(parsedInput.principalPaid));
    const interestPaid = parsedInput.interestPaid === ""
      ? "0.00"
      : toNumericString(parsePaise(parsedInput.interestPaid));
    const otherCharges = parsedInput.otherCharges === ""
      ? "0.00"
      : toNumericString(parsePaise(parsedInput.otherCharges));
    const principalAdjustment = parsedInput.principalAdjustment === ""
      ? "0.00"
      : toNumericString(parsePaise(parsedInput.principalAdjustment));

    await upsertRepayment(propertyId, {
      loanId: parsedInput.loanId,
      month: monthKey(parsedInput.month),
      paymentDate: parsedInput.paymentDate,
      totalPayment: toNumericString(parsePaise(parsedInput.totalPayment)),
      principalPaid,
      interestPaid,
      otherCharges,
      principalAdjustment,
      adjustmentReason:
        principalAdjustment === "0.00"
          ? null
          : (parsedInput.adjustmentReason || null),
      outstandingAfterPayment:
        parsedInput.outstandingAfterPayment === ""
          ? null
          : toNumericString(parsePaise(parsedInput.outstandingAfterPayment)),
      comment: parsedInput.comment === "" || !parsedInput.comment ? null : parsedInput.comment,
    });

    revalidatePath("/loans");
    return { ok: true as const };
  });

export const deleteLoanRepaymentAction = actionClient
  .inputSchema(z.object({ repaymentId: z.string().uuid() }))
  .action(async ({ parsedInput }) => {
    const propertyId = await getActivePropertyId();
    const deleted = await softDeleteRepayment(propertyId, parsedInput.repaymentId);
    if (!deleted) throw new Error("Repayment not found for the active property.");

    revalidatePath("/loans");
    return { ok: true as const };
  });

export const restoreLoanRepaymentAction = actionClient
  .inputSchema(z.object({ repaymentId: z.string().uuid() }))
  .action(async ({ parsedInput }) => {
    const propertyId = await getActivePropertyId();
    const restored = await restoreRepayment(propertyId, parsedInput.repaymentId);
    if (!restored) throw new Error("Deleted repayment not found for the active property.");

    revalidatePath("/loans");
    return { ok: true as const };
  });
