/**
 * pnpm db:backup — dumps the whole database to a timestamped file under
 * /backups (git-ignored). Uses `docker compose exec` so it works without a
 * local pg_dump install.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import "../env";

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

const backupsDir = join(process.cwd(), "backups");
mkdirSync(backupsDir, { recursive: true });
const outFile = join(backupsDir, `munnudi-${timestamp()}.sql`);

console.log(`Backing up munnudi-db -> ${outFile}`);
// --data-only: schema is owned by migrations (drizzle/*.sql), never by a
// backup file. Restoring is always `pnpm db:reset && pnpm db:restore <file>`
// — reset recreates the schema fresh, restore loads data into it. A
// schema+data dump would conflict with that already-migrated schema on
// restore ("relation already exists").
const dump = execFileSync(
  "docker",
  [
    "compose",
    "exec",
    "-T",
    "db",
    "pg_dump",
    "-U",
    "munnudi",
    "-d",
    "munnudi",
    "--data-only",
    "--disable-triggers",
    // The "drizzle" schema holds only __drizzle_migrations (migration-runner
    // bookkeeping, recreated fresh by `pnpm db:migrate`) — not application
    // data, and restoring it collides with the just-applied migration state.
    "--exclude-schema=drizzle",
  ],
  { maxBuffer: 1024 * 1024 * 512 },
);
writeFileSync(outFile, dump);
console.log(`Done: ${outFile} (${(dump.length / 1024).toFixed(0)} KB)`);
