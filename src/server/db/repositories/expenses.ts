import { and, desc, eq, gte, isNotNull, isNull, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { expenseCategories, expenses, units } from "@/db/schema";
import type { MonthKey } from "@/domain/month";

export async function listCategories(propertyId: string) {
  return db
    .select()
    .from(expenseCategories)
    .where(and(eq(expenseCategories.propertyId, propertyId), eq(expenseCategories.active, true)))
    .orderBy(expenseCategories.name);
}

export async function listMonth(propertyId: string, month: MonthKey) {
  return db
    .select({
      id: expenses.id,
      month: expenses.month,
      expenseDate: expenses.expenseDate,
      amount: expenses.amount,
      comment: expenses.comment,
      reference: expenses.reference,
      categoryId: expenses.categoryId,
      categoryName: expenseCategories.name,
      unitId: expenses.unitId,
      unitCode: units.unitCode,
    })
    .from(expenses)
    .innerJoin(expenseCategories, eq(expenseCategories.id, expenses.categoryId))
    .leftJoin(units, eq(units.id, expenses.unitId))
    .where(
      and(
        eq(expenses.propertyId, propertyId),
        eq(expenses.month, month),
        isNull(expenses.deletedAt),
      ),
    )
    .orderBy(desc(expenses.expenseDate), desc(expenses.createdAt));
}

export type ExpenseRow = Awaited<ReturnType<typeof listMonth>>[number];

/** Recently soft-deleted expenses for the month, for the "Recently deleted" restore panel. */
export async function listDeletedForMonth(propertyId: string, month: MonthKey) {
  return db
    .select({
      id: expenses.id,
      amount: expenses.amount,
      comment: expenses.comment,
      categoryName: expenseCategories.name,
    })
    .from(expenses)
    .innerJoin(expenseCategories, eq(expenseCategories.id, expenses.categoryId))
    .where(
      and(
        eq(expenses.propertyId, propertyId),
        eq(expenses.month, month),
        isNotNull(expenses.deletedAt),
      ),
    )
    .orderBy(desc(expenses.updatedAt));
}

export type CreateExpenseInput = {
  month: MonthKey;
  expenseDate: string | null;
  categoryId: string;
  unitId: string | null;
  amount: string;
  comment: string | null;
};

export async function createExpense(propertyId: string, input: CreateExpenseInput) {
  const [row] = await db
    .insert(expenses)
    .values({ propertyId, ...input })
    .returning({ id: expenses.id });
  return row.id;
}

export type UpdateExpenseInput = Omit<CreateExpenseInput, "month">;

/** Scoped by propertyId, same chokepoint pattern as Rent's updateRentPayment. */
export async function updateExpense(
  propertyId: string,
  expenseId: string,
  input: UpdateExpenseInput,
): Promise<boolean> {
  const result = await db
    .update(expenses)
    .set({ ...input, updatedAt: new Date() })
    .where(
      and(
        eq(expenses.id, expenseId),
        eq(expenses.propertyId, propertyId),
        isNull(expenses.deletedAt),
      ),
    )
    .returning({ id: expenses.id });
  return result.length > 0;
}

export async function softDeleteExpense(propertyId: string, expenseId: string): Promise<boolean> {
  const result = await db
    .update(expenses)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(expenses.id, expenseId),
        eq(expenses.propertyId, propertyId),
        isNull(expenses.deletedAt),
      ),
    )
    .returning({ id: expenses.id });
  return result.length > 0;
}

export async function restoreExpense(propertyId: string, expenseId: string): Promise<boolean> {
  const result = await db
    .update(expenses)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(
      and(
        eq(expenses.id, expenseId),
        eq(expenses.propertyId, propertyId),
        isNotNull(expenses.deletedAt),
      ),
    )
    .returning({ id: expenses.id });
  return result.length > 0;
}

export async function listForMonthRange(
  propertyId: string,
  fromMonth: MonthKey,
  toMonth: MonthKey,
) {
  return db
    .select({
      month: expenses.month,
      amount: expenses.amount,
      isMaintenance: expenseCategories.isMaintenance,
      categoryName: expenseCategories.name,
    })
    .from(expenses)
    .innerJoin(expenseCategories, eq(expenseCategories.id, expenses.categoryId))
    .where(
      and(
        eq(expenses.propertyId, propertyId),
        gte(expenses.month, fromMonth),
        lte(expenses.month, toMonth),
        isNull(expenses.deletedAt),
      ),
    )
    .orderBy(expenses.month);
}

export type ExpenseRangeRow = Awaited<ReturnType<typeof listForMonthRange>>[number];
