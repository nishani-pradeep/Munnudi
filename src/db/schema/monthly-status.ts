import { check, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { properties } from "./properties";

/**
 * decision 6: the PRD's OPEN->RENT->UTILITIES->EXPENSES->LOANS->REVIEW->CLOSED
 * pipeline is a CHECKLIST, not a linear state machine — real use enters
 * sections out of order. `state` is only ever OPEN or CLOSED (the lock); the
 * four *_reviewed_at columns are independent checklist items and double as
 * the "was this month's data asserted complete" signal decision 7 needs for
 * averages (expenses/utilities have no other way to distinguish Rs 0 from
 * not-entered).
 */
export const monthlyStatus = pgTable(
  "monthly_status",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    month: varchar("month", { length: 7 }).notNull(),
    state: text("state").notNull().default("OPEN"),
    rentReviewedAt: timestamp("rent_reviewed_at", { withTimezone: true }),
    utilitiesReviewedAt: timestamp("utilities_reviewed_at", { withTimezone: true }),
    expensesReviewedAt: timestamp("expenses_reviewed_at", { withTimezone: true }),
    loansReviewedAt: timestamp("loans_reviewed_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    closedBy: text("closed_by"),
    reopenedAt: timestamp("reopened_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("monthly_status_property_month_key").on(t.propertyId, t.month),
    check("monthly_status_month_format", sql`${t.month} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
    check("monthly_status_state_check", sql`${t.state} IN ('OPEN','CLOSED')`),
  ],
);
