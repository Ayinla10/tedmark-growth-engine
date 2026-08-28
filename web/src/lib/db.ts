import { neon } from "@neondatabase/serverless";
import { Pool } from "@neondatabase/serverless";

declare global {
  var pgPool: Pool | undefined;
}

const connectionString = process.env.DATABASE_URL ?? "";

export const sql = neon(connectionString);

const pool =
  global.pgPool ??
  new Pool({ connectionString });

if (process.env.NODE_ENV !== "production") {
  global.pgPool = pool;
}

export default pool;
