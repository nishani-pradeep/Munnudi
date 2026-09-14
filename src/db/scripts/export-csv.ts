/**
 * pnpm db:export — dumps every table to CSV under /exports (git-ignored), for
 * a human-readable copy of the data independent of Postgres. Distinct from
 * the polished in-app CSV export UI (Phase 8), which exports curated
 * datasets for the user rather than raw tables for disaster recovery.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import "../env";
import { db } from "../client";
import * as schema from "../schema";
import { getTableName, getTableColumns } from "drizzle-orm";

const TABLES = [
  schema.properties,
  schema.units,
  schema.unitRentVersions,
  schema.unitMonthRecords,
  schema.utilityRecords,
  schema.expenseCategories,
  schema.expenses,
  schema.loans,
  schema.loanRepayments,
  schema.monthlyStatus,
  schema.auditLog,
];

function toCsvValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const exportsDir = join(process.cwd(), "exports");
  mkdirSync(exportsDir, { recursive: true });

  for (const table of TABLES) {
    const name = getTableName(table);
    const columns = Object.keys(getTableColumns(table));
    const rows = await db.select().from(table as never);

    const lines = [
      columns.join(","),
      ...rows.map((row: Record<string, unknown>) =>
        columns.map((c) => toCsvValue(row[c])).join(","),
      ),
    ];

    const outFile = join(exportsDir, `${name}.csv`);
    writeFileSync(outFile, lines.join("\n") + "\n");
    console.log(`${name}: ${rows.length} rows -> ${outFile}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
