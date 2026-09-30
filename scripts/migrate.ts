/**
 * Aplica las migraciones pendientes. Uso: DATABASE_URL=... npm run db:migrate
 * En Vercel corre como parte del build (ver vercel.json), sólo en deploys de producción:
 * las vistas previas no tocan la base real.
 */
import path from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { getDb } from "../src/db";

async function main() {
  if (process.env.VERCEL && process.env.VERCEL_ENV !== "production") {
    console.log(`Migraciones omitidas en deploy "${process.env.VERCEL_ENV}" (sólo se aplican en producción).`);
    process.exit(0);
  }
  if (!process.env.DATABASE_URL && (process.env.VERCEL || process.env.NODE_ENV === "production")) {
    console.error("Falta DATABASE_URL: no se pueden aplicar las migraciones.");
    process.exit(1);
  }
  const db = await getDb(); // con PGlite (sin DATABASE_URL, en local) las migraciones se aplican al conectar
  if (process.env.DATABASE_URL) {
    await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  }
  console.log("Migraciones aplicadas");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
