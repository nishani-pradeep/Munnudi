"use client";

import { useSearchParams } from "next/navigation";
import { isMonthKey, type MonthKey } from "@/domain/month";
import { MONTH_PARAM } from "./month-param";

/**
 * The selected month, read from the URL.
 *
 * Layouts do not receive searchParams in the App Router, so the shell reads the
 * month client-side. `fallback` is the current month resolved on the server in
 * the property timezone — never compute it in the browser, whose clock and
 * timezone are not authoritative.
 */
export function useSelectedMonth(fallback: MonthKey): MonthKey {
  const params = useSearchParams();
  const raw = params.get(MONTH_PARAM);
  return raw && isMonthKey(raw) ? raw : fallback;
}
