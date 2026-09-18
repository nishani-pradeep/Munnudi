import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatInr, sum, ZERO, type Paise } from "@/domain/money";
import type { MonthKey } from "@/domain/month";
import type { RentMonthRow } from "@/domain/kpi";

type Props = {
  fy: number;
  months: MonthKey[];
  rentRows: RentMonthRow[];
};

type UnitSummary = {
  unitId: string;
  expected: Paise;
  collected: Paise;
  rate: number;
  monthsPaid: number;
  monthsUnpaid: number;
};

export function UnitPerformance({ fy, months, rentRows }: Props) {
  const unitIds = Array.from(new Set(rentRows.map((r) => r.unitId)));

  const summaries: UnitSummary[] = unitIds.map((unitId) => {
    const rows = rentRows.filter((r) => r.unitId === unitId && r.isBillable);
    const expected = sum(rows.map((r) => r.expectedRentSnapshot));
    const collected = sum(
      rows.filter((r) => r.paidAmount !== null).map((r) => r.paidAmount!),
    );
    const rate = expected > 0 ? (collected / expected) * 100 : 0;

    let monthsPaid = 0;
    let monthsUnpaid = 0;
    for (const m of months) {
      const mRow = rows.find((r) => r.month === m);
      if (!mRow) continue;
      if (mRow.paidAmount !== null && mRow.paidAmount > ZERO) monthsPaid++;
      else monthsUnpaid++;
    }

    return { unitId, expected, collected, rate, monthsPaid, monthsUnpaid };
  });

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">
        Unit Performance -- FY {fy}-{String(fy + 1).slice(2)}
      </h2>
      {summaries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No rent data for this period.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Expected (Year)</TableHead>
                <TableHead className="text-right">Collected (Year)</TableHead>
                <TableHead className="text-right">Rate %</TableHead>
                <TableHead className="text-right">Months Paid</TableHead>
                <TableHead className="text-right">Months Unpaid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaries.map((s) => (
                <TableRow key={s.unitId}>
                  <TableCell className="font-medium">{s.unitId}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatInr(s.expected)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatInr(s.collected)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {s.rate.toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{s.monthsPaid}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.monthsUnpaid}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
