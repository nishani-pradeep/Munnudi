"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { actionClient } from "./client";
import { getActivePropertyId } from "@/server/db/scope";
import { upsertUtilityRecord, UTILITY_TYPES } from "@/server/db/repositories/utility-records";
import { listActiveUnits } from "@/server/db/repositories/units";
import { monthKey } from "@/domain/month";

const READING_RE = /^\d+(\.\d{1,3})?$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const optionalReading = z
  .string()
  .trim()
  .refine((v) => v === "" || READING_RE.test(v), "Enter a valid reading, e.g. 1234 or 1234.5");

const saveUtilityInputSchema = z.object({
  unitId: z.string().uuid(),
  month: z.string().regex(MONTH_RE, "Invalid month"),
  utilityType: z.enum(UTILITY_TYPES),
  uomSnapshot: z.string().trim().min(1).max(20),
  previousReading: optionalReading,
  currentReading: optionalReading,
  usageOverride: optionalReading,
  meterEvent: z.enum(["NONE", "RESET", "ROLLOVER", "REPLACED"]),
  billAmount: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), "Enter a valid amount"),
  billPaid: z.enum(["yes", "no", "unset"]),
  noBillThisMonth: z.boolean(),
  comment: z.string().trim().max(500, "Keep comments under 500 characters"),
});

/**
 * Utilities have no pre-generated census (unlike Rent) — this action verifies
 * the unit belongs to the active property (via listActiveUnits, itself
 * property-scoped) before writing, which is this feature's equivalent of
 * decision 8's chokepoint since there is no per-row propertyId check inside
 * the upsert itself (utility_records rows may not exist yet to check against).
 */
export const saveUtilityAction = actionClient
  .inputSchema(saveUtilityInputSchema)
  .action(async ({ parsedInput }) => {
    const propertyId = await getActivePropertyId();
    const activeUnits = await listActiveUnits(propertyId);
    if (!activeUnits.some((u) => u.id === parsedInput.unitId)) {
      throw new Error("Unit not found for the active property.");
    }

    const toNullable = (v: string) => (v === "" ? null : v);

    await upsertUtilityRecord(propertyId, {
      unitId: parsedInput.unitId,
      month: monthKey(parsedInput.month),
      utilityType: parsedInput.utilityType,
      uomSnapshot: parsedInput.uomSnapshot,
      previousReading: toNullable(parsedInput.previousReading),
      currentReading: toNullable(parsedInput.currentReading),
      usageOverride: toNullable(parsedInput.usageOverride),
      meterEvent: parsedInput.meterEvent,
      billAmount: toNullable(parsedInput.billAmount),
      billPaid:
        parsedInput.billPaid === "unset" ? null : parsedInput.billPaid === "yes" ? true : false,
      noBillThisMonth: parsedInput.noBillThisMonth,
      comment: toNullable(parsedInput.comment),
    });

    revalidatePath("/utilities");
    return { ok: true as const };
  });
