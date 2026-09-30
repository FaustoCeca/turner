import { mkdirSync } from "node:fs";
import path from "node:path";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export type DbOrTx = DB | Tx;

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

declare global {
  var __dbPromise: Promise<DB> | undefined;
}

async function createDb(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    // Con el certificado del servidor en DATABASE_CA_CERT (PEM) la conexión TLS verifica que del otro lado
    // esté tu base y no un impostor. Se omite el chequeo de nombre porque un VPS suele usar una IP.
    const ca = process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n");
    const client = postgres(url, {
      // En Vercel cada instancia de función abre su propio pool: conviene que sea chico.
      max: Number(process.env.DATABASE_POOL_SIZE ?? (process.env.VERCEL ? 2 : 5)),
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false, // compatible con PgBouncer en modo transacción
      ...(ca ? { ssl: { ca, rejectUnauthorized: true, checkServerIdentity: () => undefined } } : {}),
    });
    return drizzlePostgres({ client, schema });
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL es obligatorio en producción");
  }

  // Desarrollo sin Postgres instalado: Postgres embebido (PGlite) persistido en .data/
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
  if (!dir.startsWith("memory://")) mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  const db = drizzlePglite({ client, schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  // Las APIs que usamos son idénticas entre drivers.
  return db as unknown as DB;
}

export function getDb(): Promise<DB> {
  globalThis.__dbPromise ??= createDb().catch((err) => {
    globalThis.__dbPromise = undefined;
    throw err;
  });
  return globalThis.__dbPromise;
}

export { schema };
