import {
  check,
  numeric,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { units } from "./units";

/** Rent configured per unit, versioned by effective month (PRD 7.1). */
export const unitRentVersions = pgTable(
  "unit_rent_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id),
    effectiveMonth: varchar("effective_month", { length: 7 }).notNull(),
    expectedRent: numeric("expected_rent", { precision: 14, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("unit_rent_versions_unit_month_key").on(t.unitId, t.effectiveMonth),
    check(
      "unit_rent_versions_effective_month_format",
      sql`${t.effectiveMonth} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`,
    ),
    check("unit_rent_versions_expected_rent_nonneg", sql`${t.expectedRent} >= 0`),
  ],
);
