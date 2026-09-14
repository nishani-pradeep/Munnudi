"use client";

import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useAction } from "next-safe-action/hooks";
import { Button } from "@/components/ui/button";
import { restoreExpenseAction } from "@/server/actions/expenses";

export function RestoreExpenseButton({ expenseId }: { expenseId: string }) {
  const { execute, isTransitioning } = useAction(restoreExpenseAction, {
    onSuccess: () => toast.success("Expense restored"),
    onError: ({ error }) => toast.error(error.serverError ?? "Could not restore"),
  });

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5"
      disabled={isTransitioning}
      onClick={() => execute({ expenseId })}
    >
      <RotateCcw className="h-3.5 w-3.5" />
      Restore
    </Button>
  );
}
