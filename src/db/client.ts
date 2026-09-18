import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Did you create .env.local?");
}

const isServerless = process.env.VERCEL === "1";

function createDb(): PostgresJsDatabase<typeof schema> {
  if (isServerless) {
    const sql = neon(connectionString!);
    return drizzleNeon(sql, { schema }) as unknown as PostgresJsDatabase<typeof schema>;
  }

  const globalForDb = globalThis as unknown as { __munnudiSql?: postgres.Sql };
  const client =
    globalForDb.__munnudiSql ?? postgres(connectionString!, { max: 10 });
  if (process.env.NODE_ENV !== "production") {
    globalForDb.__munnudiSql = client;
  }
  return drizzle(client, { schema });
}

export const db = createDb();
