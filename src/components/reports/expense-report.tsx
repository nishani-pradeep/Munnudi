import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatInr, type Paise, sum, ZERO } from "@/domain/money";
import type { MonthKey } from "@/domain/month";
import type { ExpenseMonthRow } from "@/domain/kpi";

type Props = {
  fy: number;
  months: MonthKey[];
  expenseRows: ExpenseMonthRow[];
};

type CategorySummary = {
  category: string;
  total: Paise;
  percent: number;
};

export function ExpenseReport({ fy, expenseRows }: Props) {
  const grandTotal = sum(expenseRows.map((e) => e.amount));

  // Group by category
  const catMap = new Map<string, Paise>();
  for (const e of expenseRows) {
    catMap.set(e.categoryName, (catMap.get(e.categoryName) ?? ZERO) + e.amount as Paise);
  }

  const categories: CategorySummary[] = Array.from(catMap.entries())
    .map(([category, total]) => ({
      category,
      total: total as Paise,
      percent: grandTotal > 0 ? (total / grandTotal) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">
        Expense Report -- FY {fy}-{String(fy + 1).slice(2)}
      </h2>

      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">No expenses recorded for this period.</p>
      ) : (
        <>
          <section>
            <h3 className="mb-2 text-sm font-medium">Category Breakdown</h3>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">% of Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((c) => (
                    <TableRow key={c.category}>
                      <TableCell className="font-medium">{c.category}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatInr(c.total)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {c.percent.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>

          <p className="text-sm text-muted-foreground">
            Grand total: <span className="font-medium text-foreground">{formatInr(grandTotal)}</span>{" "}
            across {expenseRows.length} entries in {categories.length} categories
          </p>
        </>
      )}
    </div>
  );
}
