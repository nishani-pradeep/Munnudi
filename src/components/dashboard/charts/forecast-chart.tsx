"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import type { ForecastPoint } from "@/domain/kpi";

const chartConfig = {
  loanBalance: {
    label: "Loan Outstanding",
    color: "hsl(0, 84%, 60%)",
  },
  cumulativeRent: {
    label: "Cumulative Rent",
    color: "hsl(142, 71%, 45%)",
  },
} satisfies ChartConfig;

function formatRupees(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function ForecastChart({ data }: { data: ForecastPoint[] }) {
  if (data.length === 0) return null;

  const filtered = data.filter((_, i) => i % 3 === 0 || i === data.length - 1);

  return (
    <ChartContainer config={chartConfig} className="h-[350px] w-full">
      <AreaChart data={filtered} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          interval="preserveStartEnd"
          tickFormatter={(v) => (v.startsWith("Year") ? v : "")}
        />
        <YAxis
          tickFormatter={formatRupees}
          tickLine={false}
          axisLine={false}
          width={72}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => formatRupees(value as number)}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          type="monotone"
          dataKey="loanBalance"
          stroke="hsl(0, 84%, 60%)"
          fill="hsl(0, 84%, 60%)"
          fillOpacity={0.1}
          strokeWidth={2}
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="cumulativeRent"
          stroke="hsl(142, 71%, 45%)"
          fill="hsl(142, 71%, 45%)"
          fillOpacity={0.1}
          strokeWidth={2}
          dot={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}
