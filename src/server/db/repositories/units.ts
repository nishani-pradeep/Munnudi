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

export function toCensusInput(unit: Awaited<ReturnType<typeof listActiveUnits>>[number]) {
  return {
    unitId: unit.id,
    defaultOccupancyStatus: unit.defaultOccupancyStatus as OccupancyStatus,
  };
}
