"use client";

import { usePathname } from "next/navigation";
import { MonthSwitcher } from "./month-switcher";
import { NAV_ITEMS } from "@/lib/nav";
import type { MonthKey } from "@/domain/month";

const NON_MONTH_PATHS = new Set(
  NAV_ITEMS.filter((n) => !n.monthScoped).map((n) => n.href),
);

export function MonthSwitcherGuard({ currentMonth }: { currentMonth: MonthKey }) {
  const pathname = usePathname();
  if (NON_MONTH_PATHS.has(pathname)) return null;
  return <MonthSwitcher currentMonth={currentMonth} />;
}
