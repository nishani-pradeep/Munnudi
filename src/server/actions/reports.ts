"use server";

import { z } from "zod";
import { actionClient } from "./client";
import { getActivePropertyId } from "@/server/db/scope";
import { buildCsv } from "@/lib/csv";
import { monthKey } from "@/domain/month";
import { listForMonthRange as listRentRange } from "@/server/db/repositories/unit-month-records";
import { listForMonthRange as listExpenseRange } from "@/server/db/repositories/expenses";
import { listForMonthRange as listUtilityRange } from "@/server/db/repositories/utility-records";
import { listForMonthRange as listRepaymentRange } from "@/server/db/repositories/loan-repayments";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export const exportCsvAction = actionClient
  .inputSchema(
    z.object({
      reportType: z.enum(["rent", "expenses", "utilities", "loans"]),
      fromMonth: z.string().regex(MONTH_RE),
      toMonth: z.string().regex(MONTH_RE),
    }),
  )
  .action(async ({ parsedInput }) => {
    const propertyId = await getActivePropertyId();
    const { reportType, fromMonth, toMonth } = parsedInput;
    const from = monthKey(fromMonth);
    const to = monthKey(toMonth);

    let csv: string;

    switch (reportType) {
      case "rent": {
        const rows = await listRentRange(propertyId, from, to);
        csv = buildCsv(
          ["Month", "Unit", "Occupancy", "Expected", "Paid", "Status"],
          rows.map((r) => [
            r.month,
            r.unitCode,
            r.occupancySnapshot,
            r.expectedRentSnapshot,
            r.paidAmount ?? "",
            r.status,
          ]),
        );
        break;
      }
      case "expenses": {
        const rows = await listExpenseRange(propertyId, from, to);
        csv = buildCsv(
          ["Month", "Category", "Amount", "Is Maintenance"],
          rows.map((r) => [r.month, r.categoryName, r.amount, r.isMaintenance]),
        );
        break;
      }
      case "utilities": {
        const rows = await listUtilityRange(propertyId, from, to);
        csv = buildCsv(
          ["Month", "Unit", "Type", "Previous", "Current", "Usage Override", "Bill"],
          rows.map((r) => [
            r.month,
            r.unitCode,
            r.utilityType,
            r.previousReading ?? "",
            r.currentReading ?? "",
            r.usageOverride ?? "",
            r.billAmount ?? "",
          ]),
        );
        break;
      }
      case "loans": {
        const rows = await listRepaymentRange(propertyId, from, to);
        csv = buildCsv(
          ["Month", "Loan ID", "Principal", "Interest"],
          rows.map((r) => [r.month, r.loanId, r.principalPaid, r.interestPaid]),
        );
        break;
      }
    }

    return {
      csv,
      filename: `munnudi-${reportType}-${fromMonth}-to-${toMonth}.csv`,
    };
  });
