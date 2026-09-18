import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import { ReportTabs } from "@/components/reports/report-tabs";
import { MonthPicker } from "@/components/reports/month-picker";
import { YearPicker } from "@/components/reports/year-picker";
import { MonthlyStatement } from "@/components/reports/monthly-statement";
import { AnnualSummary } from "@/components/reports/annual-summary";
import { UnitPerformance } from "@/components/reports/unit-performance";
import { LoanReport } from "@/components/reports/loan-report";
import { ExpenseReport } from "@/components/reports/expense-report";
import { UtilityReport } from "@/components/reports/utility-report";
import { CsvDownloadButton } from "@/components/reports/csv-download-button";
import { monthFromParam, type SearchParams } from "@/lib/month-param";
import {
  type MonthKey,
  monthKey,
  monthRange,
  fromParts,
  toParts,
  formatMonthLong,
} from "@/domain/month";
import { parsePaise } from "@/domain/money";
import { getActiveProperty } from "@/server/db/scope";
import { listMonthForDisplay as listRentMonth } from "@/server/db/repositories/unit-month-records";
import { listForMonthRange as listRentRange } from "@/server/db/repositories/unit-month-records";
import { listMonth as listExpenseMonth } from "@/server/db/repositories/expenses";
import { listForMonthRange as listExpenseRange } from "@/server/db/repositories/expenses";
import { listMonthForDisplay as listUtilityMonth } from "@/server/db/repositories/utility-records";
import { listForMonthRange as listUtilityRange } from "@/server/db/repositories/utility-records";
import { listMonthForDisplay as listRepaymentMonth } from "@/server/db/repositories/loan-repayments";
import { listForMonthRange as listRepaymentRange } from "@/server/db/repositories/loan-repayments";
import { listLoans, listCurrentOutstandings } from "@/server/db/repositories/loans";

// ---------------------------------------------------------------------------
// Indian Financial Year helpers
// ---------------------------------------------------------------------------

function getCurrentFYYear(month: MonthKey): number {
  const { year, month: m } = toParts(month);
  return m >= 4 ? year : year - 1;
}

function fyRange(fy: number): { from: MonthKey; to: MonthKey } {
  return { from: fromParts(fy, 4), to: fromParts(fy + 1, 3) };
}

function fyLabel(fy: number): string {
  return `FY ${fy}-${String(fy + 1).slice(2)}`;
}

function buildFYOptions(
  trackingStart: MonthKey,
  currentMonth: MonthKey,
): { value: number; label: string }[] {
  const startFY = getCurrentFYYear(trackingStart);
  const endFY = getCurrentFYYear(currentMonth);
  const options: { value: number; label: string }[] = [];
  for (let fy = endFY; fy >= startFY; fy--) {
    options.push({ value: fy, label: fyLabel(fy) });
  }
  return options;
}

