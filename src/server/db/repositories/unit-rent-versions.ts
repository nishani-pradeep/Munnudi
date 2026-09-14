import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { unitRentVersions } from "@/db/schema";
import { monthKey } from "@/domain/month";
import type { RentVersion } from "@/domain/rent";
import { parsePaise } from "@/domain/money";

/** All rent versions for the given units, in the domain's plain shape. */
export async function listRentVersionsForUnits(unitIds: readonly string[]): Promise<RentVersion[]> {
  if (unitIds.length === 0) return [];
  const rows = await db
    .select()
    .from(unitRentVersions)
    .where(inArray(unitRentVersions.unitId, unitIds));
  return rows.map((r) => ({
    unitId: r.unitId,
    effectiveMonth: monthKey(r.effectiveMonth),
    expectedRent: parsePaise(r.expectedRent),
  }));
}
