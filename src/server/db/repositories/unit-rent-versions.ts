import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { unitRentVersions, units } from "@/db/schema";
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

/** All rent versions for a property, for the settings page. */
export async function listRentVersionsForProperty(propertyId: string) {
  return db
    .select({
      id: unitRentVersions.id,
      unitId: unitRentVersions.unitId,
      effectiveMonth: unitRentVersions.effectiveMonth,
      expectedRent: unitRentVersions.expectedRent,
    })
    .from(unitRentVersions)
    .innerJoin(units, eq(units.id, unitRentVersions.unitId))
    .where(eq(units.propertyId, propertyId))
    .orderBy(unitRentVersions.unitId, desc(unitRentVersions.effectiveMonth));
}

export async function createRentVersion(
  propertyId: string,
  input: { unitId: string; effectiveMonth: string; expectedRent: string },
) {
  const [unit] = await db
    .select({ id: units.id })
    .from(units)
    .where(and(eq(units.id, input.unitId), eq(units.propertyId, propertyId)));
  if (!unit) throw new Error("Unit not found");

  const [row] = await db
    .insert(unitRentVersions)
    .values(input)
    .returning({ id: unitRentVersions.id });
  return row.id;
}

export async function updateRentVersion(
  propertyId: string,
  versionId: string,
  input: { effectiveMonth: string; expectedRent: string },
): Promise<boolean> {
  const result = await db
    .update(unitRentVersions)
    .set(input)
    .where(
      and(
        eq(unitRentVersions.id, versionId),
        inArray(
          unitRentVersions.unitId,
          db.select({ id: units.id }).from(units).where(eq(units.propertyId, propertyId)),
        ),
      ),
    )
    .returning({ id: unitRentVersions.id });
  return result.length > 0;
}

export async function deleteRentVersion(
  propertyId: string,
  versionId: string,
): Promise<boolean> {
  const result = await db
    .delete(unitRentVersions)
    .where(
      and(
        eq(unitRentVersions.id, versionId),
        inArray(
          unitRentVersions.unitId,
          db.select({ id: units.id }).from(units).where(eq(units.propertyId, propertyId)),
        ),
      ),
    )
    .returning({ id: unitRentVersions.id });
  return result.length > 0;
}
