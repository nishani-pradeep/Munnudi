import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { properties } from "@/db/schema";

export type UpdatePropertyInput = {
  name: string;
  timezone: string;
  trackingStartMonth: string;
  includeSelfOccupiedInTarget: boolean;
  countVacantInTarget: boolean;
};

export async function updateProperty(
  propertyId: string,
  input: UpdatePropertyInput,
): Promise<boolean> {
  const result = await db
    .update(properties)
    .set(input)
    .where(eq(properties.id, propertyId))
    .returning({ id: properties.id });
  return result.length > 0;
}
