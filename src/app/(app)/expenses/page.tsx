import { Plus, ReceiptText } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { ExpenseDialog } from "@/components/expenses/expense-dialog";
import { DeleteExpenseButton } from "@/components/expenses/delete-expense-button";
import { RestoreExpenseButton } from "@/components/expenses/restore-expense-button";
import { monthFromParam, type SearchParams } from "@/lib/month-param";
import { formatMonthLong } from "@/domain/month";
import { formatInr, parsePaise, sum } from "@/domain/money";
import { getActivePropertyId } from "@/server/db/scope";
import { listMonth, listDeletedForMonth, listCategories } from "@/server/db/repositories/expenses";
import { listActiveUnits } from "@/server/db/repositories/units";

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const month = monthFromParam(params.m);
  const label = formatMonthLong(month);

  const propertyId = await getActivePropertyId();
  const [rows, deletedRows, categories, units] = await Promise.all([
    listMonth(propertyId, month),
    listDeletedForMonth(propertyId, month),
    listCategories(propertyId),
    listActiveUnits(propertyId),
  ]);

  const total = sum(rows.map((r) => parsePaise(r.amount)));
  const unitOptions = units.map((u) => ({ id: u.id, unitCode: u.unitCode }));

  return (
    <>
      <PageHeader
        title="Expenses"
        description={`Property and common expenses · ${label}`}
        actions={
          categories.length > 0 ? (
            <ExpenseDialog
              month={month}
              categories={categories}
              units={unitOptions}
              trigger={
                <Button size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  Add expense
                </Button>
              }
            />
          ) : null
        }
      />

      {categories.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="No expense categories yet"
          nextStep="Expense categories are configured in Settings before expenses can be logged."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title={`No expenses recorded for ${label}`}
          nextStep="Add the month's common or property expenses with the button above."
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            Total: <span className="font-medium text-foreground">{formatInr(total)}</span> across{" "}
            {rows.length} {rows.length === 1 ? "entry" : "entries"}
          </p>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="hidden md:table-cell">Comment</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.categoryName}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatInr(parsePaise(row.amount))}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.expenseDate ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.unitCode ?? "Common"}
                    </TableCell>
                    <TableCell className="hidden max-w-[16rem] truncate text-muted-foreground md:table-cell">
                      {row.comment ?? ""}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <ExpenseDialog
                          month={month}
                          categories={categories}
                          units={unitOptions}
                          existing={{
                            id: row.id,
                            categoryId: row.categoryId,
                            unitId: row.unitId,
                            expenseDate: row.expenseDate,
                            amount: row.amount,
                            comment: row.comment,
                          }}
                          trigger={
                            <Button variant="ghost" size="icon" aria-label="Edit expense">
                              <ReceiptText className="h-4 w-4" />
                            </Button>
                          }
                        />
                        <DeleteExpenseButton expenseId={row.id} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
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
                  {row.categoryName} · {formatInr(parsePaise(row.amount))}
                  {row.comment ? ` — ${row.comment}` : ""}
                </span>
                <RestoreExpenseButton expenseId={row.id} />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
