"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";

type DataPoint = { month: string; [category: string]: number | string };

const PALETTE = [
  "hsl(221, 83%, 53%)",   // blue
  "hsl(262, 83%, 58%)",   // violet
  "hsl(142, 71%, 45%)",   // green
  "hsl(38, 92%, 50%)",    // amber
  "hsl(0, 84%, 60%)",     // red
  "hsl(199, 89%, 48%)",   // cyan
  "hsl(316, 72%, 51%)",   // pink
  "hsl(25, 95%, 53%)",    // orange
];

function formatRupees(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function ExpenseCategoryChart({
  data,
  categories,
}: {
  data: DataPoint[];
  categories: string[];
}) {
  if (data.length === 0 || categories.length === 0) return null;

  const chartConfig: ChartConfig = {};
  for (let i = 0; i < categories.length; i++) {
    chartConfig[categories[i]] = {
      label: categories[i],
      color: PALETTE[i % PALETTE.length],
    };
  }

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
        <ChartLegend content={<ChartLegendContent />} />
        {categories.map((cat, i) => (
          <Bar
            key={cat}
            dataKey={cat}
            stackId="a"
            fill={PALETTE[i % PALETTE.length]}
            radius={i === categories.length - 1 ? [4, 4, 0, 0] : undefined}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}
