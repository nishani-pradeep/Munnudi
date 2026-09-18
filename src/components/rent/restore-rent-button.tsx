"use client";

import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useAction } from "next-safe-action/hooks";
import { Button } from "@/components/ui/button";
import { restoreRentAction } from "@/server/actions/rent";

export function RestoreRentButton({ recordId }: { recordId: string }) {
  const { execute, isTransitioning } = useAction(restoreRentAction, {
    onSuccess: () => toast.success("Rent entry restored"),
    onError: ({ error }) => toast.error(error.serverError ?? "Could not restore"),
  });

  return (
    <Button
      variant="ghost"
      size="sm"
      className="gap-1.5"
      disabled={isTransitioning}
      onClick={() => execute({ recordId })}
    >
      <RotateCcw className="h-3.5 w-3.5" />
      Restore
    </Button>
  );
}
