"use client";

import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useAction } from "next-safe-action/hooks";
import { Button } from "@/components/ui/button";
import { restoreLoanAction } from "@/server/actions/loans";

export function RestoreLoanButton({ loanId }: { loanId: string }) {
  const { execute, isTransitioning } = useAction(restoreLoanAction, {
    onSuccess: () => toast.success("Loan restored"),
    onError: ({ error }) =>
      toast.error(error.serverError ?? "Could not restore loan"),
  });

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5"
      disabled={isTransitioning}
      onClick={() => execute({ loanId })}
    >
      <RotateCcw className="h-3.5 w-3.5" />
      Restore
    </Button>
  );
}
