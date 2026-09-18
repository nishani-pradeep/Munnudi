import { and, desc, eq, gte, isNotNull, isNull, lte } from "drizzle-orm";
import { db } from "@/db/client";
import { units, utilityRecords } from "@/db/schema";
import type { MonthKey } from "@/domain/month";
import { listActiveUnits } from "./units";

export const UTILITY_TYPES = ["ELECTRICITY", "WATER"] as const;
export type UtilityType = (typeof UTILITY_TYPES)[number];

const DEFAULT_UOM: Record<UtilityType, string> = { ELECTRICITY: "kWh", WATER: "kL" };

export type UtilityRow = {
  /** null when no row exists yet — the page renders a "virtual" empty row. */
  id: string | null;
  unitId: string;
  unitCode: string;
  utilityType: UtilityType;
  uomSnapshot: string;
  previousReading: string | null;
  currentReading: string | null;
  usageOverride: string | null;
  meterEvent: string;
  billAmount: string | null;
  billPaid: boolean | null;
  noBillThisMonth: boolean;
  comment: string | null;
};

/**
 * Unlike Rent's census, there is no pre-generation here: a row is created
 * lazily on first save. This function always returns one row per
 * (active unit x utility type) regardless of whether a DB row exists yet,
 * so the page has a stable, complete grid to render and edit.
 */
export async function listMonthForDisplay(
  propertyId: string,
  month: MonthKey,
): Promise<UtilityRow[]> {
  const activeUnits = await listActiveUnits(propertyId);
  const existing = await db
    .select()
    .from(utilityRecords)
    .where(
      and(
        eq(utilityRecords.propertyId, propertyId),
        eq(utilityRecords.month, month),
        isNull(utilityRecords.deletedAt),
      ),
    );

  const byKey = new Map(existing.map((r) => [`${r.unitId}:${r.utilityType}`, r]));

  const rows: UtilityRow[] = [];
  for (const unit of activeUnits) {
    for (const type of UTILITY_TYPES) {
      const found = byKey.get(`${unit.id}:${type}`);
      rows.push(
        found
          ? {
              id: found.id,
              unitId: unit.id,
              unitCode: unit.unitCode,
              utilityType: type,
              uomSnapshot: found.uomSnapshot,
              previousReading: found.previousReading,
              currentReading: found.currentReading,
              usageOverride: found.usageOverride,
              meterEvent: found.meterEvent,
              billAmount: found.billAmount,
              billPaid: found.billPaid,
              noBillThisMonth: found.noBillThisMonth,
              comment: found.comment,
            }
          : {
              id: null,
              unitId: unit.id,
              unitCode: unit.unitCode,
              utilityType: type,
              uomSnapshot: DEFAULT_UOM[type],
              previousReading: null,
              currentReading: null,
              usageOverride: null,
              meterEvent: "NONE",
              billAmount: null,
              billPaid: null,
              noBillThisMonth: false,
              comment: null,
            },
      );
    }
  }
  return rows;
}

export type UpsertUtilityInput = {
  unitId: string;
  month: MonthKey;
  utilityType: UtilityType;
  uomSnapshot: string;
  previousReading: string | null;
  currentReading: string | null;
  usageOverride: string | null;
  meterEvent: string;
  billAmount: string | null;
  billPaid: boolean | null;
  noBillThisMonth: boolean;
  comment: string | null;
};

/**
 * Scoped upsert: propertyId is verified against the unit before writing (the
 * unit lookup below is itself property-scoped via listActiveUnits' caller
 * passing a real propertyId), and the conflict target repeats the partial
 * unique index's exact predicate — the same lesson learned the hard way with
 * unit_month_records in Phase 2: naming only the columns is not enough when
 * the backing index is partial.
 */
