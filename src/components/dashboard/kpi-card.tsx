import Link from "next/link";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardDescription } from "@/components/ui/card";
import { formatInrWhole } from "@/domain/money";
import type { Measure, RatioMeasure, StockMeasure, Delta, KpiScope } from "@/domain/kpi";

type Props = {
  title: string;
  format: "currency" | "percent" | "stock";
  measure: Measure | RatioMeasure | StockMeasure;
  delta?: Delta;
  drilldownHref?: string;
  scope: KpiScope;
};

function formatValue(
  measure: Measure | RatioMeasure | StockMeasure,
  format: Props["format"],
  scope: KpiScope,
): string {
  // StockMeasure + average scope = not applicable
  if (format === "stock" && scope === "average") {
    return "N/A";
  }

  if (measure.kind === "unknown") return "—";
  if (measure.kind === "null") return "—";

  if (format === "percent" && "percent" in measure) {
    return `${measure.percent.toFixed(1)}%`;
  }

  if ("paise" in measure) {
    return formatInrWhole(measure.paise);
  }

  return "—";
}

function coverageLabel(
  measure: Measure | RatioMeasure | StockMeasure,
  format: Props["format"],
  scope: KpiScope,
): string | null {
  if (format === "stock") {
    if (scope === "average") return "N/A for averages";
    return measure.kind === "unknown" ? "No data" : null;
  }

  if (measure.kind === "unknown") return "No data";
  if (measure.kind === "null") return "No target";

  if ("basisMonths" in measure && "missing" in measure && measure.kind === "partial") {
    const total = measure.basisMonths + measure.missing.length;
    return `${measure.basisMonths} of ${total} months`;
  }

  if ("basisMonths" in measure) {
    return `${measure.basisMonths} ${measure.basisMonths === 1 ? "month" : "months"}`;
  }

  return null;
}

function DeltaBadge({ delta }: { delta: Delta }) {
  if (!delta || delta.direction === "flat") return null;

  const isUp = delta.direction === "up";
  const Icon = isUp ? TrendingUp : TrendingDown;
  const color = isUp ? "text-emerald-600" : "text-red-600";
  const label = formatInrWhole(
    (isUp ? delta.paise : (-delta.paise as typeof delta.paise)) as typeof delta.paise,
  );

  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

export function KpiCard({ title, format, measure, delta, drilldownHref, scope }: Props) {
  const value = formatValue(measure, format, scope);
  const coverage = coverageLabel(measure, format, scope);

  const content = (
    <Card
      size="sm"
      className={drilldownHref ? "transition-colors hover:bg-muted/50" : undefined}
    >
      <CardContent className="space-y-1">
        <CardDescription className="text-xs">{title}</CardDescription>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-semibold tabular-nums tracking-tight">{value}</span>
          {delta ? <DeltaBadge delta={delta} /> : null}
        </div>
        {coverage ? (
          <p className="text-[11px] text-muted-foreground">{coverage}</p>
        ) : null}
      </CardContent>
    </Card>
  );

  if (drilldownHref) {
    return (
      <Link href={drilldownHref} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
