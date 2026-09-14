/**
 * Env loading for contexts Next.js does not auto-load: drizzle-kit, migration
 * scripts, seed scripts. The Next.js app itself loads .env.local automatically
 * and must NOT import this file.
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env.local") });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}. Did you create .env.local?`);
  }
  return value;
}

export const DATABASE_URL = required("DATABASE_URL");
export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "Asia/Kolkata";
