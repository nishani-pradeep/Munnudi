import { currentMonthKey, type MonthKey } from "@/domain/month";

/**
 * Timezone used to resolve "the current month".
 *
 * This must be the property's timezone, not the server's. On a UTC host,
 * 2025-04-01 02:00 IST is still 2025-03-31 UTC, so a naive resolver would open
 * the app to March for the first 5.5 hours of every month.
 *
 * Moves into the `properties` table in Phase 2; env var until then.
 */
export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "Asia/Kolkata";

export function resolveCurrentMonth(): MonthKey {
  return currentMonthKey(APP_TIMEZONE);
}
