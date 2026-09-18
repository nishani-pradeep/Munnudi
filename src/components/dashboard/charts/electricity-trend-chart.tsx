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

type DataPoint = { month: string; [unitCode: string]: number | string | null };

const PALETTE = [
  "hsl(221, 83%, 53%)",
  "hsl(262, 83%, 58%)",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)",
  "hsl(199, 89%, 48%)",
];

export function ElectricityTrendChart({
  data,
  unitCodes,
}: {
  data: DataPoint[];
  unitCodes: string[];
}) {
  if (data.length === 0 || unitCodes.length === 0) return null;

  const chartConfig: ChartConfig = {};
  for (let i = 0; i < unitCodes.length; i++) {
    chartConfig[unitCodes[i]] = {
      label: unitCodes[i],
      color: PALETTE[i % PALETTE.length],
    };
  }

  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <LineChart data={data} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={48} label={{ value: "kWh", angle: -90, position: "insideLeft" }} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        {unitCodes.map((code, i) => (
          <Line
            key={code}
            type="monotone"
            dataKey={code}
            stroke={PALETTE[i % PALETTE.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ChartContainer>
  );
}
