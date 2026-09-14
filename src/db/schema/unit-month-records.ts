import {
  boolean,
  check,
  date,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { properties } from "./properties";
import { units } from "./units";

/**
 * The monthly unit census (decision 4). A row exists for EVERY active unit
 * EVERY month, including self-occupied ones — this is what makes Rental
 * Target, the Unit Collection Matrix, and occupancy history all derivable
 * purely from this table, with no dependency on units' CURRENT state.
 *
 * Renamed from the PRD's "rent_records" because it is a census, not just a
 * rent ledger: self-occupied rows exist here with is_billable = false.
 */
export const unitMonthRecords = pgTable(
  "unit_month_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id),
    month: varchar("month", { length: 7 }).notNull(),

    // Snapshotted at generation time (carry-forward from the previous month).
    // A fact, not a policy — never recomputed retroactively from current state.
    occupancySnapshot: text("occupancy_snapshot").notNull(),

    // Populated even when self-occupied, so a future opportunity-cost view
    // (PRD 4, post-MVP) stays reconstructable for historical months.
    expectedRentSnapshot: numeric("expected_rent_snapshot", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),

    isBillable: boolean("is_billable")
      .notNull()
      .generatedAlwaysAs(sql`(occupancy_snapshot <> 'SELF_OCCUPIED')`),

    // NULL = not entered. This is the single most important nullability in the
    // whole schema (PRD 6.3: "Not entered" must never render as Rs 0).
    paidAmount: numeric("paid_amount", { precision: 14, scale: 2 }),
    paymentDate: date("payment_date"),
    comment: text("comment"),

    // Derived by construction, so "partial rent shown as paid" (PRD 22) is a
    // database impossibility, not an application-discipline hope.
    status: text("status")
      .notNull()
      .generatedAlwaysAs(
        sql`(
        CASE
          WHEN occupancy_snapshot = 'SELF_OCCUPIED' THEN 'NOT_BILLABLE'
          WHEN paid_amount IS NULL THEN 'UNSET'
          WHEN paid_amount = 0 THEN 'UNPAID'
          WHEN paid_amount < expected_rent_snapshot THEN 'PARTIAL'
          WHEN paid_amount = expected_rent_snapshot THEN 'PAID'
          ELSE 'OVERPAID'
        END
      )`,
      ),

    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Partial: soft-deleting a wrong entry and re-entering the correction must
    // not collide with the deleted row on this constraint.
    uniqueIndex("unit_month_records_unit_month_key")
      .on(t.unitId, t.month)
      .where(sql`deleted_at IS NULL`),
    index("unit_month_records_property_id_idx").on(t.propertyId),
    index("unit_month_records_month_idx").on(t.month),
    check("unit_month_records_month_format", sql`${t.month} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
    check(
      "unit_month_records_occupancy_check",
      sql`${t.occupancySnapshot} IN ('SELF_OCCUPIED','OCCUPIED','VACANT')`,
    ),
    check(
      "unit_month_records_paid_amount_nonneg",
      sql`${t.paidAmount} IS NULL OR ${t.paidAmount} >= 0`,
    ),
  ],
);
