"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { actionClient } from "./client";
import { getActivePropertyId } from "@/server/db/scope";
import {
  ensureMonthGenerated,
  updateRentPayment,
} from "@/server/db/repositories/unit-month-records";
import { monthKey } from "@/domain/month";
import { parsePaise, toNumericString } from "@/domain/money";

const MONEY_RE = /^\d+(\.\d{1,2})?$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const ensureMonthInputSchema = z.object({
  month: z.string().regex(MONTH_RE, "Invalid month"),
});

/**
 * Called on rendering /rent to idempotently generate this month's census rows.
 * Not a mutation the user triggers directly — it's what makes the page usable
 * on first load for a month that has never been opened before.
 */
export const ensureMonthAction = actionClient
  .inputSchema(ensureMonthInputSchema)
  .action(async ({ parsedInput }) => {
    const propertyId = await getActivePropertyId();
    await ensureMonthGenerated(propertyId, monthKey(parsedInput.month));
    return { ok: true as const };
  });

const saveRentInputSchema = z.object({
  recordId: z.string().uuid(),
  paidAmount: z
    .string()
    .trim()
    .refine((v) => v === "" || MONEY_RE.test(v), "Enter a valid amount, e.g. 12000 or 12000.50"),
  paymentDate: z
    .string()
    .trim()
    .refine((v) => v === "" || DATE_RE.test(v), "Invalid date"),
  comment: z.string().trim().max(500, "Keep comments under 500 characters"),
});

/**
 * The Rent mutation API (decision: Server Actions ARE the backend, PRD 18 —
 * no separate REST layer). Validates shape here, converts the rupee string to
 * exact paise via the domain's money module (never parseFloat), and re-checks
 * property ownership inside updateRentPayment before writing (decision 8).
 */
export const saveRentAction = actionClient
  .inputSchema(saveRentInputSchema)
  .action(async ({ parsedInput }) => {
    const propertyId = await getActivePropertyId();

    const paidAmount =
      parsedInput.paidAmount === "" ? null : toNumericString(parsePaise(parsedInput.paidAmount));
    const paymentDate = parsedInput.paymentDate === "" ? null : parsedInput.paymentDate;
    const comment = parsedInput.comment === "" ? null : parsedInput.comment;

    const updated = await updateRentPayment(propertyId, parsedInput.recordId, {
      paidAmount,
      paymentDate,
      comment,
    });

    if (!updated) {
      throw new Error("Rent record not found for the active property.");
    }

    revalidatePath("/rent");
    return { ok: true as const };
  });
