"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Pencil,
  Plus,
  Banknote,
  XCircle,
  Trash2,
  ExternalLink,
  MoreHorizontal,
  ChevronDown,
  ChevronUp,
  Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { LoanDialog, type ExistingLoan } from "@/components/loans/loan-dialog";
import { RepaymentDialog, type ExistingRepayment, type Prefill } from "@/components/loans/repayment-dialog";
import { PrepaymentDialog } from "@/components/loans/prepayment-dialog";
import { CloseLoanButton } from "@/components/loans/close-loan-button";
import { DeleteLoanButton } from "@/components/loans/delete-loan-button";
import { DeleteRepaymentButton } from "@/components/loans/delete-repayment-button";
import { formatInr, formatInrWhole, paise } from "@/domain/money";

/* ─── Serializable types (no branded types) ─── */

type SerializedRepayment = {
  id: string;
  loanId: string;
  month: string;
  paymentDate: string;
  totalPayment: string;
  principalPaid: string;
  interestPaid: string;
  otherCharges: string;
  outstandingAfterPayment: string | null;
  principalAdjustment: string;
  adjustmentReason: string | null;
  comment: string | null;
};

type SerializedScheduleStep = {
  monthIndex: number;
  emi: number;
  interest: number;
  principal: number;
  closingBalance: number;
};

type SerializedLedgerRow = {
  month: string | null;
  effectiveOutstanding: string | null;
  drift: string | null;
};

type SerializedLoan = {
  id: string;
  name: string;
  loanType: string;
  lender: string | null;
  originalPrincipal: string | null;
  openingOutstanding: string;
  openingAsOfMonth: string;
  interestRate: string | null;
  scheduledEmi: string | null;
  remainingTenureMonths: number | null;
  expectsMonthlyPayment: boolean;
  active: boolean;
  closedMonth: string | null;
};

export type LoanCardProps = {
  loan: SerializedLoan;
  currentOutstanding: number;
  monthRepayment: SerializedRepayment | null;
  schedule: SerializedScheduleStep[];
  scheduleStartMonth: string;
  allRepayments: SerializedRepayment[];
  prepayments: SerializedRepayment[];
  prepaymentCount: number;
  prepaymentTotal: number;
  ledger: SerializedLedgerRow[];
  month: string;
  totalRepaid: number;
  prefill: Prefill | null;
};

const LOAN_TYPE_LABEL: Record<string, string> = {
  HOME_LOAN: "Home",
  GOLD_LOAN: "Gold",
  OTHER: "Other",
};

function formatRate(rate: string | null): string {
  if (!rate) return "";
  return `${rate}%`;
}

