import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

type Props = {
  icon: LucideIcon;
  title: string;
  /** PRD section 15: empty states explain what to enter next, never a blank chart. */
  nextStep: string;
  children?: ReactNode;
};

export function EmptyState({ icon: Icon, title, nextStep, children }: Props) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 px-6 py-14 text-center">
        <div className="rounded-full bg-muted p-3">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">{title}</p>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">{nextStep}</p>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
