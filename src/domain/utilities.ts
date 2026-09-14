/**
 * Utility usage calculation, pure and unit-tested.
 *
 * Readings are plain numbers, not Paise — kWh/kL are not currency (decision
 * 2). "Not entered" must never render as 0 (decision 1), so a missing
 * reading returns null, never 0.
 */

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * usage_override always wins when present (a manually corrected value).
 * Otherwise current - previous when both readings are entered. null when
 * either is missing — distinct from a genuine zero-usage month.
 */
export function computeUsage(
  previousReading: number | null,
  currentReading: number | null,
  usageOverride: number | null,
): number | null {
  if (usageOverride !== null) return usageOverride;
  if (previousReading === null || currentReading === null) return null;
  return round3(currentReading - previousReading);
}
