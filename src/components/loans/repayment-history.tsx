import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RepaymentDialog } from "@/components/loans/repayment-dialog";
import { DeleteRepaymentButton } from "@/components/loans/delete-repayment-button";
import { RestoreRepaymentButton } from "@/components/loans/restore-repayment-button";
import { formatInr, parsePaise } from "@/domain/money";
import { formatMonthShort, type MonthKey } from "@/domain/month";
import type { RepaymentRow } from "@/server/db/repositories/loan-repayments";

type DeletedRow = {
  id: string;
  loanId: string;
  month: string | null;
  totalPayment: string;
  principalPaid: string;
  interestPaid: string;
  comment: string | null;
};

type Props = {
  loanId: string;
  loanName: string;
  repayments: RepaymentRow[];
  deletedRepayments: DeletedRow[];
  hasDrift: boolean;
};

export function RepaymentHistory({
  loanId,
  loanName,
  repayments,
  deletedRepayments,
  hasDrift,
}: Props) {
  if (repayments.length === 0 && deletedRepayments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No repayments recorded yet for this loan.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {repayments.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Principal</TableHead>
                <TableHead className="text-right">Interest</TableHead>
                <TableHead className="text-right">Other</TableHead>
                <TableHead className="text-right">Outstanding After</TableHead>
                {hasDrift && <TableHead className="text-right">Drift</TableHead>}
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {repayments.map((rep) => {
                const total = parsePaise(rep.totalPayment);
                const principal = parsePaise(rep.principalPaid);
                const interest = parsePaise(rep.interestPaid);
                const other = parsePaise(rep.otherCharges);
                const outstanding = rep.outstandingAfterPayment
                  ? parsePaise(rep.outstandingAfterPayment)
                  : null;

                return (
                  <TableRow key={rep.id}>
                    <TableCell className="font-medium">
                      {formatMonthShort(rep.month as MonthKey)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {rep.paymentDate}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatInr(total)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatInr(principal)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatInr(interest)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {other > 0 ? formatInr(other) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {outstanding !== null ? formatInr(outstanding) : "—"}
                    </TableCell>
                    {hasDrift && (
                      <TableCell className="text-right">
                        {/* Drift would be populated from ledger data if available */}
                        <span className="text-muted-foreground">—</span>
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <RepaymentDialog
                          loanId={loanId}
                          loanName={loanName}
                          month={rep.month as MonthKey}
                          existing={{
                            paymentDate: rep.paymentDate,
                            totalPayment: rep.totalPayment,
                            principalPaid: rep.principalPaid,
                            interestPaid: rep.interestPaid,
                            otherCharges: rep.otherCharges,
                            principalAdjustment: rep.principalAdjustment,
                            adjustmentReason: rep.adjustmentReason,
                            outstandingAfterPayment: rep.outstandingAfterPayment,
                            comment: rep.comment,
                          }}
                          trigger={
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Edit repayment"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          }
                        />
                        <DeleteRepaymentButton repaymentId={rep.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {deletedRepayments.length > 0 && (
        <Card className="border-dashed">
          <CardContent className="space-y-2 px-4 py-3">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Recently deleted repayments
            </p>
            {deletedRepayments.map((row) => (
              <div key={row.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {row.month ? formatMonthShort(row.month as MonthKey) : "Unknown"} ·{" "}
                  {formatInr(parsePaise(row.totalPayment))}
                  {row.comment ? ` — ${row.comment}` : ""}
                </span>
                <RestoreRepaymentButton repaymentId={row.id} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
