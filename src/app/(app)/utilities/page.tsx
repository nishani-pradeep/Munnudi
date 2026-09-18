import { Gauge } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { EditUtilityDialog } from "@/components/utilities/edit-utility-dialog";
import { DeleteUtilityButton } from "@/components/utilities/delete-utility-button";
import { RestoreUtilityButton } from "@/components/utilities/restore-utility-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { monthFromParam, type SearchParams } from "@/lib/month-param";
import { formatMonthLong } from "@/domain/month";
import { formatInr, parsePaise } from "@/domain/money";
import { computeUsage } from "@/domain/utilities";
import { getActivePropertyId } from "@/server/db/scope";
import {
  listMonthForDisplay,
  listDeletedForMonth,
} from "@/server/db/repositories/utility-records";

const METER_EVENT_LABEL: Record<string, string> = {
  NONE: "",
  RESET: "Reset",
  ROLLOVER: "Rollover",
  REPLACED: "Replaced",
};

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const month = monthFromParam(params.m);
  const label = formatMonthLong(month);

  const propertyId = await getActivePropertyId();
  const [rows, deletedRows] = await Promise.all([
    listMonthForDisplay(propertyId, month),
    listDeletedForMonth(propertyId, month),
  ]);

  return (
    <>
      <PageHeader title="Utilities" description={`Electricity and water readings · ${label}`} />

      {rows.length === 0 ? (
        <EmptyState
          icon={Gauge}
          title="No units configured yet"
          nextStep="Add units in Settings before utility readings can be tracked."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Previous</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">Usage</TableHead>
                <TableHead className="text-right">Bill</TableHead>
                <TableHead>Paid</TableHead>
                <TableHead className="hidden md:table-cell">Comment</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const previous = row.previousReading === null ? null : Number(row.previousReading);
                const current = row.currentReading === null ? null : Number(row.currentReading);
                const override = row.usageOverride === null ? null : Number(row.usageOverride);
                const usage = computeUsage(previous, current, override);
                const bill = row.billAmount === null ? null : parsePaise(row.billAmount);

                return (
                  <TableRow key={`${row.unitId}:${row.utilityType}`}>
                    <TableCell className="font-medium">{row.unitCode}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.utilityType === "ELECTRICITY" ? "Electricity" : "Water"}
                      {row.meterEvent !== "NONE" ? (
                        <Badge variant="outline" className="ml-2 text-[10px] font-normal">
                          {METER_EVENT_LABEL[row.meterEvent]}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{previous ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{current ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {usage === null ? (
                        <span className="text-muted-foreground italic">Not entered</span>
                      ) : (
                        `${usage} ${row.uomSnapshot}`
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.noBillThisMonth ? (
                        <span className="text-muted-foreground italic">No bill</span>
                      ) : bill === null ? (
                        <span className="text-muted-foreground italic">Not entered</span>
                      ) : (
                        formatInr(bill)
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.billPaid === null ? "—" : row.billPaid ? "Yes" : "No"}
                    </TableCell>
                    <TableCell className="hidden max-w-[14rem] truncate text-muted-foreground md:table-cell">
                      {row.comment ?? ""}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <EditUtilityDialog row={row} month={month} />
                        {row.id !== null ? (
                          <DeleteUtilityButton recordId={row.id} />
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {deletedRows.length > 0 ? (
        <Card className="mt-6 border-dashed">
          <CardContent className="space-y-2 px-4 py-3">
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Recently deleted
            </p>
            {deletedRows.map((row) => (
              <div key={row.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {row.unitCode} · {row.utilityType === "ELECTRICITY" ? "Electricity" : "Water"}
                  {row.billAmount ? ` · ${formatInr(parsePaise(row.billAmount))}` : ""}
                </span>
                <RestoreUtilityButton recordId={row.id} />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
