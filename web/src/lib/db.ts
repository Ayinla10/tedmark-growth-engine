import { Pool } from "pg";

declare global {
  var pgPool: Pool | undefined;
}

const rawUrl = process.env.DATABASE_URL ?? "";
const cleanUrl = rawUrl.replace(/[?&](sslmode|channel_binding)=[^&]*/g, "");

const pool =
  global.pgPool ??
  new Pool({
    connectionString: cleanUrl,
    ssl: { rejectUnauthorized: false },
    max: 5,
    allowExitOnIdle: true,
  });

if (process.env.NODE_ENV !== "production") {
  global.pgPool = pool;
}

export default pool;
