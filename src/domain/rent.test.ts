import { describe, it, expect } from "vitest";
import { computeCensusForMonth, applicableRent, type RentVersion } from "./rent";
import { monthKey } from "./month";
import { fromRupees, ZERO } from "./money";

const U1 = "unit-1";
const U2 = "unit-2";

describe("applicableRent", () => {
  const versions: RentVersion[] = [
    { unitId: U1, effectiveMonth: monthKey("2025-01"), expectedRent: fromRupees(10000) },
    { unitId: U1, effectiveMonth: monthKey("2025-07"), expectedRent: fromRupees(12000) },
  ];

  it("uses the latest version effective on or before the month", () => {
    expect(applicableRent(U1, monthKey("2025-06"), versions)).toBe(fromRupees(10000));
    expect(applicableRent(U1, monthKey("2025-07"), versions)).toBe(fromRupees(12000));
    expect(applicableRent(U1, monthKey("2025-12"), versions)).toBe(fromRupees(12000));
  });

  it("PRD 22: a rent increase effective July changes July onward only", () => {
    // January through June must be unaffected by the July change.
    for (const m of ["2025-01", "2025-02", "2025-03", "2025-04", "2025-05", "2025-06"]) {
      expect(applicableRent(U1, monthKey(m), versions)).toBe(fromRupees(10000));
    }
    for (const m of ["2025-07", "2025-08", "2025-12"]) {
      expect(applicableRent(U1, monthKey(m), versions)).toBe(fromRupees(12000));
    }
  });

  it("returns zero when no version is effective yet", () => {
    expect(applicableRent(U1, monthKey("2024-12"), versions)).toBe(ZERO);
  });

  it("ignores versions for other units", () => {
    expect(applicableRent(U2, monthKey("2025-07"), versions)).toBe(ZERO);
  });
});

describe("computeCensusForMonth", () => {
  const versions: RentVersion[] = [
    { unitId: U1, effectiveMonth: monthKey("2025-01"), expectedRent: fromRupees(15000) },
    { unitId: U2, effectiveMonth: monthKey("2025-01"), expectedRent: fromRupees(9000) },
  ];

  it("falls back to the unit default occupancy on its first month", () => {
    const rows = computeCensusForMonth(
      monthKey("2025-01"),
      [
        { unitId: U1, defaultOccupancyStatus: "OCCUPIED" },
        { unitId: U2, defaultOccupancyStatus: "SELF_OCCUPIED" },
      ],
      [], // no prior month yet
      versions,
    );
    expect(rows).toEqual([
      {
        unitId: U1,
        month: "2025-01",
        occupancySnapshot: "OCCUPIED",
        expectedRentSnapshot: fromRupees(15000),
      },
      {
        unitId: U2,
        month: "2025-01",
        occupancySnapshot: "SELF_OCCUPIED",
        expectedRentSnapshot: fromRupees(9000),
      },
    ]);
  });

  it("carries occupancy forward from the prior month, not from the unit default", () => {
    const rows = computeCensusForMonth(
      monthKey("2025-02"),
      [{ unitId: U1, defaultOccupancyStatus: "OCCUPIED" }],
      [{ unitId: U1, occupancySnapshot: "SELF_OCCUPIED" }], // became self-occupied in Jan
      versions,
    );
    expect(rows[0].occupancySnapshot).toBe("SELF_OCCUPIED");
  });

  it(
    "PRD 22: a unit becoming self-occupied does not retroactively alter its billable snapshot " +
      "in months already generated — this function only ever computes the NEXT month, never rewrites the past",
    () => {
      // Generating March from February's SELF_OCCUPIED snapshot must not be
      // influenced by knowledge of what happens in April; it only reads prior state.
      const rows = computeCensusForMonth(
        monthKey("2025-03"),
        [{ unitId: U1, defaultOccupancyStatus: "OCCUPIED" }],
        [{ unitId: U1, occupancySnapshot: "SELF_OCCUPIED" }],
        versions,
      );
      expect(rows[0].occupancySnapshot).toBe("SELF_OCCUPIED");
      expect(rows[0].month).toBe("2025-03");
    },
  );

  it("still snapshots the applicable rent for a self-occupied unit (future opportunity-cost view)", () => {
    const rows = computeCensusForMonth(
      monthKey("2025-01"),
      [{ unitId: U2, defaultOccupancyStatus: "SELF_OCCUPIED" }],
      [],
      versions,
    );
    expect(rows[0].expectedRentSnapshot).toBe(fromRupees(9000));
  });

  it("produces one row per active unit, independent of iteration order", () => {
    const rows = computeCensusForMonth(
      monthKey("2025-01"),
      [
        { unitId: U2, defaultOccupancyStatus: "VACANT" },
        { unitId: U1, defaultOccupancyStatus: "OCCUPIED" },
      ],
      [],
      versions,
    );
    expect(rows.map((r) => r.unitId).sort()).toEqual([U1, U2].sort());
  });
});
