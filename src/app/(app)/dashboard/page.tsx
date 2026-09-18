import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScopeToggle } from "@/components/dashboard/scope-toggle";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { MissingFlags } from "@/components/dashboard/missing-flags";
import { UnitCollectionMatrix } from "@/components/dashboard/unit-collection-matrix";
import { RentChart } from "@/components/dashboard/charts/rent-chart";
import { ExpenseCategoryChart } from "@/components/dashboard/charts/expense-category-chart";
import { LoanBalanceChart } from "@/components/dashboard/charts/loan-balance-chart";
import { PrincipalInterestChart } from "@/components/dashboard/charts/principal-interest-chart";
import { OperatingProfitChart } from "@/components/dashboard/charts/operating-profit-chart";
import { ElectricityTrendChart } from "@/components/dashboard/charts/electricity-trend-chart";
import { WaterTrendChart } from "@/components/dashboard/charts/water-trend-chart";

import { monthFromParam, type SearchParams } from "@/lib/month-param";
import { scopeFromParam } from "@/lib/scope-param";
import {
  formatMonthLong,
  monthRange,
  addMonths,
  previousMonth,
  compareMonths,
  type MonthKey,
  monthKey,
} from "@/domain/month";
import { parsePaise } from "@/domain/money";
import { getActiveProperty } from "@/server/db/scope";
import { ensureMonthGenerated, listForMonthRange as listRentRange } from "@/server/db/repositories/unit-month-records";
import { listForMonthRange as listExpenseRange } from "@/server/db/repositories/expenses";
import { listForMonthRange as listRepaymentRange } from "@/server/db/repositories/loan-repayments";
import { listLoans, listCurrentOutstandings, listLedgerForRange } from "@/server/db/repositories/loans";
import { listForMonthRange as listUtilityRange } from "@/server/db/repositories/utility-records";
import { listForMonthRange as listStatusRange } from "@/server/db/repositories/monthly-status";

