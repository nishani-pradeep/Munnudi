import "./env";
import { drizzle } from "drizzle-orm/postgres-js";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { migrate as migrateNeon } from "drizzle-orm/neon-serverless/migrator";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import postgres from "postgres";

const url = process.env.DATABASE_URL!;
const isNeon = url.includes("neon.tech");

async function main() {
  console.log(`Applying migrations from ./drizzle (${isNeon ? "neon-ws" : "postgres-js"}) ...`);

  if (isNeon) {
    neonConfig.webSocketConstructor = ws;
    const pool = new Pool({ connectionString: url });
    const db = drizzleNeon(pool);
    await migrateNeon(db, { migrationsFolder: "./drizzle" });
    await pool.end();
  } else {
    const sql = postgres(url, { max: 1 });
    const db = drizzle(sql);
    await migrate(db, { migrationsFolder: "./drizzle" });
    await sql.end();
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
