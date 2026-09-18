import { Landmark, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { monthFromParam, type SearchParams } from "@/lib/month-param";
import { formatMonthLong } from "@/domain/month";
import { parsePaise, sum, formatInrWhole, toNumericString, paise } from "@/domain/money";
import {
  generateAmortizationSchedule,
  nextExpectedRepayment,
} from "@/domain/loans";
import { getActivePropertyId } from "@/server/db/scope";
import { listLoans, listDeletedLoans, resolveAmortizationAnchor, type LoanRow } from "@/server/db/repositories/loans";
import {
  listForMonth,
  listForLoan,
  listDeletedForMonth,
  listCurrentOutstandings,
  getLoanLedger,
} from "@/server/db/repositories/loan-repayments";
import { LoanDialog } from "@/components/loans/loan-dialog";
import { LoanCard, type LoanCardProps } from "@/components/loans/loan-card";
import { LoanKpiCard } from "@/components/loans/loan-kpi-card";
import { ReopenLoanButton } from "@/components/loans/reopen-loan-button";
import { RestoreLoanButton } from "@/components/loans/restore-loan-button";
import { RestoreRepaymentButton } from "@/components/loans/restore-repayment-button";
import type { MonthKey } from "@/domain/month";

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const month = monthFromParam(params.m);
  const label = formatMonthLong(month);
  const propertyId = await getActivePropertyId();

  const [allLoans, monthRepayments, deletedRepayments, outstandings, deletedLoans] = await Promise.all([
    listLoans(propertyId, { includeClosed: true }),
    listForMonth(propertyId, month),
    listDeletedForMonth(propertyId, month),
    listCurrentOutstandings(propertyId, month),
    listDeletedLoans(propertyId),
  ]);

  const activeLoans = allLoans.filter((l) => l.active);
  const closedLoans = allLoans.filter((l) => !l.active);

  if (allLoans.length === 0) {
    return (
      <>
        <PageHeader
          title="Loans"
          description={`Loan masters and monthly repayments · ${label}`}
          actions={
            <LoanDialog
              trigger={
                <Button size="sm">
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add Loan
                </Button>
              }
            />
          }
        />
        <EmptyState
          icon={Landmark}
          title="No loans yet"
          nextStep="Add a loan to start tracking repayments and schedules."
        >
          <LoanDialog
            trigger={
              <Button>
                <Plus className="mr-1.5 h-4 w-4" />
                Add your first loan
              </Button>
            }
          />
        </EmptyState>
      </>
    );
  }

  // Build per-loan detail data
  const outstandingMap = new Map(outstandings.map((o) => [o.loanId, o.outstanding]));
  const repaymentByLoan = new Map(monthRepayments.map((r) => [r.loanId, r]));

  const loanDetails: LoanCardProps[] = await Promise.all(
    activeLoans.map(async (loan) => {
      const [allRepayments, ledger] = await Promise.all([
        listForLoan(propertyId, loan.id),
        getLoanLedger(propertyId, loan.id),
      ]);

      // Schedule
      let schedule: { monthIndex: number; emi: number; interest: number; principal: number; closingBalance: number }[] = [];
      let scheduleStartMonth = month as string;

      if (loan.interestRate && loan.remainingTenureMonths) {
        const anchor = await resolveAmortizationAnchor(loan, month);
        if (anchor.remainingTenureMonths && anchor.remainingTenureMonths > 0) {
          const steps = generateAmortizationSchedule(
            anchor.outstanding,
            Number(loan.interestRate),
            anchor.remainingTenureMonths,
          );
          schedule = steps.map((s) => ({
            monthIndex: s.monthIndex,
            emi: s.emi as number,
            interest: s.interest as number,
            principal: s.principal as number,
            closingBalance: s.closingBalance as number,
          }));
          scheduleStartMonth = month;
        }
      }

      // Separate prepayments from regular EMIs
      const prepayments = allRepayments.filter(
        (r) =>
          (r.principalPaid === r.totalPayment && r.interestPaid === "0.00") ||
          (r.comment && r.comment.toLowerCase().includes("prepayment")),
      );
      const prepaymentTotal = sum(prepayments.map((r) => parsePaise(r.totalPayment)));

      // Outstanding
      const outsStr = outstandingMap.get(loan.id) ?? loan.openingOutstanding;
      const currentOutstanding = parseMoney(outsStr);

      // Total repaid
      const totalRepaid = sum(allRepayments.map((r) => parsePaise(r.totalPayment)));

      // Month repayment
      const monthRepayment = repaymentByLoan.get(loan.id) ?? null;

      // Prefill from schedule
      const prefill = await computePrefill(loan, month);

      // Serialize
      return {
        loan: serializeLoan(loan),
        currentOutstanding,
        monthRepayment: monthRepayment ? serializeRepayment(monthRepayment) : null,
        schedule,
        scheduleStartMonth,
        allRepayments: allRepayments.map(serializeRepayment),
        prepayments: prepayments.map(serializeRepayment),
        prepaymentCount: prepayments.length,
        prepaymentTotal: prepaymentTotal as number,
        ledger: ledger.map((l) => ({
          month: l.month,
          effectiveOutstanding: l.effectiveOutstanding,
          drift: l.drift,
        })),
        month: month as string,
        totalRepaid: totalRepaid as number,
        prefill: prefill
          ? {
              totalPayment: prefill.totalPayment,
              principalPaid: prefill.principalPaid,
              interestPaid: prefill.interestPaid,
            }
          : null,
      };
    }),
  );

  // KPI totals
  const totalOutstanding = sum(
    outstandings.map((o) => parsePaise(o.outstanding)),
  );
  const allActiveRepayments = loanDetails.flatMap((d) => d.allRepayments);
  const totalRepaid = sum(
    allActiveRepayments.map((r) => paise(parseMoney(r.totalPayment))),
  );
  const totalInterest = sum(
    allActiveRepayments.map((r) => paise(parseMoney(r.interestPaid))),
  );

  // Deleted repayments with loan names
  const deletedWithNames = deletedRepayments.map((d) => ({
    ...d,
    loanName: allLoans.find((l) => l.id === d.loanId)?.name ?? "Unknown loan",
  }));

  return (
    <>
      <PageHeader
        title="Loans"
        description={`Loan masters and monthly repayments · ${label}`}
        actions={
          <LoanDialog
            trigger={
              <Button size="sm">
                <Plus className="mr-1.5 h-4 w-4" />
                Add Loan
              </Button>
            }
          />
        }
      />

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <LoanKpiCard title="Total Outstanding" value={formatInrWhole(totalOutstanding)} />
        <LoanKpiCard title="Total Repaid" value={formatInrWhole(totalRepaid)} />
        <LoanKpiCard title="Total Interest" value={formatInrWhole(totalInterest)} />
        <LoanKpiCard
          title="Active Loans"
          value={`${activeLoans.length}`}
          subtitle={closedLoans.length > 0 ? `${closedLoans.length} closed` : undefined}
        />
      </div>

      {/* Active Loan Cards */}
      {loanDetails.map((detail) => (
        <LoanCard key={detail.loan.id} {...detail} />
      ))}

      {/* Closed Loans */}
      {closedLoans.length > 0 && (
        <ClosedLoansSection loans={closedLoans} />
      )}

      {/* Recently Deleted Repayments */}
      {deletedWithNames.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recently deleted repayments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {deletedWithNames.map((d) => (
              <div key={d.id} className="flex items-center justify-between text-sm">
                <span>
                  {d.loanName} &middot; {d.month} &middot;{" "}
                  {formatInrWhole(paise(parseMoney(d.totalPayment)))}
                </span>
                <RestoreRepaymentButton repaymentId={d.id} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recently Deleted Loans */}
      {deletedLoans.length > 0 && (
        <Card className="mt-6 border-dashed">
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Recently deleted loans
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {deletedLoans.map((loan) => (
              <div key={loan.id} className="flex items-center justify-between text-sm">
                <span className="font-medium">{loan.name}</span>
                <RestoreLoanButton loanId={loan.id} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </>
  );
}

/* ─── Closed Loans Section ─── */

function ClosedLoansSection({ loans }: { loans: LoanRow[] }) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Closed Loans ({loans.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loans.map((loan) => (
          <div key={loan.id} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">{loan.name}</span>
              {loan.lender && (
                <span className="text-muted-foreground">{loan.lender}</span>
              )}
              {loan.closedMonth && (
                <span className="text-xs text-muted-foreground">
                  Closed {loan.closedMonth}
                </span>
              )}
            </div>
            <ReopenLoanButton loanId={loan.id} />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/* ─── Helpers ─── */

type RepaymentPrefill = {
  totalPayment: string;
  principalPaid: string;
  interestPaid: string;
};

async function computePrefill(
  loan: LoanRow,
  month: MonthKey,
): Promise<RepaymentPrefill | undefined> {
  if (!loan.expectsMonthlyPayment || !loan.interestRate || !loan.remainingTenureMonths) {
    return undefined;
  }
  const anchor = await resolveAmortizationAnchor(loan, month);
  if (!anchor.remainingTenureMonths || anchor.remainingTenureMonths <= 0) return undefined;
  const step = nextExpectedRepayment(
    anchor.outstanding,
    Number(loan.interestRate),
    anchor.remainingTenureMonths,
  );
  if (!step) return undefined;
  return {
    totalPayment: toNumericString(step.emi),
    principalPaid: toNumericString(step.principal),
    interestPaid: toNumericString(step.interest),
  };
}

/** Parse numeric string to paise integer (client-safe, no branded type). */
function parseMoney(numericString: string): number {
  const raw = numericString.trim();
  const m = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(raw);
  if (!m) return 0;
  const [, sign, whole, frac = ""] = m;
  const hundredths = frac.padEnd(2, "0");
  const magnitude = Number(`${whole}${hundredths}`);
  return sign === "-" ? -magnitude : magnitude;
}

function serializeLoan(loan: LoanRow) {
  return {
    id: loan.id,
    name: loan.name,
    loanType: loan.loanType,
    lender: loan.lender,
    originalPrincipal: loan.originalPrincipal,
    openingOutstanding: loan.openingOutstanding,
    openingAsOfMonth: loan.openingAsOfMonth,
    interestRate: loan.interestRate,
    scheduledEmi: loan.scheduledEmi,
    remainingTenureMonths: loan.remainingTenureMonths,
    expectsMonthlyPayment: loan.expectsMonthlyPayment,
    active: loan.active,
    closedMonth: loan.closedMonth,
  };
}

function serializeRepayment(r: Awaited<ReturnType<typeof listForMonth>>[number]) {
  return {
    id: r.id,
    loanId: r.loanId,
    month: r.month,
    paymentDate: r.paymentDate,
    totalPayment: r.totalPayment,
    principalPaid: r.principalPaid,
    interestPaid: r.interestPaid,
    otherCharges: r.otherCharges,
    outstandingAfterPayment: r.outstandingAfterPayment,
    principalAdjustment: r.principalAdjustment,
    adjustmentReason: r.adjustmentReason,
    comment: r.comment,
  };
}
