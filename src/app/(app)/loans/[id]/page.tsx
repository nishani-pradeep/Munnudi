import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { monthFromParam, type SearchParams } from "@/lib/month-param";
import { parsePaise, sum, formatInr, formatInrWhole, type Paise } from "@/domain/money";
import { generateAmortizationSchedule } from "@/domain/loans";
import { getActivePropertyId } from "@/server/db/scope";
import { resolveAmortizationAnchor } from "@/server/db/repositories/loans";
import {
  listForLoan,
  listDeletedForLoan,
  getLoanLedger,
} from "@/server/db/repositories/loan-repayments";
import { AmortizationTable } from "@/components/loans/amortization-table";
import { LoanProgress } from "@/components/loans/loan-progress";
import { LoanDialog } from "@/components/loans/loan-dialog";
import { PrepaymentDialog } from "@/components/loans/prepayment-dialog";
import { CloseLoanButton } from "@/components/loans/close-loan-button";
import { DeleteRepaymentButton } from "@/components/loans/delete-repayment-button";
import { RestoreRepaymentButton } from "@/components/loans/restore-repayment-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { db } from "@/db/client";
import { loans } from "@/db/schema";
import { and, eq } from "drizzle-orm";

async function getLoan(propertyId: string, loanId: string) {
  const [row] = await db
    .select()
    .from(loans)
    .where(and(eq(loans.id, loanId), eq(loans.propertyId, propertyId)))
    .limit(1);
  return row ?? null;
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { id: loanId } = await params;
  const sp = await searchParams;
  const month = monthFromParam(sp.m);
  const propertyId = await getActivePropertyId();

  const loan = await getLoan(propertyId, loanId);
  if (!loan) notFound();

  const [repayments, deletedRepayments, ledger] = await Promise.all([
    listForLoan(propertyId, loanId),
    listDeletedForLoan(propertyId, loanId),
    getLoanLedger(propertyId, loanId),
  ]);

  // Totals
  const totalPrincipal = sum(repayments.map((r) => parsePaise(r.principalPaid)));
  const totalInterest = sum(repayments.map((r) => parsePaise(r.interestPaid)));
  const totalRepaid = sum(repayments.map((r) => parsePaise(r.totalPayment)));

  // Outstanding
  const lastLedger = ledger[ledger.length - 1];
  const currentOutstanding = lastLedger?.effectiveOutstanding
    ? parsePaise(lastLedger.effectiveOutstanding)
    : parsePaise(loan.openingOutstanding);

  // Schedule
  let schedule: Awaited<ReturnType<typeof generateAmortizationSchedule>> = [];
  let scheduleStartMonth = month;
  const paidMonths = new Map<string, { principal: Paise; interest: Paise; total: Paise }>();

  if (loan.interestRate && loan.remainingTenureMonths) {
    const anchor = await resolveAmortizationAnchor(loan, month);
    if (anchor.remainingTenureMonths && anchor.remainingTenureMonths > 0) {
      schedule = generateAmortizationSchedule(
        anchor.outstanding,
        Number(loan.interestRate),
        anchor.remainingTenureMonths,
      );
      scheduleStartMonth = month;
    }
  }

  for (const r of repayments) {
    paidMonths.set(r.month, {
      principal: parsePaise(r.principalPaid),
      interest: parsePaise(r.interestPaid),
      total: parsePaise(r.totalPayment),
    });
  }

  // Original principal for progress
  const origPrincipal = loan.originalPrincipal
    ? parsePaise(loan.originalPrincipal)
    : parsePaise(loan.openingOutstanding);

  const outstandingLabel = formatInrWhole(currentOutstanding);

  return (
    <>
      <div className="mb-4">
        <Link
          href="/loans"
          className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Loans
        </Link>
      </div>

      <PageHeader
        title={loan.name}
        description={`${loan.lender ?? ""}${loan.interestRate ? ` · ${loan.interestRate}%` : ""}`}
        actions={
          <div className="flex gap-2">
            {loan.active && (
              <PrepaymentDialog
                loanId={loan.id}
                loanName={loan.name}
                currentMonth={month}
                currentOutstanding={(currentOutstanding as number) / 100}
                interestRate={loan.interestRate ? Number(loan.interestRate) : null}
                remainingTenure={loan.remainingTenureMonths}
                trigger={
                  <Button variant="outline" size="sm">
                    Prepay
                  </Button>
                }
              />
            )}
            <LoanDialog
              existing={{
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
              }}
              trigger={
                <Button variant="outline" size="sm">
                  Edit
                </Button>
              }
            />
            {loan.active && (
              <CloseLoanButton
                loanId={loan.id}
                loanName={loan.name}
                month={month}
                outstandingLabel={outstandingLabel}
              />
            )}
          </div>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Outstanding
            </p>
            <p className="text-2xl font-semibold tabular-nums mt-1">{outstandingLabel}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Principal Repaid
            </p>
            <p className="text-2xl font-semibold tabular-nums mt-1">
              {formatInrWhole(totalPrincipal)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Interest Paid
            </p>
            <p className="text-2xl font-semibold tabular-nums mt-1">
              {formatInrWhole(totalInterest)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Progress
            </p>
            <div className="mt-2">
              <LoanProgress
                originalPrincipal={origPrincipal as number}
                totalRepaid={totalRepaid as number}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="schedule">
        <TabsList variant="line">
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="schedule" className="mt-4">
          <AmortizationTable
            schedule={schedule}
            startMonth={scheduleStartMonth}
            paidMonths={paidMonths}
          />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          {repayments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead className="text-right">Interest</TableHead>
                  <TableHead>Comment</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repayments.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.month}</TableCell>
                    <TableCell>{r.paymentDate}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatInr(parsePaise(r.totalPayment))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatInr(parsePaise(r.principalPaid))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatInr(parsePaise(r.interestPaid))}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {r.comment ?? ""}
                    </TableCell>
                    <TableCell className="text-right">
                      <DeleteRepaymentButton repaymentId={r.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground py-4">No repayments recorded yet.</p>
          )}

          {deletedRepayments.length > 0 && (
            <div className="mt-6 space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Recently deleted</p>
              {deletedRepayments.map((d) => (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <span>
                    {d.month} &middot; {formatInrWhole(parsePaise(d.totalPayment))}
                  </span>
                  <RestoreRepaymentButton repaymentId={d.id} />
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
