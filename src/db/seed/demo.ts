/**
 * Demo seed: skeleton + 12 months of plausible history across rent,
 * utilities, expenses, and loan repayments, so every dashboard chart and KPI
 * (Phase 7) has something real to render. Reset before entering real data:
 * `pnpm db:reset && pnpm db:seed` for the skeleton, or `pnpm db:reset` alone
 * for a blank database.
 *
 * Payment patterns are deterministic (a fixed formula, not Math.random()) so
 * the demo is reproducible run to run.
 */
import "../env";
import { db } from "../client";
import { unitRentVersions, loans, utilityRecords, expenses, loanRepayments } from "../schema";
import { eq } from "drizzle-orm";
import { seedSkeleton } from "./skeleton";
import {
  ensureMonthGenerated,
  listMonthForDisplay,
  updateRentPayment,
} from "@/server/db/repositories/unit-month-records";
import { monthRange, addMonths, type MonthKey } from "@/domain/month";
import { fromRupees, toNumericString } from "@/domain/money";
import { resolveCurrentMonth } from "@/lib/app-config";

const RENT_BY_UNIT: Record<string, number> = {
  U2: 15000,
  U3: 16000,
  U4: 14500,
  U5: 9500,
  U6: 9000,
};

const round2 = (n: number) => Math.round(n * 100) / 100;

async function seedRent(propertyId: string, months: MonthKey[]) {
  const unitIndexByCode = new Map(["U1", "U2", "U3", "U4", "U5", "U6"].map((c, i) => [c, i]));

  for (const [monthIndex, month] of months.entries()) {
    await ensureMonthGenerated(propertyId, month);
    const rows = await listMonthForDisplay(propertyId, month);

    for (const row of rows) {
      if (!row.isBillable) continue; // self-occupied: nothing to pay
      const expected = Number(row.expectedRentSnapshot);
      const unitIndex = unitIndexByCode.get(row.unitCode) ?? 0;
      const bucket = (monthIndex + unitIndex) % 6;

      if (bucket === 0) continue; // left UNSET on purpose — "not entered" this month

      let paidRupees = expected;
      if (bucket === 4) paidRupees = round2(expected * 0.7); // partial
      if (bucket === 5) paidRupees = round2(expected * 1.05); // overpaid (e.g. included a late fee)

      await updateRentPayment(propertyId, row.id, {
        paidAmount: toNumericString(fromRupees(paidRupees)),
        paymentDate: `${month}-05`,
        comment: bucket === 4 ? "Partial — balance promised next month" : null,
      });
    }
  }
}

