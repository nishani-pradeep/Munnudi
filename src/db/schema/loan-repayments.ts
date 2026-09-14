import {
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
import { loans } from "./loans";

export const loanRepayments = pgTable(
  "loan_repayments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    loanId: uuid("loan_id")
      .notNull()
      .references(() => loans.id),
    month: varchar("month", { length: 7 }).notNull(),
    paymentDate: date("payment_date").notNull(),
    totalPayment: numeric("total_payment", { precision: 14, scale: 2 }).notNull(),
    // Defaults to 0, not NULL: a gold-loan interest-only payment legitimately
    // records Rs 0 principal (PRD 22), which must be distinct from "not entered".
    principalPaid: numeric("principal_paid", { precision: 14, scale: 2 }).notNull().default("0"),
    interestPaid: numeric("interest_paid", { precision: 14, scale: 2 }).notNull().default("0"),
    otherCharges: numeric("other_charges", { precision: 14, scale: 2 }).notNull().default("0"),
    // Signed. Named non-repayment balance changes (capitalized interest, a
    // penalty, an outside prepayment) so the outstanding recurrence is EXACT
    // by construction rather than "reconciled with a warning" (decision 5).
    principalAdjustment: numeric("principal_adjustment", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    adjustmentReason: text("adjustment_reason"),
    // Nullable (contra PRD 10.1): forcing a value makes the user invent one,
    // which then becomes falsely "authoritative". NULL = derive from the
    // recurrence instead of comparing against a real statement balance.
    outstandingAfterPayment: numeric("outstanding_after_payment", { precision: 14, scale: 2 }),
    comment: text("comment"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("loan_repayments_loan_month_key")
      .on(t.loanId, t.month)
      .where(sql`deleted_at IS NULL`),
    index("loan_repayments_property_id_idx").on(t.propertyId),
    index("loan_repayments_loan_id_idx").on(t.loanId),
    check("loan_repayments_month_format", sql`${t.month} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
    check("loan_repayments_total_positive", sql`${t.totalPayment} > 0`),
    check("loan_repayments_principal_nonneg", sql`${t.principalPaid} >= 0`),
    check("loan_repayments_interest_nonneg", sql`${t.interestPaid} >= 0`),
    check("loan_repayments_other_nonneg", sql`${t.otherCharges} >= 0`),
    check(
      "loan_repayments_parts_within_total",
      sql`${t.principalPaid} + ${t.interestPaid} + ${t.otherCharges} <= ${t.totalPayment}`,
    ),
    check(
      "loan_repayments_adjustment_needs_reason",
      sql`${t.principalAdjustment} = 0 OR ${t.adjustmentReason} IS NOT NULL`,
    ),
    // Deliberately NO check that outstanding decreases: PRD 14 lists an
    // increase as a FLAG, not an error — a gold loan can legitimately grow.
  ],
);
