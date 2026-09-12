import { isMonthKey, type MonthKey } from "@/domain/month";
import { resolveCurrentMonth } from "./app-config";

/** Search-param key carrying the selected month, e.g. /rent?m=2026-09 */
export const MONTH_PARAM = "m";

/**
 * Resolve the selected month from a URL search param, falling back to the
 * current month. Invalid values fall back rather than throwing, so a
 * hand-edited URL degrades gracefully instead of 500ing.
 */
export function monthFromParam(raw: string | string[] | undefined): MonthKey {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value === "string" && isMonthKey(value)) return value;
  return resolveCurrentMonth();
}

/** Build a href preserving the selected month. */
export function withMonth(href: string, month: MonthKey): string {
  return `${href}?${MONTH_PARAM}=${month}`;
}

/** Shape of awaited `searchParams` in an App Router page. */
export type SearchParams = Record<string, string | string[] | undefined>;
