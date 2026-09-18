"use client";

import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

type DataPoint = { month: string; profit: number };

const chartConfig = {
  profit: { label: "Operating Profit", color: "var(--color-primary)" },
} satisfies ChartConfig;

function formatRupees(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function OperatingProfitChart({ data }: { data: DataPoint[] }) {
  if (data.length === 0) return null;

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <BarChart data={data} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickFormatter={formatRupees} tickLine={false} axisLine={false} width={72} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => formatRupees(value as number)}
            />
          }
        />
        <ReferenceLine y={0} stroke="var(--color-border)" strokeDasharray="3 3" />
        <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={index}
              fill={entry.profit >= 0 ? "hsl(142, 71%, 45%)" : "hsl(0, 84%, 60%)"}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
