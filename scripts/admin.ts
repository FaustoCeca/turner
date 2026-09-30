/**
 * Herramientas del operador de la plataforma (necesitan acceso a la base: DATABASE_URL).
 *
 *   npm run admin -- grant <email>   Da acceso a /admin
 *   npm run admin -- revoke <email>  Quita acceso a /admin
 *   npm run admin -- reset <email>   Genera un código de recuperación nuevo (sirve si perdiste el tuyo)
 *
 * Con PGlite (desarrollo) detené `npm run dev` antes de usarlo.
 */
import { eq } from "drizzle-orm";
import { getDb } from "../src/db";
import { users } from "../src/db/schema";
import { generateRecoveryCode, hashRecoveryCode } from "../src/lib/recovery";

async function main() {
  const [command, rawEmail] = process.argv.slice(2);
  const email = rawEmail?.trim().toLowerCase();
  if (!command || !email || !["grant", "revoke", "reset"].includes(command)) {
    console.log("Uso: npm run admin -- <grant|revoke|reset> <email>");
    process.exit(1);
  }
  const db = await getDb();
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    console.error(`No existe un usuario con el email ${email}. Tiene que registrarse primero.`);
    process.exit(1);
  }
  if (command === "reset") {
    const code = generateRecoveryCode();
    await db.update(users).set({ recoveryCodeHash: await hashRecoveryCode(code) }).where(eq(users.id, user.id));
    console.log(`Código de recuperación para ${email}: ${code}\nUsalo en /recuperar para crear una contraseña nueva.`);
  } else {
    await db.update(users).set({ isPlatformAdmin: command === "grant" }).where(eq(users.id, user.id));
    console.log(command === "grant" ? `${email} ahora puede entrar a /admin` : `${email} ya no puede entrar a /admin`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
