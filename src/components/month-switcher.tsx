"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { addMonths, compareMonths, formatMonthLong, type MonthKey } from "@/domain/month";
import { MONTH_PARAM } from "@/lib/month-param";
import { useSelectedMonth } from "@/lib/use-selected-month";

/**
 * Persistent month selector for the app shell (PRD section 15).
 *
 * The month lives in the URL so it survives refresh, is shareable, and is
 * readable by server components. Past months are always reachable, which is
 * what makes backfilling prior months possible with no extra tooling.
 */
export function MonthSwitcher({ currentMonth }: { currentMonth: MonthKey }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const month = useSelectedMonth(currentMonth);

  function goTo(next: MonthKey) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(MONTH_PARAM, next);
    router.push(`${pathname}?${params.toString()}`);
  }

  const isFuture = compareMonths(month, currentMonth) > 0;
  const isCurrent = compareMonths(month, currentMonth) === 0;

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Previous month"
        onClick={() => goTo(addMonths(month, -1))}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <div className="flex min-w-[9.5rem] items-center justify-center gap-2">
        <span className="text-sm font-medium tabular-nums">{formatMonthLong(month)}</span>
        {isFuture ? (
          <Badge variant="outline" className="text-[10px]">
            Future
          </Badge>
        ) : null}
      </div>

      <Button
        variant="ghost"
        size="icon"
        aria-label="Next month"
        onClick={() => goTo(addMonths(month, 1))}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {!isCurrent ? (
        <Button
          variant="ghost"
          size="sm"
          className="ml-1 text-xs"
          onClick={() => goTo(currentMonth)}
        >
          Today
        </Button>
      ) : null}
    </div>
  );
}
