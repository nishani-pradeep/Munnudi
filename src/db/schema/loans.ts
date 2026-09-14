import {
  boolean,
  check,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { properties } from "./properties";

export const loans = pgTable(
  "loans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    name: text("name").notNull(),
    loanType: text("loan_type").notNull(),
    lender: text("lender"),
    originalPrincipal: numeric("original_principal", { precision: 14, scale: 2 }),
    openingOutstanding: numeric("opening_outstanding", { precision: 14, scale: 2 }).notNull(),
    // Anchors the outstanding-balance recurrence (decision 5) — without this,
    // "opening balance" has no reference month and LAG() has nothing to chain from.
    openingAsOfMonth: varchar("opening_as_of_month", { length: 7 }).notNull(),
    interestRate: numeric("interest_rate", { precision: 6, scale: 3 }),
    // Nullable: a bullet-repayment gold loan has no fixed monthly EMI.
    scheduledEmi: numeric("scheduled_emi", { precision: 14, scale: 2 }),
    // Suppresses a false "repayment missing" flag (PRD 14) for loans that are
    // not expected to have a transaction every month.
    expectsMonthlyPayment: boolean("expects_monthly_payment").notNull().default(true),
    // Filter historical queries by month <= closedMonth, never by `active`
    // (decision 4's rule applied to loans too) — a closed loan must still
    // appear in past months of the Loan Balance Trend chart.
    closedMonth: varchar("closed_month", { length: 7 }),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "loans_opening_as_of_month_format",
      sql`${t.openingAsOfMonth} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`,
    ),
    check(
      "loans_closed_month_format",
      sql`${t.closedMonth} IS NULL OR ${t.closedMonth} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`,
    ),
  ],
);
