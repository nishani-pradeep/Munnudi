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

type DataPoint = { month: string; principal: number; interest: number };

const chartConfig = {
  principal: { label: "Principal", color: "var(--color-primary)" },
  interest: { label: "Interest", color: "hsl(38, 92%, 50%)" },
} satisfies ChartConfig;

function formatRupees(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function PrincipalInterestChart({ data }: { data: DataPoint[] }) {
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
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="principal" stackId="a" fill="var(--color-principal)" />
        <Bar dataKey="interest" stackId="a" fill="var(--color-interest)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
