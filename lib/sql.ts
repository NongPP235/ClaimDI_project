import { AsyncLocalStorage } from "node:async_hooks";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

// Database connection (PROJECT_PLAN.md §20). With DATABASE_URL the app talks
// to Postgres (Supabase in production); without it, a local PGlite database
// in data/pglite stands in, so the demo still runs with no setup.
// Queries use ? placeholders and are rewritten to $1, $2… for Postgres.
type Result = {
  rows: unknown[];
  affectedRows?: number;
  rowCount?: number | null;
};
type Runner = {
  query(sql: string, params?: unknown[]): Promise<Result>;
  exec(sql: string): Promise<unknown>;
};
type Backend = {
  kind: "postgres" | "pglite";
  runner: Runner;
  // A connection held for one transaction.
  begin(): Promise<{ runner: Runner; release(): void }>;
  close(): Promise<void>;
};

const INT8 = 20;
const toNumber = (v: string) => Number(v);

async function postgres(url: string): Promise<Backend> {
  const pg = (await import("pg")).default;
  const parsed = new URL(url);
  const local = ["localhost", "127.0.0.1", "::1"].includes(parsed.hostname);
  // TLS is set here rather than from ?sslmode= so every pg version agrees.
  parsed.searchParams.delete("sslmode");
  const pool = new pg.Pool({
    connectionString: parsed.toString(),
    ssl: local
      ? undefined
      : process.env.DATABASE_CA
        ? { ca: process.env.DATABASE_CA }
        : { rejectUnauthorized: false },
    // Serverless functions each hold a few connections at most; use the
    // Supabase transaction pooler (port 6543) in production.
    max: Number(process.env.DATABASE_POOL_MAX || 3),
    idleTimeoutMillis: 10000,
    types: {
      getTypeParser: ((oid: number, format?: "text" | "binary") =>
        oid === INT8 ? toNumber : pg.types.getTypeParser(oid, format)) as never,
    },
  });
  pool.on("error", () => {});
  const wrap = (c: {
    query: (sql: string, params?: unknown[]) => Promise<Result>;
  }): Runner => ({
    query: (sql, params) => c.query(sql, params),
    exec: (sql) => c.query(sql),
  });
  return {
    kind: "postgres",
    runner: wrap(pool),
    async begin() {
      const client = await pool.connect();
      return { runner: wrap(client), release: () => client.release() };
    },
    close: () => pool.end(),
  };
}

async function pglite(dir: string): Promise<Backend> {
  const { PGlite } = await import("@electric-sql/pglite");
  if (!dir.includes("://")) mkdirSync(resolve(dir), { recursive: true });
  const db = new PGlite(dir.includes("://") ? dir : resolve(dir), {
    parsers: { [INT8]: toNumber },
  });
  // PGlite is one connection, so a transaction must hold it alone.
  let tail = Promise.resolve();
  const lock = async () => {
    let release!: () => void;
    const next = new Promise<void>((r) => (release = r));
    const prev = tail;
    tail = prev.then(() => next);
    await prev;
    return release;
  };
  const direct: Runner = {
    query: (sql, params) => db.query(sql, params) as Promise<Result>,
    exec: (sql) => db.exec(sql),
  };
  const queued: Runner = {
    async query(sql, params) {
      const release = await lock();
      try {
        return await direct.query(sql, params);
      } finally {
        release();
      }
    },
    async exec(sql) {
      const release = await lock();
      try {
        return await direct.exec(sql);
      } finally {
        release();
      }
    },
  };
  return {
    kind: "pglite",
    runner: queued,
    async begin() {
      return { runner: direct, release: await lock() };
    },
    close: () => db.close(),
  };
}

const store = globalThis as unknown as { claimSql?: Promise<Backend> };
export function backend() {
  if (!store.claimSql) {
    // Tests always use an in-memory database, even when DATABASE_URL is set
    // in the shell, so they can never write to Supabase.
    const memory = process.env.PGLITE_DIR === "memory://";
    const url = memory ? undefined : process.env.DATABASE_URL;
    if (!url && process.env.VERCEL)
      throw new Error("DATABASE_URL is required on Vercel (README)");
    store.claimSql = url
      ? postgres(url)
      : pglite(process.env.PGLITE_DIR || "./data/pglite");
  }
  return store.claimSql;
}
export async function closeDb() {
  const b = store.claimSql;
  store.claimSql = undefined;
  if (b) await (await b).close();
}

const tx = new AsyncLocalStorage<Runner>();
const runner = async () => tx.getStore() ?? (await backend()).runner;
const numbered = (sql: string) => {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
};
export async function all<T>(sql: string, ...params: unknown[]) {
  return (await (await runner()).query(numbered(sql), params)).rows as T[];
}
export async function get<T>(sql: string, ...params: unknown[]) {
  return (await all<T>(sql, ...params))[0] as T | undefined;
}
// Returns the number of rows changed.
export async function run(sql: string, ...params: unknown[]) {
  const r = await (await runner()).query(numbered(sql), params);
  return r.affectedRows ?? r.rowCount ?? 0;
}
export async function exec(sql: string) {
  await (await runner()).exec(sql);
}
// Writes are serialised with one advisory lock, like SQLite's
// BEGIN IMMEDIATE, so the revision checks hold across instances.
export async function transaction<T>(fn: () => Promise<T>): Promise<T> {
  const open = tx.getStore();
  if (open) return fn();
  const { runner: r, release } = await (await backend()).begin();
  try {
    await r.exec("BEGIN");
    await r.query("SELECT pg_advisory_xact_lock(72001)");
    const result = await tx.run(r, fn);
    await r.exec("COMMIT");
    return result;
  } catch (e) {
    await r.exec("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    release();
  }
}
// Postgres unique-violation code, for friendly duplicate messages.
export const isUniqueViolation = (e: unknown) =>
  (e as { code?: string })?.code === "23505";
