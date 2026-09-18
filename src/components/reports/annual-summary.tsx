import {
  Card,
  CardContent,
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
import {
  formatInr,
  formatInrWhole,
  sum,
  subtract,
  ZERO,
  type Paise,
} from "@/domain/money";
import {
  type MonthKey,
  formatMonthShort,
} from "@/domain/month";
import {
  computeRentalTarget,
  computeRentCollected,
  computeCollectionRate,
  computePrincipalRepaid,
  computeInterestPaid,
  type RentMonthRow,
  type ExpenseMonthRow,
  type RepaymentMonthRow,
  type Measure,
  type RatioMeasure,
} from "@/domain/kpi";
import { AnnualChart } from "./annual-chart";

type Props = {
  fy: number;
  months: MonthKey[];
  rentRows: RentMonthRow[];
  expenseRows: ExpenseMonthRow[];
  repaymentRows: RepaymentMonthRow[];
  loans: { loanId: string; expectsMonthlyPayment: boolean }[];
};

function measureValue(m: Measure): Paise {
  if (m.kind === "unknown") return ZERO;
  return m.paise;
}

function measureBasis(m: Measure): string {
  if (m.kind === "unknown") return "No data";
  return `${m.basisMonths} of 12 months`;
}

function ratioValue(r: RatioMeasure): string {
  if (r.kind === "unknown" || r.kind === "null") return "--";
  return `${r.percent.toFixed(1)}%`;
}

function ratioBasis(r: RatioMeasure): string {
  if (r.kind === "unknown") return "No data";
  if (r.kind === "null") return "No target";
  return `${r.basisMonths} of 12 months`;
}

export function AnnualSummary({
  fy,
  months,
  rentRows,
  expenseRows,
  repaymentRows,
  loans,
}: Props) {
  // --- KPI computations ---
  const target = computeRentalTarget(rentRows, months, "tillNow");
  const collected = computeRentCollected(rentRows, months, "tillNow");
  const collectionRate = computeCollectionRate(rentRows, months, "tillNow");
  const principal = computePrincipalRepaid(repaymentRows, loans, months, "tillNow");
  const interest = computeInterestPaid(repaymentRows, loans, months, "tillNow");

  const totalExpensesPaise = sum(expenseRows.map((e) => e.amount));
  const opProfit = subtract(measureValue(collected), totalExpensesPaise);

  // --- Per-month breakdown ---
  const rentByMonth = groupBy(rentRows, (r) => r.month);
  const expenseByMonth = groupBy(expenseRows, (r) => r.month);
  const repaymentByMonth = groupBy(repaymentRows, (r) => r.month);

  const monthlyBreakdown = months.map((m) => {
    const mRent = rentByMonth.get(m) ?? [];
    const mExp = expenseByMonth.get(m) ?? [];
    const mRep = repaymentByMonth.get(m) ?? [];
    const billable = mRent.filter((r) => r.isBillable);

    const monthTarget = sum(billable.map((r) => r.expectedRentSnapshot));
    const monthCollected = sum(
      billable.filter((r) => r.paidAmount !== null).map((r) => r.paidAmount!),
    );
    const monthExpenses = sum(mExp.map((e) => e.amount));
    const monthProfit = subtract(monthCollected, monthExpenses);
    const monthPrincipal = sum(mRep.map((r) => r.principalPaid));
    const monthInterest = sum(mRep.map((r) => r.interestPaid));

    const hasData =
      mRent.length > 0 || mExp.length > 0 || mRep.length > 0;

    return {
      month: m,
      label: formatMonthShort(m),
      target: monthTarget,
      collected: monthCollected,
      expenses: monthExpenses,
      profit: monthProfit,
      principal: monthPrincipal,
      interest: monthInterest,
      hasData,
    };
  });

  // --- Chart data ---
  const chartData = monthlyBreakdown.map((mb) => ({
    month: mb.label,
    collected: mb.collected / 100,
    expenses: mb.expenses / 100,
    loanPayments: (mb.principal + mb.interest) / 100,
  }));

  // --- Annual totals ---
  const annualTarget = sum(monthlyBreakdown.map((m) => m.target));
  const annualCollected = sum(monthlyBreakdown.map((m) => m.collected));
  const annualExpenses = sum(monthlyBreakdown.map((m) => m.expenses));
  const annualProfit = sum(monthlyBreakdown.map((m) => m.profit));
  const annualPrincipal = sum(monthlyBreakdown.map((m) => m.principal));
  const annualInterest = sum(monthlyBreakdown.map((m) => m.interest));

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">
        FY {fy}-{String(fy + 1).slice(2)} Annual Summary
      </h2>

      {/* A. KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <KpiCard title="Rent Target" measure={target} />
        <KpiCard title="Collected" measure={collected} />
        <KpiRatioCard title="Collection Rate" ratio={collectionRate} />
        <SimpleKpiCard title="Expenses" value={totalExpensesPaise} basis={`${months.length} months`} />
        <SimpleKpiCard title="Op. Profit" value={opProfit} basis="" />
        <KpiCard title="Principal Repaid" measure={principal} />
        <KpiCard title="Interest Paid" measure={interest} />
      </div>

      {/* B. Monthly Breakdown Table */}
      <section>
        <h3 className="mb-2 text-sm font-medium">Monthly Breakdown</h3>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Target</TableHead>
                <TableHead className="text-right">Collected</TableHead>
                <TableHead className="text-right">Expenses</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Principal</TableHead>
                <TableHead className="text-right">Interest</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyBreakdown.map((mb) => (
                <TableRow key={mb.month}>
                  <TableCell className="font-medium">{mb.label}</TableCell>
                  {mb.hasData ? (
                    <>
                      <TableCell className="text-right tabular-nums">
                        {formatInr(mb.target)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatInr(mb.collected)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatInr(mb.expenses)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatInr(mb.profit)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatInr(mb.principal)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatInr(mb.interest)}
                      </TableCell>
                    </>
                  ) : (
                    <TableCell
                      colSpan={6}
                      className="text-center text-muted-foreground"
                    >
                      --
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="font-medium">Total</TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {formatInr(annualTarget)}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {formatInr(annualCollected)}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {formatInr(annualExpenses)}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {formatInr(annualProfit)}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {formatInr(annualPrincipal)}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {formatInr(annualInterest)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </section>

      {/* C. Annual Trend Chart */}
      <section>
        <h3 className="mb-2 text-sm font-medium">Annual Trend</h3>
        <AnnualChart data={chartData} />
      </section>
    </div>
  );
}

// --- helper components ---

function KpiCard({ title, measure }: { title: string; measure: Measure }) {
  return (
    <Card size="sm">
      <CardContent className="pt-2">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="text-lg font-semibold tabular-nums">
          {measure.kind === "unknown" ? "--" : formatInrWhole(measure.paise)}
        </p>
        <p className="text-xs text-muted-foreground">{measureBasis(measure)}</p>
      </CardContent>
    </Card>
  );
}

function KpiRatioCard({ title, ratio }: { title: string; ratio: RatioMeasure }) {
  return (
    <Card size="sm">
      <CardContent className="pt-2">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="text-lg font-semibold tabular-nums">{ratioValue(ratio)}</p>
        <p className="text-xs text-muted-foreground">{ratioBasis(ratio)}</p>
      </CardContent>
    </Card>
  );
}

function SimpleKpiCard({
  title,
  value,
  basis,
}: {
  title: string;
  value: Paise;
  basis: string;
}) {
  return (
    <Card size="sm">
      <CardContent className="pt-2">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="text-lg font-semibold tabular-nums">{formatInrWhole(value)}</p>
        {basis && <p className="text-xs text-muted-foreground">{basis}</p>}
      </CardContent>
    </Card>
  );
}

// --- util ---

function groupBy<T>(items: readonly T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const arr = map.get(key);
    if (arr) arr.push(item);
    else map.set(key, [item]);
  }
  return map;
}
