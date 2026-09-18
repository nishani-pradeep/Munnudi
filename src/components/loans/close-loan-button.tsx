"use client";

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
import { closeLoanAction } from "@/server/actions/loans";

type Props = {
  loanId: string;
  loanName: string;
  month: string;
  outstandingLabel: string;
  trigger?: React.ReactNode;
};

export function CloseLoanButton({ loanId, loanName, month, outstandingLabel, trigger }: Props) {
  const { execute, isTransitioning } = useAction(closeLoanAction, {
    onSuccess: () => toast.success("Loan closed"),
    onError: ({ error }) => toast.error(error.serverError ?? "Could not close loan"),
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="sm" disabled={isTransitioning}>
            Close loan
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Close &ldquo;{loanName}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            Outstanding: {outstandingLabel}. The loan will move to the &ldquo;Closed&rdquo;
            section but can be reopened later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => execute({ loanId, closedMonth: month })}>
            Close
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
