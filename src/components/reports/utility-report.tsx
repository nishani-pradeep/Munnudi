import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatInr, parsePaise, ZERO, type Paise } from "@/domain/money";
import { computeUsage } from "@/domain/utilities";
import type { MonthKey } from "@/domain/month";
import type { UtilityRangeRow } from "@/server/db/repositories/utility-records";

type Props = {
  fy: number;
  months: MonthKey[];
  utilityRows: UtilityRangeRow[];
};

type UnitUtilitySummary = {
  unitCode: string;
  avgUsage: number | null;
  totalBill: Paise;
  months: number;
};

export function UtilityReport({ fy, utilityRows }: Props) {
  const types = Array.from(new Set(utilityRows.map((r) => r.utilityType)));

  if (types.length === 0) {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">
          Utility Report -- FY {fy}-{String(fy + 1).slice(2)}
        </h2>
        <p className="text-sm text-muted-foreground">No utility data for this period.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">
        Utility Report -- FY {fy}-{String(fy + 1).slice(2)}
      </h2>

      {types.map((type) => {
        const typeRows = utilityRows.filter((r) => r.utilityType === type);
        const unitCodes = Array.from(new Set(typeRows.map((r) => r.unitCode)));

        const summaries: UnitUtilitySummary[] = unitCodes.map((unitCode) => {
          const unitRows = typeRows.filter((r) => r.unitCode === unitCode);
          const usages: number[] = [];
          let totalBill = ZERO as Paise;

          for (const row of unitRows) {
            const prev = row.previousReading !== null ? Number(row.previousReading) : null;
            const curr = row.currentReading !== null ? Number(row.currentReading) : null;
            const ovr = row.usageOverride !== null ? Number(row.usageOverride) : null;
            const usage = computeUsage(prev, curr, ovr);
            if (usage !== null) usages.push(usage);
            if (row.billAmount !== null) {
              totalBill = (totalBill + parsePaise(row.billAmount)) as Paise;
            }
          }

          const avgUsage = usages.length > 0
            ? usages.reduce((a, b) => a + b, 0) / usages.length
            : null;

          return {
            unitCode,
            avgUsage,
            totalBill,
            months: unitRows.length,
          };
        });

        return (
          <section key={type}>
            <h3 className="mb-2 text-sm font-medium">{type}</h3>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Avg Usage</TableHead>
                    <TableHead className="text-right">Total Bill</TableHead>
                    <TableHead className="text-right">Months</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summaries.map((s) => (
                    <TableRow key={s.unitCode}>
                      <TableCell className="font-medium">{s.unitCode}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s.avgUsage !== null ? s.avgUsage.toFixed(1) : "--"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatInr(s.totalBill)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{s.months}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
