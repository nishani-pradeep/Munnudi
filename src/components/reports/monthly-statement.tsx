import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatInr, formatInrWhole, parsePaise, sum, subtract, add, type Paise } from "@/domain/money";
import { computeUsage } from "@/domain/utilities";
import type { MonthKey } from "@/domain/month";
import { formatMonthLong } from "@/domain/month";
import type { MonthRow } from "@/server/db/repositories/unit-month-records";
import type { ExpenseRow } from "@/server/db/repositories/expenses";
import type { UtilityRow } from "@/server/db/repositories/utility-records";
import type { LoanRow } from "@/server/db/repositories/loans";

type RepaymentForDisplay = {
  loanId: string;
  loanName: string;
  totalPayment: string;
  principalPaid: string;
  interestPaid: string;
  otherCharges: string;
  outstandingAfterPayment: string | null;
};

type Props = {
  month: MonthKey;
  rentRows: MonthRow[];
  expenseRows: ExpenseRow[];
  utilityRows: UtilityRow[];
  repayments: RepaymentForDisplay[];
  activeLoans: LoanRow[];
};

export function MonthlyStatement({
  month,
  rentRows,
  expenseRows,
  utilityRows,
  repayments,
  activeLoans,
}: Props) {
  const label = formatMonthLong(month);

  // --- Compute summary values ---
  const billableRent = rentRows.filter((r) => r.isBillable);
  const rentCollected = sum(
    billableRent
      .filter((r) => r.paidAmount !== null)
      .map((r) => parsePaise(r.paidAmount!)),
  );

  const totalExpenses = sum(expenseRows.map((r) => parsePaise(r.amount)));

  const totalLoanPayments = sum(
    repayments.map((r) => parsePaise(r.totalPayment)),
  );

  const operatingProfit = subtract(rentCollected, totalExpenses);

  // --- Utility grouping ---
  const utilityTypes = Array.from(new Set(utilityRows.map((r) => r.utilityType)));

  // --- Loan repayment map ---
  const repaymentByLoan = new Map(repayments.map((r) => [r.loanId, r]));
  const loansWithoutRepayment = activeLoans.filter(
    (l) => !repaymentByLoan.has(l.id),
  );

  // --- Bottom summary ---
  const totalOutflow = add(totalExpenses, totalLoanPayments);
  const netPosition = subtract(rentCollected, totalOutflow);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">{label} -- Monthly Statement</h2>

      {/* A. Summary Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard title="Rent Collected" value={rentCollected} />
        <SummaryCard title="Total Expenses" value={totalExpenses} />
        <SummaryCard title="Loan Payments" value={totalLoanPayments} />
        <SummaryCard title="Operating Profit" value={operatingProfit} />
      </div>

      {/* B. Rent Collection Table */}
      {rentRows.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-medium">Rent Collection</h3>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Occupancy</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rentRows.map((row) => {
                  const isSelf = row.occupancySnapshot === "SELF_OCCUPIED";
                  return (
                    <TableRow
                      key={row.id}
                      className={isSelf ? "text-muted-foreground" : undefined}
                    >
                      <TableCell className="font-medium">{row.unitCode}</TableCell>
                      <TableCell>{row.unitType}</TableCell>
                      <TableCell>{row.occupancySnapshot}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatInr(parsePaise(row.expectedRentSnapshot))}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.paidAmount !== null ? (
                          formatInr(parsePaise(row.paidAmount))
                        ) : (
                          <span className="italic text-muted-foreground">Not entered</span>
                        )}
                      </TableCell>
                      <TableCell>{row.status ?? "--"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="font-medium">
                    Total
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatInr(sum(billableRent.map((r) => parsePaise(r.expectedRentSnapshot))))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatInr(rentCollected)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </section>
      )}

      {/* C. Expenses Table */}
      {expenseRows.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-medium">Expenses</h3>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="hidden md:table-cell">Comment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenseRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.categoryName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.expenseDate ?? "--"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatInr(parsePaise(row.amount))}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.unitCode ?? "Common"}
                    </TableCell>
                    <TableCell className="hidden max-w-[16rem] truncate text-muted-foreground md:table-cell">
                      {row.comment ?? ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="font-medium">
                    Total
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatInr(totalExpenses)}
                  </TableCell>
                  <TableCell colSpan={2} />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </section>
      )}

      {/* D. Utilities Section */}
      {utilityTypes.map((type) => {
        const typeRows = utilityRows.filter((r) => r.utilityType === type);
        if (typeRows.every((r) => r.id === null)) return null;
        const uom = typeRows[0]?.uomSnapshot ?? "";
        return (
          <section key={type}>
            <h3 className="mb-2 text-sm font-medium">{type} Utility</h3>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Previous</TableHead>
                    <TableHead className="text-right">Current</TableHead>
                    <TableHead className="text-right">Usage ({uom})</TableHead>
                    <TableHead className="text-right">Bill</TableHead>
                    <TableHead>Paid?</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {typeRows
                    .filter((r) => r.id !== null)
                    .map((row) => {
                      const prev = row.previousReading !== null ? Number(row.previousReading) : null;
                      const curr = row.currentReading !== null ? Number(row.currentReading) : null;
                      const ovr = row.usageOverride !== null ? Number(row.usageOverride) : null;
                      const usage = computeUsage(prev, curr, ovr);
                      return (
                        <TableRow key={`${row.unitId}-${row.utilityType}`}>
                          <TableCell className="font-medium">{row.unitCode}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {prev !== null ? prev : "--"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {curr !== null ? curr : "--"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {usage !== null ? usage : "--"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.billAmount !== null
                              ? formatInr(parsePaise(row.billAmount))
                              : "--"}
                          </TableCell>
                          <TableCell>
                            {row.billPaid === true
                              ? "Yes"
                              : row.billPaid === false
                                ? "No"
                                : "--"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          </section>
        );
      })}

      {/* E. Loan Repayments Table */}
      {(repayments.length > 0 || loansWithoutRepayment.length > 0) && (
        <section>
          <h3 className="mb-2 text-sm font-medium">Loan Repayments</h3>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Loan</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead className="text-right">Interest</TableHead>
                  <TableHead className="text-right">Other</TableHead>
                  <TableHead className="text-right">Outstanding After</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repayments.map((r) => (
                  <TableRow key={r.loanId}>
                    <TableCell className="font-medium">{r.loanName}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatInr(parsePaise(r.totalPayment))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatInr(parsePaise(r.principalPaid))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatInr(parsePaise(r.interestPaid))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatInr(parsePaise(r.otherCharges))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.outstandingAfterPayment !== null
                        ? formatInr(parsePaise(r.outstandingAfterPayment))
                        : "--"}
                    </TableCell>
                  </TableRow>
                ))}
                {loansWithoutRepayment.map((l) => (
                  <TableRow key={l.id} className="text-muted-foreground">
                    <TableCell className="font-medium">{l.name}</TableCell>
                    <TableCell colSpan={5} className="italic">
                      Not recorded
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              {repayments.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-medium">Total</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatInr(totalLoanPayments)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatInr(sum(repayments.map((r) => parsePaise(r.principalPaid))))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatInr(sum(repayments.map((r) => parsePaise(r.interestPaid))))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {formatInr(sum(repayments.map((r) => parsePaise(r.otherCharges))))}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </section>
      )}

      {/* F. Month Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Month Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3">
            <SummaryLine
              label="Operating Income"
              sublabel="Rent - Expenses"
              value={operatingProfit}
            />
            <SummaryLine
              label="Total Outflow"
              sublabel="Expenses + Loan Payments"
              value={totalOutflow}
            />
            <SummaryLine
              label="Net Position"
              sublabel="Rent - Expenses - Loans"
              value={netPosition}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: Paise }) {
  return (
    <Card size="sm">
      <CardContent className="pt-2">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="text-lg font-semibold tabular-nums">{formatInrWhole(value)}</p>
      </CardContent>
    </Card>
  );
}

function SummaryLine({
  label,
  sublabel,
  value,
}: {
  label: string;
  sublabel: string;
  value: Paise;
}) {
  const isNeg = value < 0;
  return (
    <div>
      <p className="font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{sublabel}</p>
      <p className={`mt-1 text-lg font-semibold tabular-nums ${isNeg ? "text-destructive" : ""}`}>
        {formatInrWhole(value)}
      </p>
    </div>
  );
}
