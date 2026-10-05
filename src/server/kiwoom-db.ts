import { KiwoomError } from "./kiwoom-config.ts";
import type { Sql } from "../lib/db.ts";
import { createKiwoomStore } from "./kiwoom-store.ts";

/** Kiwoom operational paths never import or initialize the app's PGlite fallback. */
export async function openKiwoomDatabase() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString || !/^postgres(?:ql)?:\/\//.test(connectionString))
    throw new KiwoomError("storage", "공유 영속 PostgreSQL 미설정", null, 0, "DATABASE_MISSING");
  const { Pool } = await import("pg");
  const pool = new Pool({ connectionString, max: 3, connectionTimeoutMillis: 5_000, statement_timeout: 15_000 });
  const sql = { query: async <T>(text: string, params?: unknown[]) => (await pool.query(text, params)).rows as T[] } as Sql;
  return { store: createKiwoomStore(sql), close: () => pool.end() };
}
let shared: ReturnType<typeof openKiwoomDatabase> | undefined;
export async function getKiwoomStore() {
  shared ??= openKiwoomDatabase().catch(error => { shared = undefined; throw error; });
  return (await shared).store;
}
