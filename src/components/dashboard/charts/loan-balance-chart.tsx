"use client";

import { Line, LineChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";

type DataPoint = { month: string; total: number; [loanName: string]: number | string };

const PALETTE = [
  "hsl(221, 83%, 53%)",
  "hsl(262, 83%, 58%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)",
];

function formatRupees(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function LoanBalanceChart({
  data,
  loanNames,
}: {
  data: DataPoint[];
  loanNames: string[];
}) {
  if (data.length === 0) return null;

  const chartConfig: ChartConfig = {
    total: { label: "Total", color: "var(--color-foreground)" },
  };
  for (let i = 0; i < loanNames.length; i++) {
    chartConfig[loanNames[i]] = {
      label: loanNames[i],
      color: PALETTE[i % PALETTE.length],
    };
  }

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <LineChart data={data} accessibilityLayer>
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
        <ChartLegend content={<ChartLegendContent />} />
        {loanNames.map((name, i) => (
          <Line
            key={name}
            type="monotone"
            dataKey={name}
            stroke={PALETTE[i % PALETTE.length]}
            strokeWidth={1.5}
            dot={false}
          />
        ))}
        <Line
          type="monotone"
          dataKey="total"
          stroke="var(--color-foreground)"
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={false}
        />
      </LineChart>
    </ChartContainer>
  );
}
