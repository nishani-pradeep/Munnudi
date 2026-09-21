"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { actionClient } from "./client";
import { getActivePropertyId } from "@/server/db/scope";
import { updateProperty } from "@/server/db/repositories/properties";
import {
  createUnit,
  updateUnit,
  deactivateUnit,
} from "@/server/db/repositories/units";
import {
  createRentVersion,
  updateRentVersion,
  deleteRentVersion,
} from "@/server/db/repositories/unit-rent-versions";
import {
  createCategory,
  updateCategory,
  deactivateCategory,
} from "@/server/db/repositories/expenses";
import { parsePaise, toNumericString } from "@/domain/money";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const MONEY_RE = /^\d+(\.\d{1,2})?$/;

// ── Property ──────────────────────────────────────────────────────────

export const updatePropertyAction = actionClient
  .inputSchema(
    z.object({
      name: z.string().trim().min(1, "Name is required"),
      timezone: z.string().trim().min(1, "Timezone is required"),
      trackingStartMonth: z.string().regex(MONTH_RE, "Invalid month format"),
      includeSelfOccupiedInTarget: z.boolean(),
      countVacantInTarget: z.boolean(),
    }),
  )
  .action(async ({ parsedInput }) => {
    const propertyId = await getActivePropertyId();
    await updateProperty(propertyId, parsedInput);
    revalidatePath("/settings");
    revalidatePath("/dashboard");
    return { ok: true as const };
  });

// ── Units ─────────────────────────────────────────────────────────────

const unitSchema = z.object({
  unitCode: z.string().trim().min(1, "Unit code is required").max(10),
  unitType: z.enum(["2BHK", "1BHK"]),
  defaultOccupancyStatus: z.enum(["SELF_OCCUPIED", "OCCUPIED", "VACANT"]),
  electricityUom: z.string().trim().default("kWh"),
  waterUom: z.string().trim().default("L"),
});

export const createUnitAction = actionClient
  .inputSchema(unitSchema)
  .action(async ({ parsedInput }) => {
    const propertyId = await getActivePropertyId();
    await createUnit(propertyId, parsedInput);
    revalidatePath("/settings");
    return { ok: true as const };
  });

export const updateUnitAction = actionClient
  .inputSchema(unitSchema.extend({ unitId: z.string().uuid() }))
  .action(async ({ parsedInput: { unitId, ...input } }) => {
    const propertyId = await getActivePropertyId();
    const updated = await updateUnit(propertyId, unitId, input);
    if (!updated) throw new Error("Unit not found");
    revalidatePath("/settings");
    return { ok: true as const };
  });

export const deactivateUnitAction = actionClient
  .inputSchema(z.object({ unitId: z.string().uuid() }))
  .action(async ({ parsedInput: { unitId } }) => {
    const propertyId = await getActivePropertyId();
    const updated = await deactivateUnit(propertyId, unitId);
    if (!updated) throw new Error("Unit not found");
    revalidatePath("/settings");
    return { ok: true as const };
  });

// ── Rent Versions ─────────────────────────────────────────────────────

const rentVersionSchema = z.object({
  unitId: z.string().uuid(),
  effectiveMonth: z.string().regex(MONTH_RE, "Invalid month"),
  expectedRent: z
    .string()
    .trim()
    .refine((v) => MONEY_RE.test(v), "Enter a valid amount"),
});

export const createRentVersionAction = actionClient
  .inputSchema(rentVersionSchema)
  .action(async ({ parsedInput }) => {
    const propertyId = await getActivePropertyId();
    await createRentVersion(propertyId, {
      ...parsedInput,
      expectedRent: toNumericString(parsePaise(parsedInput.expectedRent)),
    });
    revalidatePath("/settings");
    revalidatePath("/rent");
    return { ok: true as const };
  });

export const updateRentVersionAction = actionClient
  .inputSchema(
    rentVersionSchema
      .omit({ unitId: true })
      .extend({ versionId: z.string().uuid() }),
  )
  .action(async ({ parsedInput: { versionId, ...input } }) => {
    const propertyId = await getActivePropertyId();
    const updated = await updateRentVersion(propertyId, versionId, {
      ...input,
      expectedRent: toNumericString(parsePaise(input.expectedRent)),
    });
    if (!updated) throw new Error("Rent version not found");
    revalidatePath("/settings");
    revalidatePath("/rent");
    return { ok: true as const };
  });

export const deleteRentVersionAction = actionClient
  .inputSchema(z.object({ versionId: z.string().uuid() }))
  .action(async ({ parsedInput: { versionId } }) => {
    const propertyId = await getActivePropertyId();
    const deleted = await deleteRentVersion(propertyId, versionId);
    if (!deleted) throw new Error("Rent version not found");
    revalidatePath("/settings");
    revalidatePath("/rent");
    return { ok: true as const };
  });

// ── Expense Categories ────────────────────────────────────────────────

const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  isMaintenance: z.boolean(),
});

export const createCategoryAction = actionClient
  .inputSchema(categorySchema)
  .action(async ({ parsedInput }) => {
    const propertyId = await getActivePropertyId();
    await createCategory(propertyId, parsedInput);
    revalidatePath("/settings");
    return { ok: true as const };
  });

export const updateCategoryAction = actionClient
  .inputSchema(categorySchema.extend({ categoryId: z.string().uuid() }))
  .action(async ({ parsedInput: { categoryId, ...input } }) => {
    const propertyId = await getActivePropertyId();
    const updated = await updateCategory(propertyId, categoryId, input);
    if (!updated) throw new Error("Category not found");
    revalidatePath("/settings");
    return { ok: true as const };
  });

export const deactivateCategoryAction = actionClient
  .inputSchema(z.object({ categoryId: z.string().uuid() }))
  .action(async ({ parsedInput: { categoryId } }) => {
    const propertyId = await getActivePropertyId();
    const updated = await deactivateCategory(propertyId, categoryId);
    if (!updated) throw new Error("Category not found");
    revalidatePath("/settings");
    return { ok: true as const };
  });