export function LoanCard({
  loan,
  currentOutstanding,
  monthRepayment,
  schedule,
  scheduleStartMonth,
  allRepayments,
  prepayments,
  prepaymentCount,
  prepaymentTotal,
  ledger,
  month,
  totalRepaid,
  prefill,
}: LoanCardProps) {
  const [expanded, setExpanded] = useState(false);

  const originalPrincipal = loan.originalPrincipal
    ? parseMoney(loan.originalPrincipal)
    : currentOutstanding;
  const progressPercent =
    originalPrincipal > 0
      ? Math.min(100, Math.round((totalRepaid / originalPrincipal) * 100))
      : 0;

  // Month status
  const monthLabel = formatMonthShort(month);
  const hasPaid = !!monthRepayment;
  const paidAmount = monthRepayment ? parseMoney(monthRepayment.totalPayment) : 0;

  // EMI
  const emiLabel = loan.scheduledEmi
    ? formatInrWhole(paise(parseMoney(loan.scheduledEmi)))
    : schedule.length > 0
      ? formatInrWhole(paise(schedule[0].emi))
      : null;

  // Build existing loan for edit dialog
  const existingLoan: ExistingLoan = {
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
  };

  // Build existing repayment for edit
  const existingRepayment: ExistingRepayment | undefined = monthRepayment
    ? {
        paymentDate: monthRepayment.paymentDate,
        totalPayment: monthRepayment.totalPayment,
        principalPaid: monthRepayment.principalPaid,
        interestPaid: monthRepayment.interestPaid,
        otherCharges: monthRepayment.otherCharges,
        outstandingAfterPayment: monthRepayment.outstandingAfterPayment,
        principalAdjustment: monthRepayment.principalAdjustment,
        adjustmentReason: monthRepayment.adjustmentReason,
        comment: monthRepayment.comment,
      }
    : undefined;

  // Build drift map from ledger
  const driftByMonth = new Map<string, string | null>();
  for (const row of ledger) {
    if (row.month) driftByMonth.set(row.month, row.drift);
  }

  // Schedule remaining info
  const remainingEmis = schedule.length;
  const totalInterestInSchedule = schedule.reduce((s, step) => s + step.interest, 0);
  const lastStep = schedule[schedule.length - 1];
  const loanFreeMonth =
    lastStep && scheduleStartMonth
      ? formatMonthLong(addMonthsString(scheduleStartMonth, lastStep.monthIndex))
      : null;

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-base">{loan.name}</CardTitle>
            <Badge variant="secondary" className="text-xs">
              {LOAN_TYPE_LABEL[loan.loanType] ?? loan.loanType}
            </Badge>
            {loan.lender && (
              <span className="text-sm text-muted-foreground">{loan.lender}</span>
            )}
            {loan.interestRate && (
              <span className="text-sm text-muted-foreground">
                {formatRate(loan.interestRate)}
              </span>
            )}
          </div>
          <LoanCardMenu
            loan={loan}
            existingLoan={existingLoan}
            monthRepayment={monthRepayment}
            existingRepayment={existingRepayment}
            currentOutstanding={currentOutstanding}
            month={month}
            prefill={prefill}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Row 1: Key metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className="font-semibold tabular-nums">
              {formatInrWhole(paise(currentOutstanding))}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">EMI</p>
            <p className="font-semibold tabular-nums">{emiLabel ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{monthLabel} Status</p>
            {hasPaid ? (
              <div className="flex items-center gap-1">
                <Check className="h-3.5 w-3.5 text-green-600" />
                <span className="font-medium text-green-700 dark:text-green-400 tabular-nums">
                  {formatInrWhole(paise(paidAmount))}
                </span>
              </div>
            ) : (
              <span className="text-muted-foreground">Pending</span>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Progress</p>
            <div className="mt-1">
              <div className="flex items-center gap-2">
                <Progress value={progressPercent} className="h-2 flex-1" />
                <span className="text-xs tabular-nums">{progressPercent}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Prepayment summary + expand toggle */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {prepaymentCount > 0
              ? `Prepayments: ${prepaymentCount} made · ${formatInrWhole(paise(prepaymentTotal))} total`
              : "No prepayments"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="gap-1"
          >
            {expanded ? (
              <>
                Hide <ChevronUp className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Details <ChevronDown className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>

        {/* Expanded section */}
        {expanded && (
          <>
            <Separator />
            <Tabs defaultValue="schedule" className="w-full">
              <TabsList variant="line">
                <TabsTrigger value="schedule">Schedule</TabsTrigger>
                <TabsTrigger value="payments">Payments</TabsTrigger>
                <TabsTrigger value="prepayments">Prepayments</TabsTrigger>
              </TabsList>

              {/* Schedule Tab */}
              <TabsContent value="schedule" className="mt-4">
                {schedule.length > 0 ? (
                  <>
                    <div className="text-sm text-muted-foreground mb-3 flex flex-wrap gap-x-4 gap-y-1">
                      <span>{remainingEmis} EMIs remaining</span>
                      <span>
                        Total interest: {formatInrWhole(paise(totalInterestInSchedule))}
                      </span>
                      {loanFreeMonth && <span>Loan-free by: {loanFreeMonth}</span>}
                    </div>
                    <div className="overflow-x-auto max-h-80 overflow-y-auto">
                      <ScheduleTable
                        schedule={schedule}
                        startMonth={scheduleStartMonth}
                        allRepayments={allRepayments}
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground py-4">
                    Add interest rate and tenure to see the schedule.
                  </p>
                )}
              </TabsContent>

              {/* Payments Tab */}
              <TabsContent value="payments" className="mt-4">
                {allRepayments.length > 0 ? (
                  <div className="overflow-x-auto">
                    <PaymentsTable
                      repayments={allRepayments}
                      driftByMonth={driftByMonth}
                      loanId={loan.id}
                      loanName={loan.name}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4">
                    No repayments recorded yet.
                  </p>
                )}
              </TabsContent>

              {/* Prepayments Tab */}
              <TabsContent value="prepayments" className="mt-4">
                {prepayments.length > 0 ? (
                  <>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="secondary">
                        {prepaymentCount} prepayments
                      </Badge>
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {formatInrWhole(paise(prepaymentTotal))} total
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <PrepaymentTable prepayments={prepayments} ledger={ledger} />
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground py-4">
                    No prepayments recorded. Use the menu to record one.
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Sub-components ─── */

function LoanCardMenu({
  loan,
  existingLoan,
  monthRepayment,
  existingRepayment,
  currentOutstanding,
  month,
  prefill,
}: {
  loan: LoanCardProps["loan"];
  existingLoan: ExistingLoan;
  monthRepayment: SerializedRepayment | null;
  existingRepayment: ExistingRepayment | undefined;
  currentOutstanding: number;
  month: string;
  prefill: Prefill | null;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <LoanDialog
          existing={existingLoan}
          trigger={
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit loan
            </DropdownMenuItem>
          }
        />
        <DropdownMenuItem asChild>
          <Link href={`/loans/${loan.id}`}>
            <ExternalLink className="mr-2 h-4 w-4" />
            View full details
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {!monthRepayment ? (
          <RepaymentDialog
            loanId={loan.id}
            loanName={loan.name}
            month={month}
            prefill={prefill ?? undefined}
            trigger={
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <Plus className="mr-2 h-4 w-4" />
                Record EMI
              </DropdownMenuItem>
            }
          />
        ) : (
          <RepaymentDialog
            loanId={loan.id}
            loanName={loan.name}
            month={month}
            existing={existingRepayment}
            trigger={
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit payment
              </DropdownMenuItem>
            }
          />
        )}

        <PrepaymentDialog
          loanId={loan.id}
          loanName={loan.name}
          currentMonth={month}
          currentOutstanding={currentOutstanding / 100}
          interestRate={loan.interestRate ? Number(loan.interestRate) : null}
          remainingTenure={loan.remainingTenureMonths}
          existingRepaymentThisMonth={!!monthRepayment}
          existingAmount={
            monthRepayment ? formatInrWhole(paise(parseMoney(monthRepayment.totalPayment))) : undefined
          }
          trigger={
            <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
              <Banknote className="mr-2 h-4 w-4" />
              Prepay
            </DropdownMenuItem>
          }
        />

        <DropdownMenuSeparator />

        <CloseLoanButton
          loanId={loan.id}
          loanName={loan.name}
          month={month}
          outstandingLabel={formatInrWhole(paise(currentOutstanding))}
          trigger={
            <DropdownMenuItem
              variant="destructive"
              onSelect={(e) => e.preventDefault()}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Close loan
            </DropdownMenuItem>
          }
        />

        <DropdownMenuSeparator />

        <DeleteLoanButton
          loanId={loan.id}
          loanName={loan.name}
          trigger={
            <DropdownMenuItem
              variant="destructive"
              onSelect={(e) => e.preventDefault()}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete loan
            </DropdownMenuItem>
          }
        />

        {monthRepayment && (
          <>
            <DropdownMenuSeparator />
            <DeleteRepaymentButton repaymentId={monthRepayment.id} />
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ScheduleTable({
  schedule,
  startMonth,
  allRepayments,
}: {
  schedule: SerializedScheduleStep[];
  startMonth: string;
  allRepayments: SerializedRepayment[];
}) {
  // Build paid months map
  const paidByMonth = new Map<string, number>();
  for (const r of allRepayments) {
    paidByMonth.set(r.month, parseMoney(r.totalPayment));
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Month</TableHead>
          <TableHead className="text-right">EMI</TableHead>
          <TableHead className="text-right">Principal</TableHead>
          <TableHead className="text-right">Interest</TableHead>
          <TableHead className="text-right">Balance</TableHead>
          <TableHead className="text-center">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {schedule.map((step) => {
          const m = addMonthsString(startMonth, step.monthIndex);
          const paid = paidByMonth.get(m);
          const isPaid = paid !== undefined;
          const differs = isPaid && Math.abs(paid - step.emi) > 100;

          return (
            <TableRow
              key={step.monthIndex}
              className={
                isPaid
                  ? differs
                    ? "bg-amber-50 dark:bg-amber-950/20"
                    : "bg-green-50 dark:bg-green-950/20"
                  : "text-muted-foreground"
              }
            >
              <TableCell className="font-medium">{formatMonthShort(m)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatInr(paise(step.emi))}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatInr(paise(step.principal))}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatInr(paise(step.interest))}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatInr(paise(step.closingBalance))}
              </TableCell>
              <TableCell className="text-center">
                {isPaid ? (
                  differs ? (
                    <Badge variant="outline" className="text-amber-700 border-amber-300">
                      Differs
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-green-700 border-green-300">
                      Paid
                    </Badge>
                  )
                ) : (
                  <span className="text-xs">Upcoming</span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function PaymentsTable({
  repayments,
  driftByMonth,
  loanId,
  loanName,
}: {
  repayments: SerializedRepayment[];
  driftByMonth: Map<string, string | null>;
  loanId: string;
  loanName: string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Month</TableHead>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead className="text-right">Principal</TableHead>
          <TableHead className="text-right">Interest</TableHead>
          <TableHead className="text-center">Drift</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {repayments.map((r) => {
          const drift = driftByMonth.get(r.month);
          const driftPaise = drift ? parseMoney(drift) : null;

          return (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{formatMonthShort(r.month)}</TableCell>
              <TableCell>{r.paymentDate}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatInr(paise(parseMoney(r.totalPayment)))}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatInr(paise(parseMoney(r.principalPaid)))}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatInr(paise(parseMoney(r.interestPaid)))}
              </TableCell>
              <TableCell className="text-center">
                {driftPaise === null ? (
                  <span className="text-muted-foreground">—</span>
                ) : driftPaise === 0 ? (
                  <Check className="h-4 w-4 text-green-600 mx-auto" />
                ) : (
                  <span className="text-amber-600 tabular-nums text-xs">
                    {driftPaise > 0 ? "+" : ""}
                    {formatInrWhole(paise(Math.abs(driftPaise)))}
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <RepaymentDialog
                    loanId={loanId}
                    loanName={loanName}
                    month={r.month}
                    existing={{
                      paymentDate: r.paymentDate,
                      totalPayment: r.totalPayment,
                      principalPaid: r.principalPaid,
                      interestPaid: r.interestPaid,
                      otherCharges: r.otherCharges,
                      outstandingAfterPayment: r.outstandingAfterPayment,
                      principalAdjustment: r.principalAdjustment,
                      adjustmentReason: r.adjustmentReason,
                      comment: r.comment,
                    }}
                    trigger={
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    }
                  />
                  <DeleteRepaymentButton repaymentId={r.id} />
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function PrepaymentTable({
  prepayments,
  ledger,
}: {
  prepayments: SerializedRepayment[];
  ledger: SerializedLedgerRow[];
}) {
  // Build balance-after map from ledger
  const balanceByMonth = new Map<string, string | null>();
  for (const row of ledger) {
    if (row.month) balanceByMonth.set(row.month, row.effectiveOutstanding);
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Month</TableHead>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="text-right">Balance After</TableHead>
          <TableHead>Comment</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {prepayments.map((r) => {
          const balance = balanceByMonth.get(r.month);
          return (
            <TableRow key={r.id}>
              <TableCell className="font-medium">{formatMonthShort(r.month)}</TableCell>
              <TableCell>{r.paymentDate}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatInr(paise(parseMoney(r.totalPayment)))}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {balance ? formatInr(paise(parseMoney(balance))) : "—"}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {r.comment ?? ""}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/* ─── Utilities ─── */

/** Parse a Postgres numeric string to integer paise (no float step). */
function parseMoney(numericString: string): number {
  const m = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(numericString.trim());
  if (!m) return 0;
  const [, sign, whole, frac = ""] = m;
  const hundredths = frac.padEnd(2, "0");
  const magnitude = Number(`${whole}${hundredths}`);
  return sign === "-" ? -magnitude : magnitude;
}

/** Simple month arithmetic for serialized month strings. */
function addMonthsString(base: string, delta: number): string {
  const [y, m] = base.split("-").map(Number);
  const ordinal = y * 12 + (m - 1) + delta;
  const newYear = Math.floor(ordinal / 12);
  const newMonth = (ordinal % 12) + 1;
  return `${newYear}-${String(newMonth).padStart(2, "0")}`;
}

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LONG_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Format "2025-03" as "Mar 25" */
function formatMonthShort(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return `${SHORT_MONTHS[mo - 1]} ${String(y).slice(2)}`;
}

/** Format "2025-03" as "March 2025" */
function formatMonthLong(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return `${LONG_MONTHS[mo - 1]} ${y}`;
}
