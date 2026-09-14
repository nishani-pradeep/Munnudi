import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  NOT_BILLABLE: "Self Occupied",
  UNSET: "Not entered",
  UNPAID: "Unpaid",
  PARTIAL: "Partial",
  PAID: "Paid",
  OVERPAID: "Overpaid",
};

const STATUS_CLASS: Record<string, string> = {
  NOT_BILLABLE: "bg-muted text-muted-foreground border-transparent",
  UNSET: "bg-muted text-muted-foreground border-dashed",
  UNPAID: "bg-destructive/10 text-destructive border-destructive/20",
  PARTIAL: "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400",
  PAID: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
  OVERPAID: "bg-sky-500/10 text-sky-600 border-sky-500/20 dark:text-sky-400",
};

/** PRD 15: consistent status badges across the app. */
export function RentStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn("font-normal", STATUS_CLASS[status])}>
      {STATUS_LABEL[status] ?? status}
    </Badge>
  );
}
