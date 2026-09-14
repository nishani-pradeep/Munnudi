import {
  check,
  date,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { properties } from "./properties";
import { units } from "./units";
import { expenseCategories } from "./expense-categories";

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    // Optional per-unit allocation (PRD 9); NULL = property-wide/common expense.
    unitId: uuid("unit_id").references(() => units.id),
    month: varchar("month", { length: 7 }).notNull(),
    expenseDate: date("expense_date"),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => expenseCategories.id),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    comment: text("comment"),
    reference: text("reference"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("expenses_property_id_idx").on(t.propertyId),
    index("expenses_month_idx").on(t.month),
    check("expenses_month_format", sql`${t.month} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'`),
    check("expenses_amount_positive", sql`${t.amount} > 0`),
  ],
);
