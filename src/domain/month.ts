/**
 * Month handling for Munnudi.
 *
 * A month is stored and passed around as the string "YYYY-MM" (branded MonthKey),
 * NOT as a Date and NOT as a Postgres `date`.
 *
 * Why: pg parses a `date` into a JS Date at LOCAL midnight. In IST, "2025-03-01"
 * becomes Mar 1 00:00+05:30, and `.toISOString().slice(0,7)` yields "2025-02" —
 * March data silently files itself under February, at every JSON/CSV/chart
 * boundary. Since all computation happens in TypeScript (see the pure domain
 * engine), SQL date arithmetic buys us nothing, so text wins.
 *
 * Zero-padding means lexicographic order IS chronological order.
 *
 * See docs/IMPLEMENTATION_PLAN.md, decision 3.
 */

export type MonthKey = string & { readonly __brand: "MonthKey" };

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isMonthKey(value: string): value is MonthKey {
  return MONTH_RE.test(value);
}

/** Validate-and-brand a "YYYY-MM" string. */
export function monthKey(value: string): MonthKey {
  if (!isMonthKey(value)) {
    throw new TypeError(`Invalid month key ${JSON.stringify(value)}; expected "YYYY-MM"`);
  }
  return value;
}

export function fromParts(year: number, month1to12: number): MonthKey {
  if (!Number.isInteger(year) || year < 1900 || year > 9999) {
    throw new RangeError(`Invalid year ${year}`);
  }
  if (!Number.isInteger(month1to12) || month1to12 < 1 || month1to12 > 12) {
    throw new RangeError(`Invalid month ${month1to12}`);
  }
  return `${String(year).padStart(4, "0")}-${String(month1to12).padStart(2, "0")}` as MonthKey;
}

export function toParts(m: MonthKey): { year: number; month: number } {
  return { year: Number(m.slice(0, 4)), month: Number(m.slice(5, 7)) };
}

/** Total months since year 0 — the basis for arithmetic and differences. */
function ordinal(m: MonthKey): number {
  const { year, month } = toParts(m);
  return year * 12 + (month - 1);
}

function fromOrdinal(n: number): MonthKey {
  return fromParts(Math.floor(n / 12), (n % 12) + 1);
}

export function addMonths(m: MonthKey, delta: number): MonthKey {
  return fromOrdinal(ordinal(m) + delta);
}

export function previousMonth(m: MonthKey): MonthKey {
  return addMonths(m, -1);
}

export function nextMonth(m: MonthKey): MonthKey {
  return addMonths(m, 1);
}

/** Negative if a < b, 0 if equal, positive if a > b. */
export function compareMonths(a: MonthKey, b: MonthKey): number {
  return ordinal(a) - ordinal(b);
}

/** Count of months from a to b inclusive of a, exclusive of b. */
export function monthsBetween(a: MonthKey, b: MonthKey): number {
  return ordinal(b) - ordinal(a);
}

/**
 * Dense, inclusive list of months from `from` to `to`.
 * Charts and averages need every month present, including ones with no records,
 * so that "not entered" stays distinguishable from zero.
 */
export function monthRange(from: MonthKey, to: MonthKey): MonthKey[] {
  if (compareMonths(from, to) > 0) return [];
  const out: MonthKey[] = [];
  for (let n = ordinal(from); n <= ordinal(to); n++) out.push(fromOrdinal(n));
  return out;
}

/**
 * The current month in a given IANA timezone.
 *
 * Never use `new Date().toISOString()` for this: on a UTC server, 2025-04-01
 * 02:00 IST is still 2025-03-31 UTC, so the app would open to March for the
 * first 5.5 hours of every month.
 */
export function currentMonthKey(timeZone: string, now: Date = new Date()): MonthKey {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  if (!year || !month) throw new Error(`Could not resolve current month for timezone ${timeZone}`);
  return monthKey(`${year}-${month}`);
}

const LABEL = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const LABEL_SHORT = new Intl.DateTimeFormat("en-IN", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

/** "March 2025" — for headings and the month selector. */
export function formatMonthLong(m: MonthKey): string {
  const { year, month } = toParts(m);
  return LABEL.format(new Date(Date.UTC(year, month - 1, 1)));
}

/** "Mar 25" — for dense chart axes. */
export function formatMonthShort(m: MonthKey): string {
  const { year, month } = toParts(m);
  return LABEL_SHORT.format(new Date(Date.UTC(year, month - 1, 1)));
}
