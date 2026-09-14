import { boolean, check, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/**
 * Single-user app (decision 8: no auth/RLS in Phases 1-7) — there is exactly one
 * property row. ownerId is kept nullable for a future multi-user/deployed mode
 * so the schema does not need reshaping later.
 */
export const properties = pgTable(
  "properties",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id"),
    name: text("name").notNull(),
    // Frozen after creation by application logic, not a DB constraint — changing
    // currency mid-history would reinterpret every past amount with no conversion.
    currency: varchar("currency", { length: 3 }).notNull().default("INR"),
    timezone: text("timezone").notNull().default("Asia/Kolkata"),
    // PRD 11 requires excluding pre-tracker-start months from averages; PRD 17
    // never modelled where "start" is recorded. This is that column.
    trackingStartMonth: varchar("tracking_start_month", { length: 7 }).notNull(),
    includeSelfOccupiedInTarget: boolean("include_self_occupied_in_target")
      .notNull()
      .default(false),
    countVacantInTarget: boolean("count_vacant_in_target").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "properties_tracking_start_month_format",
      sql`${t.trackingStartMonth} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`,
    ),
  ],
);
