import { boolean, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { properties } from "./properties";

export const expenseCategories = pgTable(
  "expense_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    name: text("name").notNull(),
    // A policy, not a fact: stays editable, and the UI warns that changing it
    // reinterprets historical Operating Profit (decision on is_maintenance).
    isMaintenance: boolean("is_maintenance").notNull().default(true),
    active: boolean("active").notNull().default(true),
  },
  (t) => [uniqueIndex("expense_categories_property_name_key").on(t.propertyId, t.name)],
);
