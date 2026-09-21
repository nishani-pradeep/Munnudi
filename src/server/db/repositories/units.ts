import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { units } from "@/db/schema";
import type { OccupancyStatus } from "@/domain/rent";

export async function listActiveUnits(propertyId: string) {
  return db
    .select()
    .from(units)
    .where(and(eq(units.propertyId, propertyId), eq(units.active, true)))
    .orderBy(units.unitCode);
}

export async function listAllUnits(propertyId: string) {
  return db
    .select()
    .from(units)
    .where(eq(units.propertyId, propertyId))
    .orderBy(units.unitCode);
}

export type UnitInput = {
  unitCode: string;
  unitType: string;
  defaultOccupancyStatus: string;
  electricityUom?: string;
  waterUom?: string;
};

export async function createUnit(propertyId: string, input: UnitInput) {
  const [row] = await db
    .insert(units)
    .values({ propertyId, ...input })
    .returning({ id: units.id });
  return row.id;
}

export async function updateUnit(
  propertyId: string,
  unitId: string,
  input: UnitInput,
): Promise<boolean> {
  const result = await db
    .update(units)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(units.id, unitId), eq(units.propertyId, propertyId)))
    .returning({ id: units.id });
  return result.length > 0;
}

export async function deactivateUnit(propertyId: string, unitId: string): Promise<boolean> {
  const result = await db
    .update(units)
    .set({ active: false, updatedAt: new Date() })
    .where(and(eq(units.id, unitId), eq(units.propertyId, propertyId)))
    .returning({ id: units.id });
  return result.length > 0;
}

export function toCensusInput(unit: Awaited<ReturnType<typeof listActiveUnits>>[number]) {
  return {
    unitId: unit.id,
    defaultOccupancyStatus: unit.defaultOccupancyStatus as OccupancyStatus,
  };
}
