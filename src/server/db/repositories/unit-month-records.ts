import { and, desc, eq, gte, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { units, unitMonthRecords } from "@/db/schema";
import { computeCensusForMonth, type OccupancyStatus } from "@/domain/rent";
import { previousMonth, type MonthKey } from "@/domain/month";
import { toNumericString } from "@/domain/money";
import { listActiveUnits, toCensusInput } from "./units";
import { listRentVersionsForUnits } from "./unit-rent-versions";

/**
 * Idempotent month generation (decision 4). Reads active units + last month's
 * census rows, computes this month's rows in pure TypeScript
 * (computeCensusForMonth — directly unit-tested), then inserts with
 * ON CONFLICT DO NOTHING so a month that already has entered payments is
 * never touched by re-running this.
 */
export async function ensureMonthGenerated(propertyId: string, month: MonthKey): Promise<void> {
  const existing = await db
    .select({ id: unitMonthRecords.id })
    .from(unitMonthRecords)
    .where(
      and(
        eq(unitMonthRecords.propertyId, propertyId),
        eq(unitMonthRecords.month, month),
        isNull(unitMonthRecords.deletedAt),
      ),
    )
    .limit(1);
  if (existing.length > 0) return;

  const activeUnits = await listActiveUnits(propertyId);
  if (activeUnits.length === 0) return;

  const unitIds = activeUnits.map((u) => u.id);
  const [priorRows, rentVersions] = await Promise.all([
    listCensusRows(propertyId, previousMonth(month)),
    listRentVersionsForUnits(unitIds),
  ]);

  const rowsToInsert = computeCensusForMonth(
    month,
    activeUnits.map(toCensusInput),
    priorRows.map((r) => ({
      unitId: r.unitId,
      occupancySnapshot: r.occupancySnapshot as OccupancyStatus,
    })),
    rentVersions,
  );

  if (rowsToInsert.length === 0) return;

  await db
    .insert(unitMonthRecords)
    .values(
      rowsToInsert.map((r) => ({
        propertyId,
        unitId: r.unitId,
        month: r.month,
        occupancySnapshot: r.occupancySnapshot,
        expectedRentSnapshot: toNumericString(r.expectedRentSnapshot),
      })),
    )
    .onConflictDoNothing({
      target: [unitMonthRecords.unitId, unitMonthRecords.month],
      where: isNull(unitMonthRecords.deletedAt),
    });
}

async function listCensusRows(propertyId: string, month: MonthKey) {
  return db
    .select()
    .from(unitMonthRecords)
    .where(
      and(
        eq(unitMonthRecords.propertyId, propertyId),
        eq(unitMonthRecords.month, month),
        isNull(unitMonthRecords.deletedAt),
      ),
    );
}

/** Census rows for a month joined with unit display info, for the Rent page table. */
export async function listMonthForDisplay(propertyId: string, month: MonthKey) {
  return db
    .select({
      id: unitMonthRecords.id,
      unitId: unitMonthRecords.unitId,
      unitCode: units.unitCode,
      unitType: units.unitType,
      occupancySnapshot: unitMonthRecords.occupancySnapshot,
      expectedRentSnapshot: unitMonthRecords.expectedRentSnapshot,
      isBillable: unitMonthRecords.isBillable,
      paidAmount: unitMonthRecords.paidAmount,
      paymentDate: unitMonthRecords.paymentDate,
      comment: unitMonthRecords.comment,
      status: unitMonthRecords.status,
      deletedAt: unitMonthRecords.deletedAt,
    })
    .from(unitMonthRecords)
    .innerJoin(units, eq(units.id, unitMonthRecords.unitId))
    .where(
      and(
        eq(unitMonthRecords.propertyId, propertyId),
        eq(unitMonthRecords.month, month),
        isNull(unitMonthRecords.deletedAt),
      ),
    )
    .orderBy(units.unitCode);
}

export type MonthRow = Awaited<ReturnType<typeof listMonthForDisplay>>[number];

/**
 * Scoped update: re-checks propertyId in the WHERE clause, not just the id,
 * so a crafted foreign id can never reach another property's row
 * (decision 8 / PRD 22's authorization test) even though there is only one
 * property today.
 */
export async function updateRentPayment(
  propertyId: string,
  recordId: string,
  input: { paidAmount: string | null; paymentDate: string | null; comment: string | null },
): Promise<boolean> {
  const result = await db
    .update(unitMonthRecords)
    .set({
      paidAmount: input.paidAmount,
      paymentDate: input.paymentDate,
      comment: input.comment,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(unitMonthRecords.id, recordId),
        eq(unitMonthRecords.propertyId, propertyId),
        isNull(unitMonthRecords.deletedAt),
      ),
    )
    .returning({ id: unitMonthRecords.id });

  return result.length > 0;
}

export async function softDeleteRentRecord(
  propertyId: string,
  recordId: string,
): Promise<boolean> {
  const result = await db
    .update(unitMonthRecords)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(unitMonthRecords.id, recordId),
        eq(unitMonthRecords.propertyId, propertyId),
        isNull(unitMonthRecords.deletedAt),
      ),
    )
    .returning({ id: unitMonthRecords.id });
  return result.length > 0;
}

