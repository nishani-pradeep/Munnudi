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
import { deleteLoanRepaymentAction } from "@/server/actions/loans";

export function DeleteRepaymentButton({ repaymentId }: { repaymentId: string }) {
  const { execute, isTransitioning } = useAction(deleteLoanRepaymentAction, {
    onSuccess: () => toast.success("Repayment deleted — recoverable below"),
    onError: ({ error }) => toast.error(error.serverError ?? "Could not delete"),
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Delete repayment" disabled={isTransitioning}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this repayment?</AlertDialogTitle>
          <AlertDialogDescription>
            It will be soft-deleted and can be restored from &ldquo;Recently deleted&rdquo;.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => execute({ repaymentId })}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