async function seedUtilities(propertyId: string, months: MonthKey[], unitIds: string[]) {
  // Running meter state per unit, carried across months like a real meter.
  const elecReading = new Map(unitIds.map((id) => [id, 1200 + (Math.abs(hash(id)) % 400)]));
  const waterReading = new Map(unitIds.map((id) => [id, 300 + (Math.abs(hash(id)) % 100)]));

  for (const [i, month] of months.entries()) {
    for (const unitId of unitIds) {
      const elecPrev = elecReading.get(unitId)!;
      const elecUsage = 140 + ((i + hash(unitId)) % 60); // 140-199 kWh
      const elecCurrent = elecPrev + elecUsage;
      elecReading.set(unitId, elecCurrent);

      const waterPrev = waterReading.get(unitId)!;
      const waterUsage = 6 + ((i + hash(unitId)) % 6); // 6-11 kL
      const waterCurrent = waterPrev + waterUsage;
      waterReading.set(unitId, waterCurrent);

      await db.insert(utilityRecords).values([
        {
          propertyId,
          unitId,
          month,
          utilityType: "ELECTRICITY",
          uomSnapshot: "kWh",
          previousReading: String(elecPrev),
          currentReading: String(elecCurrent),
          billAmount: toNumericString(fromRupees(round2(elecUsage * 8.5))),
          billPaid: true,
        },
        {
          propertyId,
          unitId,
          month,
          utilityType: "WATER",
          uomSnapshot: "kL",
          previousReading: String(waterPrev),
          currentReading: String(waterCurrent),
          billAmount: toNumericString(fromRupees(round2(waterUsage * 45))),
          billPaid: true,
        },
      ]);
    }
  }
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

async function seedExpenses(
  propertyId: string,
  months: MonthKey[],
  categoriesByName: Map<string, string>,
) {
  const plans: Array<{ name: string; base: number; everyNth: number }> = [
    { name: "Common Electricity", base: 1100, everyNth: 1 },
    { name: "Water", base: 700, everyNth: 1 },
    { name: "Cleaning", base: 650, everyNth: 1 },
    { name: "Electrical Maintenance", base: 1800, everyNth: 3 },
    { name: "Plumbing", base: 1200, everyNth: 4 },
    { name: "Miscellaneous", base: 500, everyNth: 2 },
  ];

  for (const [i, month] of months.entries()) {
    for (const plan of plans) {
      if (i % plan.everyNth !== 0) continue;
      const categoryId = categoriesByName.get(plan.name);
      if (!categoryId) continue;
      const variance = 1 + (((i + plan.name.length) % 5) - 2) / 10; // +-20%
      await db.insert(expenses).values({
        propertyId,
        month,
        expenseDate: `${month}-10`,
        categoryId,
        amount: toNumericString(fromRupees(round2(plan.base * variance))),
        comment: null,
      });
    }
  }
}

async function seedLoans(propertyId: string, months: MonthKey[]) {
  const homeLoanPlans = [
    { name: "Home Loan 1", opening: 2_500_000, emi: 24000, annualRate: 9.5 },
    { name: "Home Loan 2", opening: 1_800_000, emi: 18000, annualRate: 9.0 },
    { name: "Home Loan 3", opening: 1_200_000, emi: 13000, annualRate: 9.2 },
  ];

  for (const plan of homeLoanPlans) {
    const [loan] = await db
      .select()
      .from(loans)
      .where(eq(loans.propertyId, propertyId))
      .then((rows) => rows.filter((r) => r.name === plan.name));
    if (!loan) continue;

    await db
      .update(loans)
      .set({
        openingOutstanding: toNumericString(fromRupees(plan.opening)),
        scheduledEmi: toNumericString(fromRupees(plan.emi)),
        interestRate: plan.annualRate.toFixed(3),
      })
      .where(eq(loans.id, loan.id));

    let balance = plan.opening;
    const monthlyRate = plan.annualRate / 100 / 12;

    for (const month of months) {
      const interest = round2(balance * monthlyRate);
      const principal = Math.min(round2(plan.emi - interest), balance);
      balance = round2(balance - principal);

      await db.insert(loanRepayments).values({
        propertyId,
        loanId: loan.id,
        month,
        paymentDate: `${month}-05`,
        totalPayment: toNumericString(fromRupees(round2(principal + interest))),
        principalPaid: toNumericString(fromRupees(principal)),
        interestPaid: toNumericString(fromRupees(interest)),
        outstandingAfterPayment: toNumericString(fromRupees(balance)),
      });
    }
  }

  // Gold loan: interest-only every month (PRD 22's critical scenario — Rs 0 principal).
  const [goldLoan] = (await db.select().from(loans).where(eq(loans.propertyId, propertyId))).filter(
    (r) => r.name === "Gold Loan",
  );
  if (goldLoan) {
    const opening = 300_000;
    const annualRate = 12;
    await db
      .update(loans)
      .set({
        openingOutstanding: toNumericString(fromRupees(opening)),
        interestRate: annualRate.toFixed(3),
      })
      .where(eq(loans.id, goldLoan.id));

    const monthlyInterest = round2((opening * annualRate) / 100 / 12);
    for (const month of months) {
      await db.insert(loanRepayments).values({
        propertyId,
        loanId: goldLoan.id,
        month,
        paymentDate: `${month}-05`,
        totalPayment: toNumericString(fromRupees(monthlyInterest)),
        principalPaid: "0",
        interestPaid: toNumericString(fromRupees(monthlyInterest)),
        outstandingAfterPayment: toNumericString(fromRupees(opening)),
      });
    }
  }
}

async function seedDemo() {
  const currentMonth = resolveCurrentMonth();
  const trackingStartMonth = addMonths(currentMonth, -11); // 12 months inclusive

  const skeleton = await seedSkeleton(trackingStartMonth);
  if (!skeleton) {
    console.log("Demo seed aborted (property already exists). Run `pnpm db:reset` first.");
    return;
  }

  const { property, units: seededUnits, expenseCategories: seededCategories } = skeleton;

  // Real rent versions (skeleton placeholders were Rs 0), effective from the start.
  const rentable = seededUnits.filter((u) => RENT_BY_UNIT[u.unitCode] !== undefined);
  for (const unit of rentable) {
    await db
      .update(unitRentVersions)
      .set({ expectedRent: toNumericString(fromRupees(RENT_BY_UNIT[unit.unitCode])) })
      .where(eq(unitRentVersions.unitId, unit.id));
  }

  const months = monthRange(trackingStartMonth, currentMonth);
  const categoriesByName = new Map(seededCategories.map((c) => [c.name, c.id]));

  await seedRent(property.id, months);
  await seedUtilities(
    property.id,
    months,
    seededUnits.map((u) => u.id),
  );
  await seedExpenses(property.id, months, categoriesByName);
  await seedLoans(property.id, months);

  console.log(
    `Demo seeded: ${months.length} months (${months[0]} .. ${months[months.length - 1]}).`,
  );
}

seedDemo()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