import {
  computeRentalTarget,
  computeRentCollected,
  computeRentPending,
  computeCollectionRate,
  computeMaintenancePaid,
  computeOperatingProfit,
  computePrincipalRepaid,
  computeInterestPaid,
  computeOutstandingPrincipal,
  computeTotalDebtPayments,
  computeDelta,
  computeMissingDataFlags,
  buildRentChartSeries,
  buildExpenseByCategorySeries,
  buildPrincipalVsInterestSeries,
  buildOperatingProfitSeries,
  buildUnitCollectionMatrix,
  buildLoanBalanceSeries,
  buildUtilityTrendSeries,
  type RentMonthRow,
  type ExpenseMonthRow,
  type RepaymentMonthRow,
  type MonthReviewStatus,
  type LoanLedgerPoint,
  type UtilityTrendRow,
} from "@/domain/kpi";

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const month = monthFromParam(params.m);
  const scope = scopeFromParam(params.scope);
  const label = formatMonthLong(month);

  // ----- Property & configuration -----
  const property = await getActiveProperty();
  const propertyId = property.id;
  const trackingStart = property.trackingStartMonth
    ? monthKey(property.trackingStartMonth)
    : month;

  // Ensure census exists for this month
  await ensureMonthGenerated(propertyId, month);

  // ----- Determine ranges -----
  const kpiFrom: MonthKey = scope === "current" ? month : trackingStart;
  const kpiMonths = monthRange(kpiFrom, month);

  // For deltas, compute prior-month KPIs
  const priorMonth = previousMonth(month);
  const priorMonths = scope === "current" ? [priorMonth] : monthRange(trackingStart, priorMonth);

  // Charts always show trailing 12 months (or from tracking start if shorter)
  const chartFromRaw = addMonths(month, -11);
  const chartFrom = compareMonths(chartFromRaw, trackingStart) < 0 ? trackingStart : chartFromRaw;
  const chartMonths = monthRange(chartFrom, month);

  // Widest fetch range = the earliest of all ranges we need
  const earliest = [kpiFrom, chartFrom, ...(scope === "current" ? [priorMonth] : [])].reduce(
    (a, b) => (compareMonths(a, b) < 0 ? a : b),
  );

  // ----- Fetch all data in parallel -----
  const [
    rawRentRows,
    rawExpenseRows,
    rawRepaymentRows,
    activeLoans,
    outstandings,
    rawLedgerRows,
    rawUtilityRows,
    rawStatusRows,
  ] = await Promise.all([
    listRentRange(propertyId, earliest, month),
    listExpenseRange(propertyId, earliest, month),
    listRepaymentRange(propertyId, earliest, month),
    listLoans(propertyId, { includeClosed: false }),
    listCurrentOutstandings(propertyId, month),
    listLedgerForRange(propertyId, chartFrom, month),
    listUtilityRange(propertyId, chartFrom, month),
    listStatusRange(propertyId, earliest, month),
  ]);

  // ----- Map to domain types -----
  const rentKpiRows: RentMonthRow[] = rawRentRows.map((r) => ({
    month: monthKey(r.month),
    unitId: r.unitId,
    isBillable: r.isBillable,
    expectedRentSnapshot: parsePaise(r.expectedRentSnapshot),
    paidAmount: r.paidAmount !== null ? parsePaise(r.paidAmount) : null,
  }));

  const expenseKpiRows: ExpenseMonthRow[] = rawExpenseRows.map((r) => ({
    month: monthKey(r.month),
    amount: parsePaise(r.amount),
    isMaintenance: r.isMaintenance,
    categoryName: r.categoryName,
  }));

  const repaymentKpiRows: RepaymentMonthRow[] = rawRepaymentRows.map((r) => ({
    month: monthKey(r.month),
    loanId: r.loanId,
    principalPaid: parsePaise(r.principalPaid),
    interestPaid: parsePaise(r.interestPaid),
  }));

  const reviewStatuses: MonthReviewStatus[] = rawStatusRows.map((r) => ({
    month: monthKey(r.month),
    expensesReviewedAt: r.expensesReviewedAt,
    loansReviewedAt: r.loansReviewedAt,
  }));

  const loanList = activeLoans.map((l) => ({
    loanId: l.id,
    name: l.name,
    expectsMonthlyPayment: l.expectsMonthlyPayment,
  }));

  const ledgerPoints: LoanLedgerPoint[] = rawLedgerRows
    .filter((r) => r.month && r.loanId && r.effectiveOutstanding)
    .map((r) => ({
      month: monthKey(r.month!),
      loanId: r.loanId!,
      loanName: r.loanName,
      outstanding: parsePaise(r.effectiveOutstanding!),
    }));

  const utilityTrendRows: UtilityTrendRow[] = rawUtilityRows.map((r) => ({
    month: monthKey(r.month),
    unitId: r.unitId,
    unitCode: r.unitCode,
    utilityType: r.utilityType,
    previousReading: r.previousReading,
    currentReading: r.currentReading,
    usageOverride: r.usageOverride,
  }));

  // ----- Compute KPIs -----
  const rentalTarget = computeRentalTarget(rentKpiRows, kpiMonths, scope);
  const rentCollected = computeRentCollected(rentKpiRows, kpiMonths, scope);
  const rentPending = computeRentPending(rentKpiRows, kpiMonths, scope);
  const collectionRate = computeCollectionRate(rentKpiRows, kpiMonths, scope);
  const maintenancePaid = computeMaintenancePaid(expenseKpiRows, reviewStatuses, kpiMonths, scope);
  const operatingProfit = computeOperatingProfit(rentCollected, maintenancePaid);
  const principalRepaid = computePrincipalRepaid(repaymentKpiRows, loanList, kpiMonths, scope);
  const interestPaid = computeInterestPaid(repaymentKpiRows, loanList, kpiMonths, scope);
  const outstanding = computeOutstandingPrincipal(outstandings);
  const totalDebt = computeTotalDebtPayments(principalRepaid, interestPaid);

  // ----- Compute deltas (current vs prior month) -----
  const priorRentalTarget = computeRentalTarget(rentKpiRows, priorMonths, "current");
  const priorRentCollected = computeRentCollected(rentKpiRows, priorMonths, "current");
  const priorRentPending = computeRentPending(rentKpiRows, priorMonths, "current");
  const priorMaintenance = computeMaintenancePaid(expenseKpiRows, reviewStatuses, priorMonths, "current");
  const priorPrincipal = computePrincipalRepaid(repaymentKpiRows, loanList, priorMonths, "current");
  const priorInterest = computeInterestPaid(repaymentKpiRows, loanList, priorMonths, "current");

  const deltaTarget = scope === "current" ? computeDelta(rentalTarget, priorRentalTarget) : null;
  const deltaCollected = scope === "current" ? computeDelta(rentCollected, priorRentCollected) : null;
  const deltaPending = scope === "current" ? computeDelta(rentPending, priorRentPending) : null;
  const deltaMaintenance = scope === "current" ? computeDelta(maintenancePaid, priorMaintenance) : null;
  const deltaPrincipal = scope === "current" ? computeDelta(principalRepaid, priorPrincipal) : null;
  const deltaInterest = scope === "current" ? computeDelta(interestPaid, priorInterest) : null;

  // ----- Missing flags (always for current month) -----
  const flags = computeMissingDataFlags(rentKpiRows, repaymentKpiRows, loanList, month);

  // ----- Chart data -----
  const rentChartData = buildRentChartSeries(rentKpiRows, chartMonths);
  const expenseChartData = buildExpenseByCategorySeries(expenseKpiRows, chartMonths);
  const expenseCategories = Array.from(new Set(expenseKpiRows.map((e) => e.categoryName)));
  const principalInterestData = buildPrincipalVsInterestSeries(repaymentKpiRows, chartMonths);
  const operatingProfitData = buildOperatingProfitSeries(rentKpiRows, expenseKpiRows, chartMonths);
  const loanBalanceData = buildLoanBalanceSeries(ledgerPoints, chartMonths);
  const loanNames = Array.from(new Set(ledgerPoints.map((l) => l.loanName)));

  const electricityData = buildUtilityTrendSeries(utilityTrendRows, chartMonths, "ELECTRICITY");
  const waterData = buildUtilityTrendSeries(utilityTrendRows, chartMonths, "WATER");
  const elecUnitCodes = Array.from(
    new Set(utilityTrendRows.filter((r) => r.utilityType === "ELECTRICITY").map((r) => r.unitCode)),
  );
  const waterUnitCodes = Array.from(
    new Set(utilityTrendRows.filter((r) => r.utilityType === "WATER").map((r) => r.unitCode)),
  );

  // Unit collection matrix (chart months)
  const matrixData = buildUnitCollectionMatrix(rentKpiRows, chartMonths);
  // Enrich unit codes from raw data
  const unitCodeMap = new Map(rawRentRows.map((r) => [r.unitId, r.unitCode]));
  const enrichedMatrix = matrixData.map((row) => ({
    ...row,
    unitCode: unitCodeMap.get(row.unitId) ?? row.unitId,
  }));

  return (
    <>
      <PageHeader title="Dashboard" description={`Portfolio health and trends · ${label}`} />

      <Suspense>
        <ScopeToggle currentScope={scope} />
      </Suspense>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        <KpiCard
          title="Rental Target"
          format="currency"
          measure={rentalTarget}
          delta={deltaTarget ?? undefined}
          drilldownHref={`/rent?m=${month}`}
          scope={scope}
        />
        <KpiCard
          title="Rent Collected"
          format="currency"
          measure={rentCollected}
          delta={deltaCollected ?? undefined}
          drilldownHref={`/rent?m=${month}`}
          scope={scope}
        />
        <KpiCard
          title="Rent Pending"
          format="currency"
          measure={rentPending}
          delta={deltaPending ?? undefined}
          drilldownHref={`/rent?m=${month}`}
          scope={scope}
        />
        <KpiCard
          title="Collection Rate"
          format="percent"
          measure={collectionRate}
          scope={scope}
        />
        <KpiCard
          title="Maintenance Paid"
          format="currency"
          measure={maintenancePaid}
          delta={deltaMaintenance ?? undefined}
          drilldownHref={`/expenses?m=${month}`}
          scope={scope}
        />
        <KpiCard
          title="Op. Profit"
          format="currency"
          measure={operatingProfit}
          scope={scope}
        />
        <KpiCard
          title="Principal Repaid"
          format="currency"
          measure={principalRepaid}
          delta={deltaPrincipal ?? undefined}
          scope={scope}
        />
        <KpiCard
          title="Interest Paid"
          format="currency"
          measure={interestPaid}
          delta={deltaInterest ?? undefined}
          scope={scope}
        />
        <KpiCard
          title="Outstanding"
          format="stock"
          measure={outstanding}
          scope={scope}
        />
        <KpiCard
          title="Total Debt"
          format="currency"
          measure={totalDebt}
          scope={scope}
        />
      </div>

      {/* Missing data flags */}
      <MissingFlags flags={flags} />

      {/* Chart grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Rent: Expected vs Collected</CardTitle>
          </CardHeader>
          <CardContent>
            <RentChart data={rentChartData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expenses by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpenseCategoryChart data={expenseChartData} categories={expenseCategories} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Operating Profit</CardTitle>
          </CardHeader>
          <CardContent>
            <OperatingProfitChart data={operatingProfitData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Principal vs Interest</CardTitle>
          </CardHeader>
          <CardContent>
            <PrincipalInterestChart data={principalInterestData} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Loan Balance Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <LoanBalanceChart data={loanBalanceData} loanNames={loanNames} />
          </CardContent>
        </Card>
      </div>

      {/* Unit Collection Matrix */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Unit Collection Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <UnitCollectionMatrix matrix={enrichedMatrix} months={chartMonths} />
        </CardContent>
      </Card>

      {/* Utility trend charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Electricity Usage Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ElectricityTrendChart data={electricityData} unitCodes={elecUnitCodes} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Water Usage Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <WaterTrendChart data={waterData} unitCodes={waterUnitCodes} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