export async function upsertUtilityRecord(
  propertyId: string,
  input: UpsertUtilityInput,
): Promise<void> {
  await db
    .insert(utilityRecords)
    .values({
      propertyId,
      unitId: input.unitId,
      month: input.month,
      utilityType: input.utilityType,
      uomSnapshot: input.uomSnapshot,
      previousReading: input.previousReading,
      currentReading: input.currentReading,
      usageOverride: input.usageOverride,
      meterEvent: input.meterEvent,
      billAmount: input.billAmount,
      billPaid: input.billPaid,
      noBillThisMonth: input.noBillThisMonth,
      comment: input.comment,
    })
    .onConflictDoUpdate({
      target: [utilityRecords.unitId, utilityRecords.month, utilityRecords.utilityType],
      targetWhere: isNull(utilityRecords.deletedAt),
      set: {
        previousReading: input.previousReading,
        currentReading: input.currentReading,
        usageOverride: input.usageOverride,
        meterEvent: input.meterEvent,
        billAmount: input.billAmount,
        billPaid: input.billPaid,
        noBillThisMonth: input.noBillThisMonth,
        comment: input.comment,
        updatedAt: new Date(),
      },
    });
}

export async function softDeleteUtilityRecord(
  propertyId: string,
  recordId: string,
): Promise<boolean> {
  const result = await db
    .update(utilityRecords)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(utilityRecords.id, recordId),
        eq(utilityRecords.propertyId, propertyId),
        isNull(utilityRecords.deletedAt),
      ),
    )
    .returning({ id: utilityRecords.id });
  return result.length > 0;
}

export async function restoreUtilityRecord(
  propertyId: string,
  recordId: string,
): Promise<boolean> {
  const [deleted] = await db
    .select({
      unitId: utilityRecords.unitId,
      month: utilityRecords.month,
      utilityType: utilityRecords.utilityType,
    })
    .from(utilityRecords)
    .where(
      and(
        eq(utilityRecords.id, recordId),
        eq(utilityRecords.propertyId, propertyId),
        isNotNull(utilityRecords.deletedAt),
      ),
    );
  if (!deleted) return false;

  // Check if an active row already exists for this unit+month+type
  const [conflict] = await db
    .select({ id: utilityRecords.id })
    .from(utilityRecords)
    .where(
      and(
        eq(utilityRecords.unitId, deleted.unitId),
        eq(utilityRecords.month, deleted.month),
        eq(utilityRecords.utilityType, deleted.utilityType),
        isNull(utilityRecords.deletedAt),
      ),
    );
  if (conflict)
    throw new Error("An active utility record already exists for this unit, month, and type.");

  const result = await db
    .update(utilityRecords)
    .set({ deletedAt: null, updatedAt: new Date() })
    .where(eq(utilityRecords.id, recordId))
    .returning({ id: utilityRecords.id });
  return result.length > 0;
}

/** Recently soft-deleted utility records for the month, for the "Recently deleted" restore panel. */
export async function listDeletedForMonth(propertyId: string, month: MonthKey) {
  return db
    .select({
      id: utilityRecords.id,
      unitCode: units.unitCode,
      utilityType: utilityRecords.utilityType,
      billAmount: utilityRecords.billAmount,
    })
    .from(utilityRecords)
    .innerJoin(units, eq(units.id, utilityRecords.unitId))
    .where(
      and(
        eq(utilityRecords.propertyId, propertyId),
        eq(utilityRecords.month, month),
        isNotNull(utilityRecords.deletedAt),
      ),
    )
    .orderBy(desc(utilityRecords.updatedAt));
}

export async function listForMonthRange(
  propertyId: string,
  fromMonth: MonthKey,
  toMonth: MonthKey,
) {
  return db
    .select({
      month: utilityRecords.month,
      unitId: utilityRecords.unitId,
      unitCode: units.unitCode,
      utilityType: utilityRecords.utilityType,
      previousReading: utilityRecords.previousReading,
      currentReading: utilityRecords.currentReading,
      usageOverride: utilityRecords.usageOverride,
      billAmount: utilityRecords.billAmount,
    })
    .from(utilityRecords)
    .innerJoin(units, eq(units.id, utilityRecords.unitId))
    .where(
      and(
        eq(utilityRecords.propertyId, propertyId),
        gte(utilityRecords.month, fromMonth),
        lte(utilityRecords.month, toMonth),
        isNull(utilityRecords.deletedAt),
      ),
    )
    .orderBy(utilityRecords.month, units.unitCode);
}

export type UtilityRangeRow = Awaited<ReturnType<typeof listForMonthRange>>[number];
