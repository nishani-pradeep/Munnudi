"use client";

import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useAction } from "next-safe-action/hooks";
import { Button } from "@/components/ui/button";
import { restoreLoanRepaymentAction } from "@/server/actions/loans";

export function RestoreRepaymentButton({ repaymentId }: { repaymentId: string }) {
  const { execute, isTransitioning } = useAction(restoreLoanRepaymentAction, {
    onSuccess: () => toast.success("Repayment restored"),
    onError: ({ error }) => toast.error(error.serverError ?? "Could not restore"),
  });

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={isTransitioning}
      onClick={() => execute({ repaymentId })}
    >
      <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
      Restore
    </Button>
  );
}
