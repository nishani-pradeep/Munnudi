import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatInr } from "@/domain/money";
import type { Paise } from "@/domain/money";
import { addMonths, formatMonthShort, type MonthKey } from "@/domain/month";
import type { AmortizationStep } from "@/domain/loans";

type PaidMonth = { principal: Paise; interest: Paise; total: Paise };

type Props = {
  schedule: AmortizationStep[];
  startMonth: MonthKey;
  paidMonths: Map<string, PaidMonth>;
};

export function AmortizationTable({ schedule, startMonth, paidMonths }: Props) {
  if (schedule.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No schedule available. Add interest rate and tenure to see the amortization schedule.
      </p>
    );
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
          const month = addMonths(startMonth, step.monthIndex);
          const paid = paidMonths.get(month);
          const isPaid = !!paid;
          const differs = isPaid && Math.abs(paid.total - step.emi) > 100;

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
              <TableCell className="font-medium">{formatMonthShort(month)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatInr(step.emi)}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatInr(step.principal)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatInr(step.interest)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatInr(step.closingBalance)}
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
