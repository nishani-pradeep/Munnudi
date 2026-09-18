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
import { deleteUtilityAction } from "@/server/actions/utilities";

/** PRD 15: every destructive action requires confirmation. Soft delete, so it's recoverable via "Recently deleted". */
export function DeleteUtilityButton({ recordId }: { recordId: string }) {
  const { execute, isTransitioning } = useAction(deleteUtilityAction, {
    onSuccess: () => toast.success("Utility record deleted — recoverable below for a while"),
    onError: ({ error }) => toast.error(error.serverError ?? "Could not delete"),
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Delete utility record" disabled={isTransitioning}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this utility record?</AlertDialogTitle>
          <AlertDialogDescription>
            It will disappear from this month&apos;s data but can be restored from &quot;Recently
            deleted&quot; below.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => execute({ recordId })}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
