import { IndianRupee } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { RentStatusBadge } from "@/components/rent/status-badge";
import { EditRentDialog } from "@/components/rent/edit-rent-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { monthFromParam, type SearchParams } from "@/lib/month-param";
import { formatMonthLong } from "@/domain/month";
import { formatInr, parsePaise, sum, ZERO } from "@/domain/money";
import { getActivePropertyId } from "@/server/db/scope";
import {
  ensureMonthGenerated,
  listMonthForDisplay,
} from "@/server/db/repositories/unit-month-records";

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const month = monthFromParam(params.m);
  const label = formatMonthLong(month);

  const propertyId = await getActivePropertyId();
  await ensureMonthGenerated(propertyId, month);
  const rows = await listMonthForDisplay(propertyId, month);

  const billable = rows.filter((r) => r.isBillable);
  const target = sum(billable.map((r) => parsePaise(r.expectedRentSnapshot)));
  const collected = sum(billable.map((r) => (r.paidAmount ? parsePaise(r.paidAmount) : ZERO)));

  return (
    <>
      <PageHeader
        title="Rent"
        description={`Unit-by-unit expected and paid rent · ${label}`}
        actions={
          <div className="text-sm">
            <span className="text-muted-foreground">Target </span>
            <span className="font-medium tabular-nums">{formatInr(target)}</span>
            <span className="text-muted-foreground"> · Collected </span>
            <span className="font-medium tabular-nums">{formatInr(collected)}</span>
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          icon={IndianRupee}
          title="No units configured yet"
          nextStep="Add units and their rent in Settings before rent can be tracked for a month."
        />
      ) : (
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
                <TableHead>Payment date</TableHead>
                <TableHead className="hidden md:table-cell">Comment</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const expected = parsePaise(row.expectedRentSnapshot);
                const paid = row.paidAmount ? parsePaise(row.paidAmount) : null;
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.unitCode}</TableCell>
                    <TableCell className="text-muted-foreground">{row.unitType}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.occupancySnapshot === "SELF_OCCUPIED"
                        ? "Self Occupied"
                        : row.occupancySnapshot === "VACANT"
                          ? "Vacant"
                          : "Occupied"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatInr(expected)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {paid === null ? (
                        <span className="text-muted-foreground italic">Not entered</span>
                      ) : (
                        formatInr(paid)
                      )}
                    </TableCell>
                    <TableCell>
                      <RentStatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.paymentDate ?? "—"}
                    </TableCell>
                    <TableCell className="hidden max-w-[16rem] truncate text-muted-foreground md:table-cell">
                      {row.comment ?? ""}
                    </TableCell>
                    <TableCell>
                      {row.isBillable ? (
                        <EditRentDialog row={row} expectedLabel={formatInr(expected)} />
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
