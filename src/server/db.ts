import pg from "pg";

let pool: pg.Pool | null = null;

export function getPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  pool ??= new pg.Pool({
    connectionString: process.env.DATABASE_URL
  });

  return pool;
}

export async function query<T extends pg.QueryResultRow>(text: string, params: unknown[] = []) {
  return getPool().query<T>(text, params);
}

export async function closePool() {
  await pool?.end();
  pool = null;
}
