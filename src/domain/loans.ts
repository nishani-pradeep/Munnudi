/**
 * Loan amortization (standard reducing-balance EMI), pure and unit-tested.
 *
 * This is the formalized version of the informal loop already hand-rolled
 * once in src/db/seed/demo.ts — one implementation, tested, reused by both
 * the Loans screen (to show/confirm the next expected EMI) and, optionally,
 * the demo seed.
 *
 * Deliberately NOT bank-grade: it does not model mid-cycle rate changes or
 * exact day-count conventions. For a personal single-property tracker this
 * level of precision is the right trade-off, not a shortcut — noted here
 * rather than silently assumed. See docs/IMPLEMENTATION_PLAN.md.
 */
import { paise, ZERO, type Paise } from "./money";

export type AmortizationStep = {
  /** 0-based: 0 is the next payment from `outstanding`. */
  monthIndex: number;
  emi: Paise;
  interest: Paise;
  principal: Paise;
  closingBalance: Paise;
};

function monthlyRate(annualRatePercent: number): number {
  return annualRatePercent / 100 / 12;
}

/**
 * EMI = P * i * (1+i)^n / ((1+i)^n - 1), i = monthly rate, n = remaining
 * tenure in months. EMI = P / n when the rate is exactly zero.
 * Returns ZERO when there is nothing left to amortize (n <= 0 or P <= 0).
 */
export function computeEmi(
  outstanding: Paise,
  annualRatePercent: number,
  remainingTenureMonths: number,
): Paise {
  if (remainingTenureMonths <= 0 || outstanding <= 0) return ZERO;
  const i = monthlyRate(annualRatePercent);
  if (i === 0) {
    return paise(Math.round(outstanding / remainingTenureMonths));
  }
  const factor = Math.pow(1 + i, remainingTenureMonths);
  const emi = (outstanding * i * factor) / (factor - 1);
  return paise(Math.round(emi));
}

/**
 * The full remaining schedule from `outstanding` forward. Each step's
 * principal is capped at the remaining balance, so the final month's
 * rounding remainder can never push the balance negative.
 */
export function generateAmortizationSchedule(
  outstanding: Paise,
  annualRatePercent: number,
  remainingTenureMonths: number,
): AmortizationStep[] {
  if (remainingTenureMonths <= 0 || outstanding <= 0) return [];

  const emi = computeEmi(outstanding, annualRatePercent, remainingTenureMonths);
  const i = monthlyRate(annualRatePercent);

  const steps: AmortizationStep[] = [];
  let balance = outstanding;

  for (let month = 0; month < remainingTenureMonths; month++) {
    if (balance <= 0) break;
    const interest = paise(Math.round(balance * i));
    const rawPrincipal = emi - interest;
    const principal = paise(Math.max(0, Math.min(rawPrincipal, balance)));
    balance = paise(balance - principal);
    steps.push({
      monthIndex: month,
      emi: paise(principal + interest),
      interest,
      principal,
      closingBalance: balance,
    });
  }

  return steps;
}

/** The single next payment due, or null once the schedule is exhausted. */
export function nextExpectedRepayment(
  outstanding: Paise,
  annualRatePercent: number,
  remainingTenureMonths: number,
): AmortizationStep | null {
  const [first] = generateAmortizationSchedule(
    outstanding,
    annualRatePercent,
    remainingTenureMonths,
  );
  return first ?? null;
}
