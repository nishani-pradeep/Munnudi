import {
  boolean,
  check,
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

export const utilityRecords = pgTable(
  "utility_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => units.id),
    month: varchar("month", { length: 7 }).notNull(),
    utilityType: text("utility_type").notNull(),

    // Snapshotted per row (PRD 8: no universal kWh<->litre conversion). If a
    // unit's unit-of-measure changes later, past charts must not be rescaled.
    uomSnapshot: text("uom_snapshot").notNull(),

    previousReading: numeric("previous_reading", { precision: 14, scale: 3 }),
    currentReading: numeric("current_reading", { precision: 14, scale: 3 }),
    // Replaces the PRD's single ambiguous "usage" column, which was both
    // stored and derived. usage = COALESCE(usageOverride, current - previous)
    // is computed in the domain layer, never in SQL (decision 1).
    usageOverride: numeric("usage_override", { precision: 14, scale: 3 }),

    meterEvent: text("meter_event").notNull().default("NONE"),
    rolloverMax: numeric("rollover_max", { precision: 14, scale: 3 }),

    billAmount: numeric("bill_amount", { precision: 14, scale: 2 }),
    // Tri-state: NULL = not entered, distinct from true/false.
    billPaid: boolean("bill_paid"),
    // Positive assertion of "Rs 0, checked" vs "not entered" (PRD 6.3).
    noBillThisMonth: boolean("no_bill_this_month").notNull().default(false),
    comment: text("comment"),

    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("utility_records_unit_month_type_key")
      .on(t.unitId, t.month, t.utilityType)
      .where(sql`deleted_at IS NULL`),
    index("utility_records_property_id_idx").on(t.propertyId),
    index("utility_records_month_idx").on(t.month),
    check("utility_records_month_format", sql`${t.month} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
    check("utility_records_type_check", sql`${t.utilityType} IN ('ELECTRICITY','WATER')`),
    check(
      "utility_records_meter_event_check",
      sql`${t.meterEvent} IN ('NONE','RESET','ROLLOVER','REPLACED')`,
    ),
    // PRD 8: negative usage is blocked unless a meter event explains it.
    check(
      "utility_records_no_negative_usage",
      sql`${t.meterEvent} <> 'NONE' OR ${t.previousReading} IS NULL OR ${t.currentReading} IS NULL OR ${t.currentReading} >= ${t.previousReading}`,
    ),
  ],
);
