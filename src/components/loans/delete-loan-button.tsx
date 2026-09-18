"use client";

import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAction } from "next-safe-action/hooks";
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
import { deleteLoanAction } from "@/server/actions/loans";

type Props = {
  loanId: string;
  loanName: string;
  trigger?: React.ReactNode;
};

export function DeleteLoanButton({ loanId, loanName, trigger }: Props) {
  const { execute, isTransitioning } = useAction(deleteLoanAction, {
    onSuccess: () =>
      toast.success("Loan deleted — recoverable from 'Recently deleted' below"),
    onError: ({ error }) =>
      toast.error(error.serverError ?? "Could not delete loan"),
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm text-destructive"
            disabled={isTransitioning}
          >
            <Trash2 className="h-4 w-4" />
            Delete loan
          </button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete &ldquo;{loanName}&rdquo;?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This loan will be removed from all views and calculations. It can be
            restored from &ldquo;Recently deleted&rdquo; below.
            <br />
            <br />
            Note: All repayments must be deleted first.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => execute({ loanId })}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
