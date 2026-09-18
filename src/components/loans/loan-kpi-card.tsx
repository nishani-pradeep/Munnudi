import { Card, CardContent } from "@/components/ui/card";

type Props = { title: string; value: string; subtitle?: string };

export function LoanKpiCard({ title, value, subtitle }: Props) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {title}
        </p>
        <p className="text-2xl font-semibold tabular-nums mt-1">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}
