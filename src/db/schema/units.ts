import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { properties } from "./properties";

export const units = pgTable(
  "units",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    unitCode: text("unit_code").notNull(),
    unitType: text("unit_type").notNull(),
    // Seeds month 1 of the census only; every later month is carry-forward
    // (decision 4) — this is NOT the current occupancy of the unit.
    defaultOccupancyStatus: text("default_occupancy_status").notNull(),
    electricityUom: text("electricity_uom").notNull().default("kWh"),
    waterUom: text("water_uom").notNull().default("L"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("units_property_unit_code_key").on(t.propertyId, t.unitCode),
    index("units_property_id_idx").on(t.propertyId),
    check("units_unit_type_check", sql`${t.unitType} IN ('2BHK','1BHK')`),
    check(
      "units_default_occupancy_status_check",
      sql`${t.defaultOccupancyStatus} IN ('SELF_OCCUPIED','OCCUPIED','VACANT')`,
    ),
  ],
);
