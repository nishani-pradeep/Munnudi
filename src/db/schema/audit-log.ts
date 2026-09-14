import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { properties } from "./properties";

/**
 * property_id is denormalized onto this table (the PRD's audit_log lacked it)
 * because the scoping chokepoint (decision 8) needs to filter audit rows by
 * property directly — it cannot follow the polymorphic entity_type/entity_id
 * reference to find an owner.
 *
 * Append-only is enforced by a hand-written trigger (see the migration), not
 * by this TS schema — Drizzle's table DSL has no "no UPDATE/DELETE" concept.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => properties.id),
    userId: uuid("user_id"),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    action: text("action").notNull(),
    beforeJson: jsonb("before_json"),
    afterJson: jsonb("after_json"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_log_property_entity_idx").on(t.propertyId, t.entityType, t.entityId, t.createdAt),
  ],
);
