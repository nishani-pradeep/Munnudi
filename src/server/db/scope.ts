/**
 * The property-scoping chokepoint (decision 8).
 *
 * There is exactly one property row (single-user, no auth in Phases 1-7).
 * getActiveProperty() is the ONLY place that resolves it. Every repository
 * function below takes the resulting propertyId as an explicit argument and
 * filters by it on both reads and id-based writes — so a crafted foreign id
 * can never reach another property's row, which is exactly PRD 22's
 * authorization test, and is what keeps the schema safe to extend to
 * multiple properties later without a redesign.
 *
 * No Server Action may accept a propertyId from client input. Ever.
 */
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { properties } from "@/db/schema";

export type ActiveProperty = typeof properties.$inferSelect;

export const getActiveProperty = cache(async (): Promise<ActiveProperty> => {
  const [property] = await db.select().from(properties).limit(1);
  if (!property) {
    throw new Error(
      "No property found. Run `pnpm db:seed` (or `pnpm db:seed:demo`) before using the app.",
    );
  }
  return property;
});

export async function getActivePropertyId(): Promise<string> {
  return (await getActiveProperty()).id;
}

export { eq };
