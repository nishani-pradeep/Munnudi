"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";

const chartConfig = {
  collected: { label: "Collected", color: "var(--color-green-500, #22c55e)" },
  expenses: { label: "Expenses", color: "var(--color-orange-500, #f97316)" },
  loanPayments: { label: "Loan Payments", color: "var(--color-blue-500, #3b82f6)" },
} satisfies ChartConfig;

type DataPoint = {
  month: string;
  collected: number;
  expenses: number;
  loanPayments: number;
};

type Props = {
  data: DataPoint[];
};

export function AnnualChart({ data }: Props) {
  if (data.length === 0) return null;

  return (
    <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
      <BarChart data={data} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="collected" fill="var(--color-collected)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expenses" fill="var(--color-expenses)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="loanPayments" fill="var(--color-loanPayments)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
