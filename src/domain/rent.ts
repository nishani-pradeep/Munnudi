/**
 * Pure "what should this month's unit census look like" logic (decision 4).
 *
 * No DB access here. The repository layer fetches the inputs (active units,
 * last month's census rows, all rent versions) and does the actual insert;
 * this function only decides WHAT to insert, which is what makes it directly
 * unit-testable against PRD 22's occupancy/rent-history scenarios.
 */
import { compareMonths, type MonthKey } from "./month";
import { ZERO, type Paise } from "./money";

export type OccupancyStatus = "SELF_OCCUPIED" | "OCCUPIED" | "VACANT";

export type UnitForCensus = {
  unitId: string;
  defaultOccupancyStatus: OccupancyStatus;
};

/** A previous month's census row, for carry-forward. */
export type PriorCensusRow = {
  unitId: string;
  occupancySnapshot: OccupancyStatus;
};

export type RentVersion = {
  unitId: string;
  effectiveMonth: MonthKey;
  expectedRent: Paise;
};

export type CensusRowToInsert = {
  unitId: string;
  month: MonthKey;
  occupancySnapshot: OccupancyStatus;
  expectedRentSnapshot: Paise;
};

/**
 * The rent version applicable to `month`: the version with the latest
 * effectiveMonth that is <= month. PRD 7.1: rent changes apply from their
 * effective month forward, never rewriting earlier months.
 */
export function applicableRent(
  unitId: string,
  month: MonthKey,
  versions: readonly RentVersion[],
): Paise {
  let best: RentVersion | undefined;
  for (const v of versions) {
    if (v.unitId !== unitId) continue;
    if (compareMonths(v.effectiveMonth, month) > 0) continue; // not yet effective
    if (!best || compareMonths(v.effectiveMonth, best.effectiveMonth) > 0) best = v;
  }
  return best ? best.expectedRent : ZERO;
}

/**
 * Compute the census rows to insert for `month`. Idempotent: the repository
 * inserts with ON CONFLICT DO NOTHING, so calling this again for a month that
 * already has rows is a no-op against entered data (decision 4).
 *
 * Occupancy carries forward from the prior month's snapshot; only a unit with
 * no prior row (its first month in the census) falls back to the unit's
 * default occupancy.
 */
export function computeCensusForMonth(
  month: MonthKey,
  activeUnits: readonly UnitForCensus[],
  priorMonthRows: readonly PriorCensusRow[],
  rentVersions: readonly RentVersion[],
): CensusRowToInsert[] {
  const priorByUnit = new Map(priorMonthRows.map((r) => [r.unitId, r]));

  return activeUnits.map((unit) => {
    const prior = priorByUnit.get(unit.unitId);
    const occupancySnapshot = prior ? prior.occupancySnapshot : unit.defaultOccupancyStatus;
    return {
      unitId: unit.unitId,
      month,
      occupancySnapshot,
      expectedRentSnapshot: applicableRent(unit.unitId, month, rentVersions),
    };
  });
}
