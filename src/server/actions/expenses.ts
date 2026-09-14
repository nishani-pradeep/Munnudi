"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { actionClient } from "./client";
import { getActivePropertyId } from "@/server/db/scope";
import {
  createExpense,
  updateExpense,
  softDeleteExpense,
  restoreExpense,
  listCategories,
} from "@/server/db/repositories/expenses";
import { listActiveUnits } from "@/server/db/repositories/units";
import { monthKey } from "@/domain/month";
import { parsePaise, toNumericString } from "@/domain/money";

const MONEY_RE = /^\d+(\.\d{1,2})?$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const expenseFieldsSchema = z.object({
  categoryId: z.string().uuid(),
  unitId: z.string().uuid().or(z.literal("")),
  expenseDate: z
    .string()
    .trim()
    .refine((v) => v === "" || DATE_RE.test(v), "Invalid date"),
  amount: z
    .string()
    .trim()
    .refine((v) => MONEY_RE.test(v), "Enter a valid amount, e.g. 500 or 499.99"),
  comment: z.string().trim().max(500, "Keep comments under 500 characters"),
});

/** categoryId (and unitId, when given) must belong to the active property — the chokepoint here, since a new expense has no existing row to scope a check against. */
async function assertOwnership(propertyId: string, categoryId: string, unitId: string) {
  const [categories, units] = await Promise.all([
    listCategories(propertyId),
    listActiveUnits(propertyId),
  ]);
  if (!categories.some((c) => c.id === categoryId)) {
    throw new Error("Category not found for the active property.");
  }
  if (unitId !== "" && !units.some((u) => u.id === unitId)) {
    throw new Error("Unit not found for the active property.");
  }
}

export const createExpenseAction = actionClient
  .inputSchema(expenseFieldsSchema.extend({ month: z.string().regex(MONTH_RE, "Invalid month") }))
  .action(async ({ parsedInput }) => {
    const propertyId = await getActivePropertyId();
    await assertOwnership(propertyId, parsedInput.categoryId, parsedInput.unitId);

    await createExpense(propertyId, {
      month: monthKey(parsedInput.month),
      expenseDate: parsedInput.expenseDate === "" ? null : parsedInput.expenseDate,
      categoryId: parsedInput.categoryId,
      unitId: parsedInput.unitId === "" ? null : parsedInput.unitId,
      amount: toNumericString(parsePaise(parsedInput.amount)),
      comment: parsedInput.comment === "" ? null : parsedInput.comment,
    });

    revalidatePath("/expenses");
    return { ok: true as const };
  });

export const updateExpenseAction = actionClient
  .inputSchema(expenseFieldsSchema.extend({ expenseId: z.string().uuid() }))
  .action(async ({ parsedInput }) => {
    const propertyId = await getActivePropertyId();
    await assertOwnership(propertyId, parsedInput.categoryId, parsedInput.unitId);

    const updated = await updateExpense(propertyId, parsedInput.expenseId, {
      expenseDate: parsedInput.expenseDate === "" ? null : parsedInput.expenseDate,
      categoryId: parsedInput.categoryId,
      unitId: parsedInput.unitId === "" ? null : parsedInput.unitId,
      amount: toNumericString(parsePaise(parsedInput.amount)),
      comment: parsedInput.comment === "" ? null : parsedInput.comment,
    });
    if (!updated) throw new Error("Expense not found for the active property.");

    revalidatePath("/expenses");
    return { ok: true as const };
  });

export const deleteExpenseAction = actionClient
  .inputSchema(z.object({ expenseId: z.string().uuid() }))
  .action(async ({ parsedInput }) => {
    const propertyId = await getActivePropertyId();
    const deleted = await softDeleteExpense(propertyId, parsedInput.expenseId);
    if (!deleted) throw new Error("Expense not found for the active property.");

    revalidatePath("/expenses");
    return { ok: true as const };
  });

export const restoreExpenseAction = actionClient
  .inputSchema(z.object({ expenseId: z.string().uuid() }))
  .action(async ({ parsedInput }) => {
    const propertyId = await getActivePropertyId();
    const restored = await restoreExpense(propertyId, parsedInput.expenseId);
    if (!restored) throw new Error("Deleted expense not found for the active property.");

    revalidatePath("/expenses");
    return { ok: true as const };
  });