export async function restoreRentRecord(
  propertyId: string,
  recordId: string,
): Promise<boolean> {
  // Check for unique constraint conflict before restoring
  const [deleted] = await db
    .select({ unitId: unitMonthRecords.unitId, month: unitMonthRecords.month })
    .from(unitMonthRecords)
    .where(
      and(
        eq(unitMonthRecords.id, recordId),
        eq(unitMonthRecords.propertyId, propertyId),
        isNotNull(unitMonthRecords.deletedAt),
      ),
    );
  if (!deleted) return false;

  // Check if an active row already exists for this unit+month
  const [conflict] = await db
    .select({ id: unitMonthRecords.id })
    .from(unitMonthRecords)
    .where(
      and(
        eq(unitMonthRecords.unitId, deleted.unitId),
        eq(unitMonthRecords.month, deleted.month),
        isNull(unitMonthRecords.deletedAt),
      ),
    );
  if (conflict) throw new Error("An active rent record already exists for this unit and month.");

  const result = await db
    .update(unitMonthRecords)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(unitMonthRecords.id, recordId))
    .returning({ id: unitMonthRecords.id });
  return result.length > 0;
}

/** Recently soft-deleted rent records for the month, for the "Recently deleted" restore panel. */
export async function listDeletedForMonth(propertyId: string, month: MonthKey) {
  return db
    .select({
      id: unitMonthRecords.id,
      unitCode: units.unitCode,
      expectedRentSnapshot: unitMonthRecords.expectedRentSnapshot,
      paidAmount: unitMonthRecords.paidAmount,
    })
    .from(unitMonthRecords)
    .innerJoin(units, eq(units.id, unitMonthRecords.unitId))
    .where(
      and(
        eq(unitMonthRecords.propertyId, propertyId),
        eq(unitMonthRecords.month, month),
        isNotNull(unitMonthRecords.deletedAt),
      ),
    )
    .orderBy(desc(unitMonthRecords.updatedAt));
}

export async function listForMonthRange(
  propertyId: string,
  fromMonth: MonthKey,
  toMonth: MonthKey,
) {
  return db
    .select({
      month: unitMonthRecords.month,
      unitId: unitMonthRecords.unitId,
      unitCode: units.unitCode,
      isBillable: unitMonthRecords.isBillable,
      occupancySnapshot: unitMonthRecords.occupancySnapshot,
      expectedRentSnapshot: unitMonthRecords.expectedRentSnapshot,
      paidAmount: unitMonthRecords.paidAmount,
      status: unitMonthRecords.status,
    })
    .from(unitMonthRecords)
    .innerJoin(units, eq(units.id, unitMonthRecords.unitId))
    .where(
      and(
        eq(unitMonthRecords.propertyId, propertyId),
        gte(unitMonthRecords.month, fromMonth),
        lte(unitMonthRecords.month, toMonth),
        isNull(unitMonthRecords.deletedAt),
      ),
    )
    .orderBy(unitMonthRecords.month, units.unitCode);
}

export type RentRangeRow = Awaited<ReturnType<typeof listForMonthRange>>[number];
