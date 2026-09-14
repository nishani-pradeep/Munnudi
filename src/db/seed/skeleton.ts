/**
 * Skeleton seed: 1 property, 6 units (4x2BHK + 2x1BHK, one self-occupied),
 * 4 loans, 6 expense categories — all at zero/placeholder amounts (PRD 24).
 * Real rent, loan balances etc. are entered through Settings (Phase 4).
 *
 * Idempotent-ish for convenience: refuses to run against a property that
 * already exists, so it is safe to call by accident. Use `pnpm db:reset`
 * first if you want a clean slate.
 */
import "../env";
import { db } from "../client";
import { properties, units, unitRentVersions, loans, expenseCategories } from "../schema";
import { resolveCurrentMonth } from "@/lib/app-config";

const EXPENSE_CATEGORIES = [
  "Common Electricity",
  "Electrical Maintenance",
  "Water",
  "Plumbing",
  "Cleaning",
  "Miscellaneous",
] as const;

export async function seedSkeleton(overrideTrackingStartMonth?: string) {
  const existing = await db.select({ id: properties.id }).from(properties).limit(1);
  if (existing.length > 0) {
    console.log("A property already exists — skeleton seed skipped. Use `pnpm db:reset` first.");
    return null;
  }

  const trackingStartMonth = overrideTrackingStartMonth ?? resolveCurrentMonth();

  const [property] = await db
    .insert(properties)
    .values({ name: "Munnudi Property", trackingStartMonth })
    .returning();

  const unitSpecs = [
    { code: "U1", type: "2BHK", occupancy: "SELF_OCCUPIED" as const },
    { code: "U2", type: "2BHK", occupancy: "OCCUPIED" as const },
    { code: "U3", type: "2BHK", occupancy: "OCCUPIED" as const },
    { code: "U4", type: "2BHK", occupancy: "OCCUPIED" as const },
    { code: "U5", type: "1BHK", occupancy: "OCCUPIED" as const },
    { code: "U6", type: "1BHK", occupancy: "OCCUPIED" as const },
  ];

  const insertedUnits = await db
    .insert(units)
    .values(
      unitSpecs.map((u) => ({
        propertyId: property.id,
        unitCode: u.code,
        unitType: u.type,
        defaultOccupancyStatus: u.occupancy,
      })),
    )
    .returning();

  // Rentable units get a Rs 0 placeholder rent version; the self-occupied
  // unit gets none (applicableRent() returns 0 for a unit with no version,
  // same result, one fewer placeholder row).
  const rentable = insertedUnits.filter((u) => u.defaultOccupancyStatus !== "SELF_OCCUPIED");
  if (rentable.length > 0) {
    await db.insert(unitRentVersions).values(
      rentable.map((u) => ({
        unitId: u.id,
        effectiveMonth: trackingStartMonth,
        expectedRent: "0",
      })),
    );
  }

  const insertedLoans = await db
    .insert(loans)
    .values([
      {
        propertyId: property.id,
        name: "Home Loan 1",
        loanType: "HOME",
        openingOutstanding: "0",
        openingAsOfMonth: trackingStartMonth,
        expectsMonthlyPayment: true,
      },
      {
        propertyId: property.id,
        name: "Home Loan 2",
        loanType: "HOME",
        openingOutstanding: "0",
        openingAsOfMonth: trackingStartMonth,
        expectsMonthlyPayment: true,
      },
      {
        propertyId: property.id,
        name: "Home Loan 3",
        loanType: "HOME",
        openingOutstanding: "0",
        openingAsOfMonth: trackingStartMonth,
        expectsMonthlyPayment: true,
      },
      {
        propertyId: property.id,
        name: "Gold Loan",
        loanType: "GOLD",
        openingOutstanding: "0",
        openingAsOfMonth: trackingStartMonth,
        expectsMonthlyPayment: false,
      },
    ])
    .returning();

  const insertedCategories = await db
    .insert(expenseCategories)
    .values(
      EXPENSE_CATEGORIES.map((name) => ({
        propertyId: property.id,
        name,
        isMaintenance: true,
      })),
    )
    .returning();

  console.log(`Skeleton seeded: property ${property.id}, tracking from ${trackingStartMonth}.`);

  return {
    property,
    units: insertedUnits,
    loans: insertedLoans,
    expenseCategories: insertedCategories,
    trackingStartMonth,
  };
}

// ESM-safe "run directly" guard, since demo.ts imports seedSkeleton() without
// wanting it to also auto-execute.
const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  seedSkeleton()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
