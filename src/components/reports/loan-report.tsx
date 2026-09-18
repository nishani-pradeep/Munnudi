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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatInr, formatInrWhole, parsePaise, sum, type Paise } from "@/domain/money";
import { formatMonthShort } from "@/domain/month";
import type { RepaymentMonthRow } from "@/domain/kpi";

type LoanOutstandingInfo = {
  loanId: string;
  loanName: string;
  outstanding: Paise;
  openingOutstanding: string;
};

type Props = {
  fy: number;
  repaymentRows: RepaymentMonthRow[];
  loanOutstandings: LoanOutstandingInfo[];
};

export function LoanReport({
  fy,
  repaymentRows,
  loanOutstandings,
}: Props) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">
        Loan Report -- FY {fy}-{String(fy + 1).slice(2)}
      </h2>

      {/* Per-loan cards */}
      {loanOutstandings.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active loans.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {loanOutstandings.map((loan) => {
            const loanReps = repaymentRows.filter((r) => r.loanId === loan.loanId);
            const totalPrincipal = sum(loanReps.map((r) => r.principalPaid));
            const totalInterest = sum(loanReps.map((r) => r.interestPaid));
            const opening = parsePaise(loan.openingOutstanding);

            return (
              <Card key={loan.loanId} size="sm">
                <CardHeader>
                  <CardTitle>{loan.loanName}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Opening</p>
                      <p className="font-medium tabular-nums">{formatInrWhole(opening)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Current Outstanding</p>
                      <p className="font-medium tabular-nums">{formatInrWhole(loan.outstanding)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Principal Repaid</p>
                      <p className="font-medium tabular-nums">{formatInrWhole(totalPrincipal)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Interest Paid</p>
                      <p className="font-medium tabular-nums">{formatInrWhole(totalInterest)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Repayment table for the year */}
      {repaymentRows.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-medium">Repayment History</h3>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Loan</TableHead>
                  <TableHead className="text-right">Principal</TableHead>
                  <TableHead className="text-right">Interest</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {repaymentRows.map((r, i) => (
                  <TableRow key={`${r.loanId}-${r.month}-${i}`}>
                    <TableCell className="font-medium">{formatMonthShort(r.month)}</TableCell>
                    <TableCell>{r.loanId}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatInr(r.principalPaid)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatInr(r.interestPaid)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  );
}
