/**
 * Money handling for Munnudi.
 *
 * INVARIANT: money is NEVER represented as a floating-point number of rupees.
 * Postgres stores `numeric(14,2)`; the driver hands us a decimal *string*; we
 * parse that exactly into an integer number of paise and do all arithmetic on
 * integers. Addition and subtraction are therefore always exact.
 *
 * Integer paise is safe in a JS number up to Number.MAX_SAFE_INTEGER / 100,
 * i.e. ~Rs 90 trillion, so BigInt is unnecessary.
 *
 * See docs/IMPLEMENTATION_PLAN.md, decision 2.
 */

/** An integer count of paise (1/100 rupee). Branded so it cannot be confused with rupees. */
export type Paise = number & { readonly __brand: "Paise" };

export const ZERO = 0 as Paise;

/** Assert-and-brand an integer paise value. */
export function paise(n: number): Paise {
  if (!Number.isInteger(n)) {
    throw new RangeError(`Paise must be an integer, received ${n}`);
  }
  if (!Number.isSafeInteger(n)) {
    throw new RangeError(`Paise value ${n} exceeds safe integer range`);
  }
  return n as Paise;
}

/** Build paise from a whole-rupee amount. Convenience for seeds and tests. */
export function fromRupees(rupees: number): Paise {
  return paise(Math.round(rupees * 100));
}

const NUMERIC_RE = /^(-)?(\d+)(?:\.(\d{1,}))?$/;

/**
 * Parse a Postgres `numeric` string into exact paise.
 *
 * Deliberately avoids `parseFloat(s) * 100`, which is lossy:
 * `parseFloat("1234567.89") * 100 === 123456788.99999999`.
 * We operate on the digits directly, so there is no float step at all.
 */
export function parsePaise(numericString: string): Paise {
  const raw = numericString.trim();
  const m = NUMERIC_RE.exec(raw);
  if (!m) {
    throw new TypeError(`Not a valid numeric string: ${JSON.stringify(numericString)}`);
  }
  const [, sign, whole, frac = ""] = m;
  if (frac.length > 2) {
    // numeric(14,2) can never produce this; if it appears, a caller passed
    // something that is not a money column and we must not silently truncate.
    throw new RangeError(`Money value has more than 2 decimal places: ${raw}`);
  }
  const hundredths = frac.padEnd(2, "0");
  const magnitude = Number(`${whole}${hundredths}`);
  const value = sign === "-" ? -magnitude : magnitude;
  return paise(value);
}

/** Render paise as a Postgres `numeric(14,2)` literal, e.g. 12345 -> "123.45". */
export function toNumericString(p: Paise): string {
  const neg = p < 0;
  const abs = Math.abs(p);
  const whole = Math.trunc(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${neg ? "-" : ""}${whole}.${frac}`;
}

export function add(a: Paise, b: Paise): Paise {
  return paise(a + b);
}

export function subtract(a: Paise, b: Paise): Paise {
  return paise(a - b);
}

export function sum(values: readonly Paise[]): Paise {
  let total = 0;
  for (const v of values) total += v;
  return paise(total);
}

/** Floor at zero. Used by Rent Pending, which the PRD floors per month. */
export function clampAtZero(p: Paise): Paise {
  return p < 0 ? ZERO : p;
}

export function isNegative(p: Paise): boolean {
  return p < 0;
}

/*
 * Formatting.
 *
 * PRD 15 requires Indian digit grouping (Rs 1,23,456 - lakh/crore), not Western
 * grouping. That depends on full ICU data being present in the runtime. When ICU
 * is missing the failure is SILENT: you get "1,23,456" degrading to "123,456".
 * money.test.ts asserts the exact output string so this can never regress unnoticed.
 *
 * `currencyDisplay: "narrowSymbol"` is pinned because the default renders "INR"
 * rather than the rupee sign in some environments.
 */
const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const INR_WHOLE = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Format paise as INR, e.g. 12345600 -> "Rs 1,23,456.00". Negatives are sign-prefixed. */
export function formatInr(p: Paise): string {
  return INR.format(p / 100);
}

/** Format paise as INR with no paise digits, for dense dashboard cards. */
export function formatInrWhole(p: Paise): string {
  return INR_WHOLE.format(Math.round(p / 100));
}
