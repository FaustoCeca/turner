/** Aplica las migraciones pendientes. Uso: DATABASE_URL=... npm run db:migrate */
import path from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { getDb } from "../src/db";

async function main() {
  const db = await getDb(); // con PGlite (sin DATABASE_URL) las migraciones se aplican al conectar
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
