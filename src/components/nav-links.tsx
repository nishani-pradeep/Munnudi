"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/lib/nav";
import { MONTH_PARAM } from "@/lib/month-param";
import { useSelectedMonth } from "@/lib/use-selected-month";
import type { MonthKey } from "@/domain/month";

type Props = {
  currentMonth: MonthKey;
  onNavigate?: () => void;
};

export function NavLinks({ currentMonth, onNavigate }: Props) {
  const pathname = usePathname();
  const month = useSelectedMonth(currentMonth);

  return (
    <nav className="flex flex-col gap-0.5" aria-label="Main">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        // Month-scoped pages carry the selected month across navigation so the
        // shell's month selector stays meaningful as you move between sections.
        const href = item.monthScoped ? `${item.href}?${MONTH_PARAM}=${month}` : item.href;
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              active
                ? "bg-accent font-medium text-accent-foreground"
                : "font-normal text-muted-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
