"use client";

import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useAction } from "next-safe-action/hooks";
import { Button } from "@/components/ui/button";
import { restoreUtilityAction } from "@/server/actions/utilities";

export function RestoreUtilityButton({ recordId }: { recordId: string }) {
  const { execute, isTransitioning } = useAction(restoreUtilityAction, {
    onSuccess: () => toast.success("Utility record restored"),
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
