/**
 * pnpm db:restore <file> — restores a pg_dump file created by `pnpm db:backup`
 * into the running container. Drops and recreates the schema first, so this
 * is destructive to whatever is currently in the database.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import "../env";

const file = process.argv[2];
if (!file || !existsSync(file)) {
  console.error("Usage: pnpm db:restore <path-to-backup.sql>");
  process.exit(1);
}

console.log(`Restoring ${file} into munnudi-db (this replaces all current data) ...`);
const sql = readFileSync(file);

execFileSync(
  "docker",
  [
    "compose",
    "exec",
    "-T",
    "db",
    "psql",
    "-U",
    "munnudi",
    "-d",
    "munnudi",
    "-v",
    "ON_ERROR_STOP=1",
  ],
  { input: sql, stdio: ["pipe", "inherit", "inherit"], maxBuffer: 1024 * 1024 * 512 },
);
console.log("Restore complete.");
