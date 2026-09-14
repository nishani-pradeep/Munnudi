"use client";

import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAction } from "next-safe-action/hooks";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteExpenseAction } from "@/server/actions/expenses";

/** PRD 15: every destructive action requires confirmation. Soft delete, so it's recoverable via "Recently deleted". */
export function DeleteExpenseButton({ expenseId }: { expenseId: string }) {
  const { execute, isTransitioning } = useAction(deleteExpenseAction, {
    onSuccess: () => toast.success("Expense deleted — recoverable below for a while"),
    onError: ({ error }) => toast.error(error.serverError ?? "Could not delete"),
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Delete expense" disabled={isTransitioning}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
          <AlertDialogDescription>
            It will disappear from this month&apos;s totals but can be restored from
            &quot;Recently deleted&quot; below.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => execute({ expenseId })}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
