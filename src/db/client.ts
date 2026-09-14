import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Next.js loads .env.local automatically for the app runtime, so this file
 * must NOT import src/db/env.ts (that loader is for standalone scripts only).
 */
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Did you create .env.local?");
}

// A module-level singleton: Next.js dev-mode hot reload would otherwise open a
// fresh pool on every edit.
const globalForDb = globalThis as unknown as { __munnudiSql?: postgres.Sql };

const client = globalForDb.__munnudiSql ?? postgres(connectionString, { max: 10 });
if (process.env.NODE_ENV !== "production") {
  globalForDb.__munnudiSql = client;
}

export const db = drizzle(client, { schema });
