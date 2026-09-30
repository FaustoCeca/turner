/**
 * Datos de demostración. Uso: npm run db:seed
 * (con PGlite, detené `npm run dev` antes: la base embebida admite un solo proceso).
 */
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "../src/db";
import {
  branches,
  businessMembers,
  businesses,
  coupons,
  professionalBranches,
  professionalServices,
  professionals,
  services,
  users,
} from "../src/db/schema";
import { hashRecoveryCode } from "../src/lib/recovery";
import type { WeekSchedule } from "../src/lib/schedule";

// Código de recuperación fijo para las cuentas de demo (en cuentas reales es aleatorio).
const DEMO_RECOVERY_CODE = "DEMO-2345-TEST";

const h = (hh: number, mm = 0) => hh * 60 + mm;

function schedule(overrides: Partial<Record<number, [number, number][] | null>> = {}): WeekSchedule {
  const base: Record<number, [number, number][] | null> = {
    0: [[h(15, 30), h(19)]],
    1: [[h(9, 30), h(19)]],
    2: [[h(9, 30), h(19)]],
    3: [[h(9, 30), h(19)]],
    4: [[h(9, 30), h(19)]],
    5: null,
    6: null,
    ...overrides,
  };
  return [0, 1, 2, 3, 4, 5, 6].map((d) => ({
    enabled: base[d] !== null,
    ranges: (base[d] ?? []).map(([start, end]) => ({ start, end })),
  }));
}

async function main() {
  const db = await getDb();
  const [existing] = await db.select().from(businesses).where(eq(businesses.slug, "barberia-demo"));
  if (existing) {
    console.log("La demo ya existe: http://localhost:3000/barberia-demo");
    process.exit(0);
  }

  const password = await bcrypt.hash("demo1234", 10);
  const recoveryCodeHash = await hashRecoveryCode(DEMO_RECOVERY_CODE);
  const [owner] = await db
    .insert(users)
    .values({ email: "negocio@demo.test", passwordHash: password, recoveryCodeHash, firstName: "Nico", lastName: "Dueño", phone: "+5493410000000" })
    .returning();
  await db
    .insert(users)
    .values({ email: "cliente@demo.test", passwordHash: password, recoveryCodeHash, firstName: "Carla", lastName: "Cliente", phone: "+5493411111111" });
  await db.insert(users).values({
    email: "admin@demo.test",
    passwordHash: password,
    recoveryCodeHash,
    firstName: "Operador",
    lastName: "Plataforma",
    phone: "+5493412222222",
    isPlatformAdmin: true,
  });

  const [business] = await db
    .insert(businesses)
    .values({
      slug: "barberia-demo",
      name: "Barbería Demo",
      slogan: "Cortes clásicos y modernos",
      category: "Barbería",
      ownerId: owner.id,
      whatsapp: "+5493410000000",
      instagram: "instagram.com/barberia.demo",
      requireDeposit: true,
      depositPercent: 20,
      maxDaysInFuture: 25,
      slotMinutes: [0, 15, 30, 45],
      termsAndConditions:
        "Recordá llegar 10 minutos antes. Tolerancia máxima de 10 minutos.\nCancelaciones con menos de 8 horas de anticipación no tienen reembolso de la seña.",
      autoRefund: true,
      refundMinAnticipationMinutes: 8 * 60,
      minAnticipationEditMinutes: 6 * 60,
    })
    .returning();
  await db.insert(businessMembers).values({ businessId: business.id, userId: owner.id, role: "owner" });

  const [centro, norte] = await db
    .insert(branches)
    .values([
      { businessId: business.id, name: "Centro", address: "Salta 1724", city: "Rosario", postalCode: "S2000", order: 0 },
      { businessId: business.id, name: "Norte", address: "Ayacucho 1428", city: "Rosario", postalCode: "S2000", order: 1 },
    ])
    .returning();

  const notes =
    "¡Recordá asistir a tu cita 10 minutos antes!\n⏰ Tolerancia por demora: 10 minutos.\n❌ Cancelaciones: con al menos 8 horas de anticipación.";
  const svc = await db
    .insert(services)
    .values([
      { businessId: business.id, name: "Corte de cabello", description: "Servicio de corte de cabello 💈", notes, price: 19000, durationMinutes: 20, blockingMinutes: 30, depositPercent: 5, order: 0 },
      { businessId: business.id, name: "Recorte de barba", description: "Recorte de barba con navaja y marcado de contorno.", notes, price: 14000, durationMinutes: 10, blockingMinutes: 15, depositPercent: 7, order: 1 },
      { businessId: business.id, name: "Corte y barba", description: "Corte de cabello + recorte de barba.", notes, price: 23000, durationMinutes: 40, blockingMinutes: 40, depositPercent: 4, order: 2 },
      { businessId: business.id, name: "Corte, barba y afeitado", description: "El servicio completo.", notes, price: 25000, durationMinutes: 45, blockingMinutes: 45, depositPercent: 4, order: 3 },
    ])
    .returning();

  const pros = await db
    .insert(professionals)
    .values([
      { businessId: business.id, userId: owner.id, firstName: "Nico", lastName: "Dueño", order: 0 },
      { businessId: business.id, firstName: "Mateo", lastName: "Pérez", order: 1 },
      { businessId: business.id, firstName: "Leo", lastName: "Gómez", order: 2 },
    ])
    .returning();

  await db.insert(professionalBranches).values([
    { professionalId: pros[0].id, branchId: centro.id, schedule: schedule() },
    { professionalId: pros[0].id, branchId: norte.id, schedule: schedule({ 1: null, 2: null, 3: null, 4: null, 5: [[h(9, 30), h(12, 45)]] }) },
    { professionalId: pros[1].id, branchId: centro.id, schedule: schedule() },
    { professionalId: pros[1].id, branchId: norte.id, schedule: schedule({ 0: null, 1: null, 2: null, 3: null, 4: null, 5: [[h(9, 30), h(13)]] }) },
    { professionalId: pros[2].id, branchId: centro.id, schedule: schedule({ 1: [[h(13), h(19)]], 2: [[h(13), h(19)]], 3: [[h(13), h(19)]], 5: [[h(9, 30), h(12, 45)]] }) },
  ]);

  const weekdays = [0, 1, 2, 3, 4, 5];
  await db.insert(professionalServices).values([
    ...svc.map((s) => ({ professionalId: pros[0].id, serviceId: s.id, weekdays })),
    ...svc.map((s) => ({ professionalId: pros[1].id, serviceId: s.id, weekdays })),
    { professionalId: pros[2].id, serviceId: svc[0].id, weekdays },
  ]);

  await db.insert(coupons).values({ businessId: business.id, code: "BIENVENIDA", discountType: "percent", value: 10 });

  console.log(`Demo creada:
  Página de reservas: http://localhost:3000/barberia-demo
  Negocio:  negocio@demo.test / demo1234  → http://localhost:3000/panel
  Cliente:  cliente@demo.test / demo1234
  Admin:    admin@demo.test / demo1234  → http://localhost:3000/admin
  Cupón:    BIENVENIDA (10%)
  Código de recuperación de las cuentas demo: ${DEMO_RECOVERY_CODE}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
