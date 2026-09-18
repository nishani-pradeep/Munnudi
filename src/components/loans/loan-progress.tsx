import { Progress } from "@/components/ui/progress";

type Props = { originalPrincipal: number; totalRepaid: number };

/**
 * Loan progress bar. Props are plain numbers (paise) for client-component
 * serialization compatibility.
 */
export function LoanProgress({ originalPrincipal, totalRepaid }: Props) {
  if (originalPrincipal <= 0) return null;
  const percent = Math.min(100, Math.round((totalRepaid / originalPrincipal) * 100));
  return (
    <div className="flex items-center gap-2">
      <Progress value={percent} className="h-2 flex-1" />
      <span className="text-xs tabular-nums text-muted-foreground whitespace-nowrap">
        {percent}% repaid
      </span>
    </div>
  );
}
