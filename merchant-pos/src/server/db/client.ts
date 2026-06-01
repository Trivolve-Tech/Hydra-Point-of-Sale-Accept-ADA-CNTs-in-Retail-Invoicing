import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

let pool: pg.Pool | null = null;

export function getDb() {
  if (!pool) {
    const connectionString =
      process.env.DATABASE_URL ??
      "postgres://hydra_pos:hydra_pos@localhost:5432/hydra_pos";
    pool = new pg.Pool({ connectionString });
  }
  return drizzle(pool);
}
