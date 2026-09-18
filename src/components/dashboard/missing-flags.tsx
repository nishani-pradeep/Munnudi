import Link from "next/link";
import { AlertTriangle, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { MissingDataFlag } from "@/domain/kpi";

type Props = {
  flags: MissingDataFlag[];
};

export function MissingFlags({ flags }: Props) {
  if (flags.length === 0) return null;

  return (
    <div className="mb-6 space-y-2">
      {flags.map((flag, i) => (
        <Alert key={i} variant={flag.severity === "warning" ? "destructive" : "default"}>
          {flag.severity === "warning" ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <Info className="h-4 w-4" />
          )}
          <AlertTitle>
            <Link href={flag.href} className="hover:underline">
              {flag.message}
            </Link>
          </AlertTitle>
          <AlertDescription>
            <Link href={flag.href} className="text-xs">
              Go to section &rarr;
            </Link>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
