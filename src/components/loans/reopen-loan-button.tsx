"use client";

import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useAction } from "next-safe-action/hooks";
import { Button } from "@/components/ui/button";
import { reopenLoanAction } from "@/server/actions/loans";

export function ReopenLoanButton({ loanId }: { loanId: string }) {
  const { execute, isTransitioning } = useAction(reopenLoanAction, {
    onSuccess: () => toast.success("Loan reopened"),
    onError: ({ error }) => toast.error(error.serverError ?? "Could not reopen"),
  });

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isTransitioning}
      onClick={() => execute({ loanId })}
    >
      <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
      Reopen
    </Button>
  );
}