function buildMonthOptions(
  trackingStart: MonthKey,
  currentMonth: MonthKey,
): { value: MonthKey; label: string }[] {
  const months = monthRange(trackingStart, currentMonth);
  // Reverse so most recent is first
  return months.reverse().map((m) => ({ value: m, label: formatMonthLong(m) }));
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const tab = (params.tab as string) ?? "monthly";
  const month = monthFromParam(params.m);

  const property = await getActiveProperty();
  const propertyId = property.id;
  const trackingStart = monthKey(property.trackingStartMonth);

  const year = params.y ? Number(params.y) : getCurrentFYYear(month);
  const { from: fyFrom, to: fyTo } = fyRange(year);
  const fyMonths = monthRange(fyFrom, fyTo);

  const monthOptions = buildMonthOptions(trackingStart, month);
  const yearOptions = buildFYOptions(trackingStart, month);

  // --- Tab-specific data fetching ---
  if (tab === "monthly") {
    const [rentRows, expenseRows, utilityRows, repayments, loans] =
      await Promise.all([
        listRentMonth(propertyId, month),
        listExpenseMonth(propertyId, month),
        listUtilityMonth(propertyId, month),
        listRepaymentMonth(propertyId, month),
        listLoans(propertyId, { includeClosed: false }),
      ]);

    return (
      <>
        <PageHeader
          title="Reports"
          description="Historical analysis and CSV export"
          actions={
            <div className="flex items-center gap-2">
              <Suspense>
                <MonthPicker current={month} options={monthOptions} />
              </Suspense>
            </div>
          }
        />
        <Suspense>
          <ReportTabs activeTab={tab}>
            <MonthlyStatement
              month={month}
              rentRows={rentRows}
              expenseRows={expenseRows}
              utilityRows={utilityRows}
              repayments={repayments}
              activeLoans={loans}
            />
          </ReportTabs>
        </Suspense>
      </>
    );
  }

  if (tab === "annual") {
    const [rentRows, expenseRows, repaymentRows, loans] = await Promise.all([
      listRentRange(propertyId, fyFrom, fyTo),
      listExpenseRange(propertyId, fyFrom, fyTo),
      listRepaymentRange(propertyId, fyFrom, fyTo),
      listLoans(propertyId, { includeClosed: false }),
    ]);

    // Convert to KPI input types
    const kpiRentRows = rentRows.map((r) => ({
      month: r.month as MonthKey,
      unitId: r.unitId,
      isBillable: r.isBillable,
      expectedRentSnapshot: parsePaise(r.expectedRentSnapshot),
      paidAmount: r.paidAmount !== null ? parsePaise(r.paidAmount) : null,
    }));

    const kpiExpenseRows = expenseRows.map((r) => ({
      month: r.month as MonthKey,
      amount: parsePaise(r.amount),
      isMaintenance: r.isMaintenance,
      categoryName: r.categoryName,
    }));

    const kpiRepaymentRows = repaymentRows.map((r) => ({
      month: r.month as MonthKey,
      loanId: r.loanId,
      principalPaid: parsePaise(r.principalPaid),
      interestPaid: parsePaise(r.interestPaid),
    }));

    const kpiLoans = loans.map((l) => ({
      loanId: l.id,
      expectsMonthlyPayment: l.expectsMonthlyPayment,
    }));

    return (
      <>
        <PageHeader
          title="Reports"
          description="Historical analysis and CSV export"
          actions={
            <div className="flex items-center gap-2">
              <CsvDownloadButton
                reportType="rent"
                fromMonth={fyFrom}
                toMonth={fyTo}
                label="Rent CSV"
              />
              <CsvDownloadButton
                reportType="expenses"
                fromMonth={fyFrom}
                toMonth={fyTo}
                label="Expenses CSV"
              />
              <Suspense>
                <YearPicker current={year} options={yearOptions} />
              </Suspense>
            </div>
          }
        />
        <Suspense>
          <ReportTabs activeTab={tab}>
            <AnnualSummary
              fy={year}
              months={fyMonths}
              rentRows={kpiRentRows}
              expenseRows={kpiExpenseRows}
              repaymentRows={kpiRepaymentRows}
              loans={kpiLoans}
            />
          </ReportTabs>
        </Suspense>
      </>
    );
  }

  if (tab === "unit") {
    const rentRows = await listRentRange(propertyId, fyFrom, fyTo);
    const kpiRentRows = rentRows.map((r) => ({
      month: r.month as MonthKey,
      unitId: r.unitCode,
      isBillable: r.isBillable,
      expectedRentSnapshot: parsePaise(r.expectedRentSnapshot),
      paidAmount: r.paidAmount !== null ? parsePaise(r.paidAmount) : null,
    }));

    return (
      <>
        <PageHeader
          title="Reports"
          description="Historical analysis and CSV export"
          actions={
            <div className="flex items-center gap-2">
              <CsvDownloadButton
                reportType="rent"
                fromMonth={fyFrom}
                toMonth={fyTo}
              />
              <Suspense>
                <YearPicker current={year} options={yearOptions} />
              </Suspense>
            </div>
          }
        />
        <Suspense>
          <ReportTabs activeTab={tab}>
            <UnitPerformance
              fy={year}
              months={fyMonths}
              rentRows={kpiRentRows}
            />
          </ReportTabs>
        </Suspense>
      </>
    );
  }

  if (tab === "loan") {
    const [repaymentRows, loans, outstandings] = await Promise.all([
      listRepaymentRange(propertyId, fyFrom, fyTo),
      listLoans(propertyId, { includeClosed: false }),
      listCurrentOutstandings(propertyId, fyTo),
    ]);

    const kpiRepaymentRows = repaymentRows.map((r) => ({
      month: r.month as MonthKey,
      loanId: r.loanId,
      principalPaid: parsePaise(r.principalPaid),
      interestPaid: parsePaise(r.interestPaid),
    }));

    const loanOutstandings = outstandings.map((o) => {
      const loan = loans.find((l) => l.id === o.loanId);
      return {
        loanId: o.loanId,
        loanName: o.loanName,
        outstanding: o.outstanding,
        openingOutstanding: loan?.openingOutstanding ?? "0",
      };
    });

    return (
      <>
        <PageHeader
          title="Reports"
          description="Historical analysis and CSV export"
          actions={
            <div className="flex items-center gap-2">
              <CsvDownloadButton
                reportType="loans"
                fromMonth={fyFrom}
                toMonth={fyTo}
              />
              <Suspense>
                <YearPicker current={year} options={yearOptions} />
              </Suspense>
            </div>
          }
        />
        <Suspense>
          <ReportTabs activeTab={tab}>
            <LoanReport
              fy={year}
              repaymentRows={kpiRepaymentRows}
              loanOutstandings={loanOutstandings}
            />
          </ReportTabs>
        </Suspense>
      </>
    );
  }

  if (tab === "expense") {
    const expenseRows = await listExpenseRange(propertyId, fyFrom, fyTo);
    const kpiExpenseRows = expenseRows.map((r) => ({
      month: r.month as MonthKey,
      amount: parsePaise(r.amount),
      isMaintenance: r.isMaintenance,
      categoryName: r.categoryName,
    }));

    return (
      <>
        <PageHeader
          title="Reports"
          description="Historical analysis and CSV export"
          actions={
            <div className="flex items-center gap-2">
              <CsvDownloadButton
                reportType="expenses"
                fromMonth={fyFrom}
                toMonth={fyTo}
              />
              <Suspense>
                <YearPicker current={year} options={yearOptions} />
              </Suspense>
            </div>
          }
        />
        <Suspense>
          <ReportTabs activeTab={tab}>
            <ExpenseReport
              fy={year}
              months={fyMonths}
              expenseRows={kpiExpenseRows}
            />
          </ReportTabs>
        </Suspense>
      </>
    );
  }

  if (tab === "utility") {
    const utilityRows = await listUtilityRange(propertyId, fyFrom, fyTo);

    return (
      <>
        <PageHeader
          title="Reports"
          description="Historical analysis and CSV export"
          actions={
            <div className="flex items-center gap-2">
              <CsvDownloadButton
                reportType="utilities"
                fromMonth={fyFrom}
                toMonth={fyTo}
              />
              <Suspense>
                <YearPicker current={year} options={yearOptions} />
              </Suspense>
            </div>
          }
        />
        <Suspense>
          <ReportTabs activeTab={tab}>
            <UtilityReport
              fy={year}
              months={fyMonths}
              utilityRows={utilityRows}
            />
          </ReportTabs>
        </Suspense>
      </>
    );
  }

  // Fallback: redirect to monthly tab
  return (
    <>
      <PageHeader
        title="Reports"
        description="Historical analysis and CSV export"
      />
      <Suspense>
        <ReportTabs activeTab="monthly">
          <p className="text-sm text-muted-foreground">
            Select a report tab above.
          </p>
        </ReportTabs>
      </Suspense>
    </>
  );
}
