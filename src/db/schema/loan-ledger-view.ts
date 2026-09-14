import { numeric, pgView, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * Typed binding to v_loan_ledger (drizzle/0001_audit_and_ledger.sql). The
 * view itself is hand-written SQL — genuinely outside any table-schema DSL
 * (decision 8's stance) — this just gives us a typed way to query it.
 * `.existing()` because Drizzle must never try to CREATE or migrate this;
 * the migration file already owns it.
 */
export const loanLedger = pgView("v_loan_ledger", {
  id: uuid("id"),
  propertyId: uuid("property_id"),
  loanId: uuid("loan_id"),
  month: varchar("month", { length: 7 }),
  openingBalance: numeric("opening_balance", { precision: 14, scale: 2 }),
  principalPaid: numeric("principal_paid", { precision: 14, scale: 2 }),
  principalAdjustment: numeric("principal_adjustment", { precision: 14, scale: 2 }),
  expectedOutstanding: numeric("expected_outstanding", { precision: 14, scale: 2 }),
  enteredOutstanding: numeric("entered_outstanding", { precision: 14, scale: 2 }),
  effectiveOutstanding: numeric("effective_outstanding", { precision: 14, scale: 2 }),
  drift: numeric("drift", { precision: 14, scale: 2 }),
}).existing();
