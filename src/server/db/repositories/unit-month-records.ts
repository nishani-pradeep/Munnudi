import { and, eq, isNull } from "drizzle-orm";
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
      // Must match the partial unique index's predicate exactly, or Postgres
      // cannot infer it as the arbiter: "no unique or exclusion constraint
      // matching the ON CONFLICT specification" (found by running this for
      // real, not by reading the DSL docs alone).
      target: [unitMonthRecords.unitId, unitMonthRecords.month],
      where: isNull(unitMonthRecords.deletedAt),
    });
}

/** Raw census rows for a month, scoped by property. Not soft-delete filtered here by design (decision 1: callers/domain decide). */
async function listCensusRows(propertyId: string, month: MonthKey) {
  return db
    .select()
    .from(unitMonthRecords)
    .where(and(eq(unitMonthRecords.propertyId, propertyId), eq(unitMonthRecords.month, month)));
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
    .where(and(eq(unitMonthRecords.propertyId, propertyId), eq(unitMonthRecords.month, month)))
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
    .where(and(eq(unitMonthRecords.id, recordId), eq(unitMonthRecords.propertyId, propertyId)))
    .returning({ id: unitMonthRecords.id });

  return result.length > 0;
}
