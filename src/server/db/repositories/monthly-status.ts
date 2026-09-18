import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { monthlyStatus } from "@/db/schema";
import type { MonthKey } from "@/domain/month";

export async function listForMonthRange(
  propertyId: string,
  fromMonth: MonthKey,
  toMonth: MonthKey,
) {
  return db
    .select({
      month: monthlyStatus.month,
      state: monthlyStatus.state,
      rentReviewedAt: monthlyStatus.rentReviewedAt,
      utilitiesReviewedAt: monthlyStatus.utilitiesReviewedAt,
      expensesReviewedAt: monthlyStatus.expensesReviewedAt,
      loansReviewedAt: monthlyStatus.loansReviewedAt,
    })
    .from(monthlyStatus)
    .where(
      and(
        eq(monthlyStatus.propertyId, propertyId),
        gte(monthlyStatus.month, fromMonth),
        lte(monthlyStatus.month, toMonth),
      ),
    )
    .orderBy(monthlyStatus.month);
}

export type MonthStatusRow = Awaited<ReturnType<typeof listForMonthRange>>[number];
