"use server";

import { and, eq, ilike, isNull, ne, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb, type Tx } from "@/db";
import {
  appointments,
  branches,
  businesses,
  clients,
  coupons,
  images,
  notifications,
  professionalBranches,
  professionalServices,
  professionals,
  services,
  timeBlocks,
  type AppointmentStatus,
} from "@/db/schema";
import {
  BookingError,
  cancelAppointment,
  lockAppointment,
  lockProfessionals,
} from "@/lib/bookings";
import { encrypt } from "@/lib/crypto";
import { IMAGE_PATH, internalImageId, isAcceptableImageUrl, MAX_IMAGE_BYTES, sniffImageType } from "@/lib/images";
import { businessForAction, isValidSlug, PANEL_BUSINESS_COOKIE, slugify } from "@/lib/panel";
import { ALL_WEEKDAYS, hhmmToMinutes, normalizeSchedule, type WeekSchedule } from "@/lib/schedule";
import { getSlotContext, loadBusy } from "@/lib/slots";
import { addDays, isValidDateStr, zonedToUtc } from "@/lib/time";

export type ActionState = { ok?: boolean; error?: string; message?: string; id?: string };

/* ───────────── helpers de FormData ───────────── */

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const opt = (fd: FormData, key: string) => str(fd, key) || null;
const bool = (fd: FormData, key: string) => ["on", "true", "1"].includes(str(fd, key));
function int(fd: FormData, key: string, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  const raw = str(fd, key);
  if (raw === "") return fallback;
  const n = Math.round(Number(raw.replace(",", ".")));
  if (!Number.isFinite(n)) throw new BookingError(`Valor inválido en ${key}`);
  return Math.min(max, Math.max(min, n));
}
function weekdays(fd: FormData, key: string): number[] {
  const days = fd
    .getAll(key)
    .map(Number)
    .filter((d) => ALL_WEEKDAYS.includes(d));
  return days.length ? [...new Set(days)].sort() : ALL_WEEKDAYS;
}

function fail(err: unknown): ActionState {
  if (err instanceof BookingError) return { error: err.message };
  if (err instanceof Error && "digest" in err) throw err; // redirect()/notFound()
  console.error("[panel]", err);
  return { error: "No pudimos guardar los cambios. Revisá los datos e intentá de nuevo." };
}

/* ───────────── negocio activo ───────────── */

export async function switchBusinessAction(formData: FormData): Promise<void> {
  const { businesses: mine } = await businessForAction();
  const id = str(formData, "businessId");
  if (mine.some((b) => b.id === id)) {
    (await cookies()).set(PANEL_BUSINESS_COOKIE, id, { path: "/", httpOnly: true, sameSite: "lax" });
  }
  redirect("/panel");
}

/* ───────────── sucursales ───────────── */

export async function saveBranchAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { business } = await businessForAction();
    const db = await getDb();
    const address = str(fd, "address");
    if (address.length < 3) return { error: "Ingresá la dirección" };
    const values = {
      name: opt(fd, "name"),
      address,
      city: opt(fd, "city"),
      province: opt(fd, "province"),
      postalCode: opt(fd, "postalCode"),
      phone: opt(fd, "phone"),
      order: int(fd, "order", 0),
      isActive: bool(fd, "isActive"),
    };
    const id = str(fd, "id");
    if (id) {
      await db.update(branches).set(values).where(and(eq(branches.id, id), eq(branches.businessId, business.id)));
    } else {
      await db.insert(branches).values({ ...values, businessId: business.id, isActive: true });
    }
    revalidatePath("/panel/sucursales");
    return { ok: true, message: id ? "Sucursal actualizada" : "Sucursal creada" };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteBranchAction(fd: FormData): Promise<void> {
  const { business } = await businessForAction();
  const db = await getDb();
  const id = str(fd, "id");
  const [used] = await db.select({ id: appointments.id }).from(appointments).where(eq(appointments.branchId, id)).limit(1);
  if (used) {
    // Con historial de turnos no se borra: se desactiva.
    await db.update(branches).set({ isActive: false }).where(and(eq(branches.id, id), eq(branches.businessId, business.id)));
  } else {
    await db.delete(branches).where(and(eq(branches.id, id), eq(branches.businessId, business.id)));
  }
  revalidatePath("/panel/sucursales");
}

/* ───────────── servicios ───────────── */

export async function saveServiceAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  let target = "/panel/servicios";
  try {
    const { business } = await businessForAction();
    const db = await getDb();
    const name = str(fd, "name");
    if (!name) return { error: "Ingresá el nombre del servicio" };
    const duration = int(fd, "durationMinutes", 0, 0, 720);
    if (duration < 5) return { error: "La duración mínima es de 5 minutos" };
    const blocking = int(fd, "blockingMinutes", duration, 5, 720);
    const modality = str(fd, "modality");
    const depositPercentRaw = str(fd, "depositPercent");

    const values = {
      name,
      description: opt(fd, "description"),
      notes: opt(fd, "notes"),
      category: opt(fd, "category"),
      modality: (["Presencial", "Virtual", "A domicilio"].includes(modality) ? modality : "Presencial") as
        | "Presencial"
        | "Virtual"
        | "A domicilio",
      price: int(fd, "price", 0, 0),
      priceTBD: bool(fd, "priceTBD"),
      durationMinutes: duration,
      blockingMinutes: Math.max(blocking, 5),
      depositEnabled: bool(fd, "depositEnabled"),
      depositPercent: depositPercentRaw === "" ? null : int(fd, "depositPercent", 0, 0, 100),
      isActive: bool(fd, "isActive"),
      isOnline: bool(fd, "isOnline"),
      order: int(fd, "order", 0),
    };

    const pros = await db.select({ id: professionals.id }).from(professionals).where(eq(professionals.businessId, business.id));
    const assignments = pros
      .filter((p) => bool(fd, `pro_${p.id}`))
      .map((p) => ({ professionalId: p.id, weekdays: weekdays(fd, `days_${p.id}`) }));

    const id = str(fd, "id");
    await db.transaction(async (tx) => {
      let serviceId = id;
      if (id) {
        const updated = await tx
          .update(services)
          .set(values)
          .where(and(eq(services.id, id), eq(services.businessId, business.id)))
          .returning({ id: services.id });
        if (!updated.length) throw new BookingError("Servicio inexistente");
      } else {
        const [created] = await tx.insert(services).values({ ...values, businessId: business.id }).returning();
        serviceId = created.id;
      }
      await tx.delete(professionalServices).where(eq(professionalServices.serviceId, serviceId));
      if (assignments.length) {
        await tx.insert(professionalServices).values(assignments.map((a) => ({ ...a, serviceId })));
      }
    });
    if (str(fd, "first") === "1") target = "/panel?bienvenida=1";
    revalidatePath("/panel/servicios");
  } catch (err) {
    return fail(err);
  }
  redirect(target);
}

export async function deleteServiceAction(fd: FormData): Promise<void> {
  const { business } = await businessForAction();
  const db = await getDb();
  const id = str(fd, "id");
  const [used] = await db.select({ id: appointments.id }).from(appointments).where(eq(appointments.serviceId, id)).limit(1);
  if (used) {
    await db.update(services).set({ isActive: false }).where(and(eq(services.id, id), eq(services.businessId, business.id)));
  } else {
    await db.delete(services).where(and(eq(services.id, id), eq(services.businessId, business.id)));
  }
  revalidatePath("/panel/servicios");
  redirect("/panel/servicios");
}

/* ───────────── profesionales ───────────── */

export async function saveProfessionalAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { business } = await businessForAction();
    const db = await getDb();
    const firstName = str(fd, "firstName");
    if (!firstName) return { error: "Ingresá el nombre" };
    const avatarUrl = opt(fd, "avatarUrl");
    if (avatarUrl && !isAcceptableImageUrl(avatarUrl)) return { error: "Foto inválida" };

    const branchRows = await db.select({ id: branches.id }).from(branches).where(eq(branches.businessId, business.id));
    const branchIds = new Set(branchRows.map((b) => b.id));
    let schedules: Record<string, WeekSchedule>;
    try {
      schedules = JSON.parse(str(fd, "schedules") || "{}");
    } catch {
      return { error: "Horarios inválidos" };
    }
    const branchSchedules = Object.entries(schedules)
      .filter(([branchId]) => branchIds.has(branchId))
      .map(([branchId, schedule]) => ({ branchId, schedule: normalizeSchedule(schedule) }));
    if (!branchSchedules.length) return { error: "Asigná al menos una sucursal donde atiende" };

    const serviceRows = await db.select({ id: services.id }).from(services).where(eq(services.businessId, business.id));
    const serviceAssignments = serviceRows
      .filter((s) => bool(fd, `svc_${s.id}`))
      .map((s) => ({ serviceId: s.id, weekdays: weekdays(fd, `svcdays_${s.id}`) }));

    const values = {
      firstName,
      lastName: str(fd, "lastName"),
      email: opt(fd, "email"),
      phone: opt(fd, "phone"),
      avatarUrl,
      bio: opt(fd, "bio"),
      isActive: bool(fd, "isActive"),
      order: int(fd, "order", 0),
    };

    const id = str(fd, "id");
    const savedId = await db.transaction(async (tx) => {
      let proId = id;
      if (id) {
        const [previous] = await tx
          .select({ avatarUrl: professionals.avatarUrl })
          .from(professionals)
          .where(and(eq(professionals.id, id), eq(professionals.businessId, business.id)));
        await deleteReplacedImage(tx, business.id, previous?.avatarUrl, avatarUrl);
        const updated = await tx
          .update(professionals)
          .set(values)
          .where(and(eq(professionals.id, id), eq(professionals.businessId, business.id)))
          .returning({ id: professionals.id });
        if (!updated.length) throw new BookingError("Profesional inexistente");
      } else {
        const [created] = await tx.insert(professionals).values({ ...values, businessId: business.id }).returning();
        proId = created.id;
      }
      await tx.delete(professionalBranches).where(eq(professionalBranches.professionalId, proId));
      await tx.insert(professionalBranches).values(branchSchedules.map((b) => ({ ...b, professionalId: proId })));
      await tx.delete(professionalServices).where(eq(professionalServices.professionalId, proId));
      if (serviceAssignments.length) {
        await tx.insert(professionalServices).values(serviceAssignments.map((s) => ({ ...s, professionalId: proId })));
      }
      return proId;
    });
    revalidatePath("/panel/profesionales");
    revalidatePath(`/panel/profesionales/${savedId}`);
    return { ok: true, id: savedId, message: "Cambios guardados" };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteProfessionalAction(fd: FormData): Promise<void> {
  const { business } = await businessForAction();
  const db = await getDb();
  const id = str(fd, "id");
  const [used] = await db.select({ id: appointments.id }).from(appointments).where(eq(appointments.professionalId, id)).limit(1);
  if (used) {
    await db.update(professionals).set({ isActive: false }).where(and(eq(professionals.id, id), eq(professionals.businessId, business.id)));
  } else {
    await db.delete(professionals).where(and(eq(professionals.id, id), eq(professionals.businessId, business.id)));
  }
  revalidatePath("/panel/profesionales");
  redirect("/panel/profesionales");
}

/* ───────────── bloqueos de agenda ───────────── */

export async function createBlockAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { business } = await businessForAction();
    const db = await getDb();
    const fromDate = str(fd, "fromDate");
    const toDate = str(fd, "toDate") || fromDate;
    if (!isValidDateStr(fromDate) || !isValidDateStr(toDate)) return { error: "Fechas inválidas" };
    const fromMin = hhmmToMinutes(str(fd, "fromTime") || "00:00");
    const toMin = hhmmToMinutes(str(fd, "toTime") || "24:00");
    if (fromMin == null || toMin == null) return { error: "Horario inválido" };
    const startsAt = zonedToUtc(fromDate, fromMin, business.timezone);
    const endsAt = toMin === 1440 ? zonedToUtc(addDays(toDate, 1), 0, business.timezone) : zonedToUtc(toDate, toMin, business.timezone);
    if (endsAt <= startsAt) return { error: "El fin del bloqueo debe ser posterior al inicio" };

    const professionalId = opt(fd, "professionalId");
    const branchId = opt(fd, "branchId");
    if (professionalId) {
      const [p] = await db.select({ id: professionals.id }).from(professionals).where(and(eq(professionals.id, professionalId), eq(professionals.businessId, business.id)));
      if (!p) return { error: "Profesional inexistente" };
    }
    if (branchId) {
      const [b] = await db.select({ id: branches.id }).from(branches).where(and(eq(branches.id, branchId), eq(branches.businessId, business.id)));
      if (!b) return { error: "Sucursal inexistente" };
    }
    await db.insert(timeBlocks).values({ businessId: business.id, professionalId, branchId, startsAt, endsAt, reason: opt(fd, "reason") });
    revalidatePath("/panel", "layout");
    return { ok: true, message: "Horario bloqueado" };
  } catch (err) {
    return fail(err);
  }
}

export async function deleteBlockAction(fd: FormData): Promise<void> {
  const { business } = await businessForAction();
  const db = await getDb();
  await db.delete(timeBlocks).where(and(eq(timeBlocks.id, str(fd, "id")), eq(timeBlocks.businessId, business.id)));
  revalidatePath("/panel", "layout");
}

/* ───────────── clientes ───────────── */

export async function saveClientAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { business } = await businessForAction();
    const db = await getDb();
    const firstName = str(fd, "firstName");
    if (!firstName) return { error: "Ingresá el nombre" };
    const values = {
      firstName,
      lastName: str(fd, "lastName"),
      email: opt(fd, "email")?.toLowerCase() ?? null,
      phone: opt(fd, "phone"),
      notes: opt(fd, "notes"),
      depositExempt: bool(fd, "depositExempt"),
      isBlocked: bool(fd, "isBlocked"),
    };
    const id = str(fd, "id");
    if (id) {
      await db.update(clients).set(values).where(and(eq(clients.id, id), eq(clients.businessId, business.id)));
      revalidatePath(`/panel/clientes/${id}`);
      return { ok: true, id, message: "Cliente actualizado" };
    }
    const [created] = await db.insert(clients).values({ ...values, businessId: business.id }).returning();
    revalidatePath("/panel/clientes");
    return { ok: true, id: created.id, message: "Cliente creado" };
  } catch (err) {
    return fail(err);
  }
}

/* ───────────── cupones ───────────── */

export async function saveCouponAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { business } = await businessForAction();
    const db = await getDb();
    const code = str(fd, "code").toUpperCase();
    if (!/^[A-Z0-9_-]{3,20}$/.test(code)) return { error: "El código debe tener entre 3 y 20 letras o números, sin espacios" };
    const discountType = str(fd, "discountType") === "fixed" ? "fixed" : "percent";
    const value = int(fd, "value", 0, 0);
    if (value <= 0 || (discountType === "percent" && value > 100)) return { error: "Valor de descuento inválido" };
    const from = str(fd, "validFrom");
    const until = str(fd, "validUntil");
    const values = {
      code,
      discountType: discountType as "percent" | "fixed",
      value,
      validFrom: from && isValidDateStr(from) ? zonedToUtc(from, 0, business.timezone) : null,
      validUntil: until && isValidDateStr(until) ? zonedToUtc(addDays(until, 1), 0, business.timezone) : null,
      maxUses: str(fd, "maxUses") ? int(fd, "maxUses", 0, 1) : null,
      isActive: true,
    };
    const [dup] = await db
      .select({ id: coupons.id })
      .from(coupons)
      .where(and(eq(coupons.businessId, business.id), eq(coupons.code, code)))
      .limit(1);
    if (dup) return { error: "Ya existe un cupón con ese código" };
    await db.insert(coupons).values({ ...values, businessId: business.id });
    revalidatePath("/panel/cupones");
    return { ok: true, message: "Cupón creado" };
  } catch (err) {
    return fail(err);
  }
}

export async function toggleCouponAction(fd: FormData): Promise<void> {
  const { business } = await businessForAction();
  const db = await getDb();
  await db
    .update(coupons)
    .set({ isActive: str(fd, "active") === "1" })
    .where(and(eq(coupons.id, str(fd, "id")), eq(coupons.businessId, business.id)));
  revalidatePath("/panel/cupones");
}

export async function deleteCouponAction(fd: FormData): Promise<void> {
  const { business } = await businessForAction();
  const db = await getDb();
  await db.delete(coupons).where(and(eq(coupons.id, str(fd, "id")), eq(coupons.businessId, business.id)));
  revalidatePath("/panel/cupones");
}

/* ───────────── configuración ───────────── */

const HEX = /^#[0-9a-fA-F]{6}$/;

export async function saveGeneralSettingsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { business } = await businessForAction();
    const db = await getDb();
    const name = str(fd, "name");
    if (name.length < 2) return { error: "Ingresá el nombre del negocio" };
    const slug = slugify(str(fd, "slug"));
    if (!isValidSlug(slug)) return { error: "La dirección web no es válida o está reservada" };
    const [taken] = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(and(eq(businesses.slug, slug), ne(businesses.id, business.id)))
      .limit(1);
    if (taken) return { error: `La dirección /${slug} ya está en uso` };
    const timezone = str(fd, "timezone") || business.timezone;
    try {
      new Intl.DateTimeFormat("es", { timeZone: timezone });
    } catch {
      return { error: "Zona horaria inválida" };
    }
    const logoUrl = opt(fd, "logoUrl");
    if (logoUrl && !isAcceptableImageUrl(logoUrl)) return { error: "Logo inválido" };

    await db
      .update(businesses)
      .set({
        name,
        slug,
        category: opt(fd, "category"),
        slogan: opt(fd, "slogan"),
        logoUrl,
        whatsapp: opt(fd, "whatsapp"),
        instagram: opt(fd, "instagram"),
        facebook: opt(fd, "facebook"),
        website: opt(fd, "website"),
        timezone,
      })
      .where(eq(businesses.id, business.id));
    await deleteReplacedImage(db, business.id, business.logoUrl, logoUrl);
    revalidatePath("/panel", "layout");
    return { ok: true, message: "Datos guardados" };
  } catch (err) {
    return fail(err);
  }
}

export async function saveAppearanceAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { business } = await businessForAction();
    const db = await getDb();
    const primaryColor = str(fd, "primaryColor");
    const secondaryColor = str(fd, "secondaryColor");
    const backgroundColor = str(fd, "backgroundColor");
    if (![primaryColor, secondaryColor, backgroundColor].every((c) => HEX.test(c))) return { error: "Colores inválidos" };
    await db.update(businesses).set({ primaryColor, secondaryColor, backgroundColor }).where(eq(businesses.id, business.id));
    revalidatePath("/panel/configuracion");
    return { ok: true, message: "Colores guardados" };
  } catch (err) {
    return fail(err);
  }
}

export async function saveBookingSettingsAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { business } = await businessForAction();
    const db = await getDb();
    const slotMinutes = fd
      .getAll("slotMinutes")
      .map(Number)
      .filter((m) => [0, 15, 30, 45].includes(m));
    if (!slotMinutes.length) return { error: "Elegí al menos un minuto de inicio de turno" };
    await db
      .update(businesses)
      .set({
        isOnline: bool(fd, "isOnline"),
        showPrices: bool(fd, "showPrices"),
        maxDaysInFuture: int(fd, "maxDaysInFuture", 30, 1, 365),
        minAnticipationMinutes: int(fd, "minAnticipationMinutes", 0, 0, 60 * 24 * 30),
        slotMinutes: [...new Set(slotMinutes)].sort((a, b) => a - b),
        holdMinutes: int(fd, "holdMinutes", 15, 5, 120),
        maxActiveBookingsPerClient: int(fd, "maxActiveBookingsPerClient", 3, 0, 50),
        minAnticipationEditMinutes: int(fd, "minAnticipationEditMinutes", 0, 0, 60 * 24 * 30),
        maxClientEdits: int(fd, "maxClientEdits", 1, 0, 20),
        requireDeposit: bool(fd, "requireDeposit"),
        depositPercent: int(fd, "depositPercent", 20, 0, 100),
        depositMinAmount: int(fd, "depositMinAmount", 0, 0),
        autoRefund: bool(fd, "autoRefund"),
        refundMinAnticipationMinutes: int(fd, "refundMinAnticipationMinutes", 0, 0, 60 * 24 * 30),
        termsAndConditions: opt(fd, "termsAndConditions"),
      })
      .where(eq(businesses.id, business.id));
    revalidatePath("/panel/configuracion");
    return { ok: true, message: "Configuración de reservas guardada" };
  } catch (err) {
    return fail(err);
  }
}

export async function saveMpTokenAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { business, role } = await businessForAction();
    if (role !== "owner") return { error: "Sólo el dueño puede vincular Mercado Pago" };
    const token = str(fd, "accessToken");
    if (!/^(APP_USR|TEST)-[\w-]{20,}$/.test(token)) return { error: "El Access Token no tiene un formato válido" };
    const res = await fetch("https://api.mercadopago.com/users/me", { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return { error: "Mercado Pago rechazó el Access Token" };
    // Desde nov. 2025 las credenciales de prueba también empiezan con APP_USR-: la cuenta de prueba
    // se reconoce por la etiqueta "test_user" que devuelve Mercado Pago.
    const me = (await res.json()) as { id: number; tags?: string[] };
    const isTest = token.startsWith("TEST-") || (me.tags ?? []).includes("test_user");
    const db = await getDb();
    await db
      .update(businesses)
      .set({
        mpAccessToken: encrypt(token),
        mpRefreshToken: null,
        mpUserId: String(me.id),
        mpTokenExpiresAt: null,
        mpLiveMode: !isTest,
      })
      .where(eq(businesses.id, business.id));
    revalidatePath("/panel/configuracion");
    return { ok: true, message: "Cuenta de Mercado Pago vinculada" };
  } catch (err) {
    return fail(err);
  }
}

export async function disconnectMpAction(): Promise<void> {
  const { business, role } = await businessForAction();
  if (role !== "owner") return;
  const db = await getDb();
  await db
    .update(businesses)
    .set({ mpAccessToken: null, mpRefreshToken: null, mpUserId: null, mpPublicKey: null, mpTokenExpiresAt: null, mpLiveMode: null })
    .where(eq(businesses.id, business.id));
  revalidatePath("/panel/configuracion");
}

/* ───────────── turnos ───────────── */

const STATUS_CHANGES: Partial<Record<AppointmentStatus, AppointmentStatus[]>> = {
  confirmed: ["completed", "no_show"],
  completed: ["confirmed", "no_show"],
  no_show: ["confirmed", "completed"],
};

export async function setAppointmentStatusAction(appointmentId: string, status: AppointmentStatus): Promise<ActionState> {
  try {
    const { business } = await businessForAction();
    const db = await getDb();
    const [a] = await db
      .select({ status: appointments.status })
      .from(appointments)
      .where(and(eq(appointments.id, appointmentId), eq(appointments.businessId, business.id)));
    if (!a) return { error: "Turno inexistente" };
    if (!STATUS_CHANGES[a.status]?.includes(status)) return { error: "No se puede cambiar el estado de este turno" };
    await db.update(appointments).set({ status }).where(eq(appointments.id, appointmentId));
    revalidatePath("/panel", "layout");
    return { ok: true };
  } catch (err) {
    return fail(err);
  }
}

export async function cancelAppointmentByBusinessAction(
  appointmentId: string,
  refund: boolean,
  reason: string,
): Promise<ActionState> {
  try {
    const { business, user } = await businessForAction();
    const { refunded } = await cancelAppointment({
      appointmentId,
      by: "business",
      userId: user.id,
      businessId: business.id,
      refund,
      reason: reason.slice(0, 300) || null,
    });
    revalidatePath("/panel", "layout");
    return { ok: true, message: refunded ? "Turno cancelado y seña devuelta" : "Turno cancelado" };
  } catch (err) {
    return fail(err);
  }
}

/** Verifica solapamiento en la agenda del profesional (cualquier sucursal) y bloqueos. */
async function assertFree(
  tx: Tx,
  params: { businessId: string; professionalId: string; branchId: string; start: Date; end: Date; excludeId?: string },
) {
  const busy = await loadBusy(tx, {
    businessId: params.businessId,
    professionalId: params.professionalId,
    branchId: params.branchId,
    from: params.start,
    to: params.end,
    now: new Date(),
    excludeAppointmentIds: params.excludeId ? [params.excludeId] : [],
  });
  if (busy.some((b) => b.start < params.end.getTime() && params.start.getTime() < b.end)) {
    throw new BookingError("El horario se superpone con otro turno o bloqueo. Marcá “Permitir superposición” para agendarlo igual.");
  }
}

export async function createManualAppointmentAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { business } = await businessForAction();
    const db = await getDb();
    const date = str(fd, "date");
    const minutes = hhmmToMinutes(str(fd, "time"));
    if (!isValidDateStr(date) || minutes == null) return { error: "Elegí fecha y hora" };
    const ids = { serviceId: str(fd, "serviceId"), professionalId: str(fd, "professionalId"), branchId: str(fd, "branchId") };
    const force = bool(fd, "force");

    const appointmentId = await db.transaction(async (tx) => {
      const ctx = await getSlotContext(tx, business.id, ids);
      if (!ctx) throw new BookingError("El profesional no presta ese servicio en esa sucursal");
      await lockProfessionals(tx, [ids.professionalId]);
      const start = zonedToUtc(date, minutes, business.timezone);
      const blockEnd = new Date(start.getTime() + ctx.service.blockingMinutes * 60_000);
      if (!force) await assertFree(tx, { businessId: business.id, ...ids, start, end: blockEnd });

      let clientId = str(fd, "clientId");
      if (clientId) {
        const [c] = await tx.select({ id: clients.id }).from(clients).where(and(eq(clients.id, clientId), eq(clients.businessId, business.id)));
        if (!c) throw new BookingError("Cliente inexistente");
      } else {
        const firstName = str(fd, "clientFirstName");
        if (!firstName) throw new BookingError("Elegí un cliente o cargá uno nuevo");
        const [c] = await tx
          .insert(clients)
          .values({
            businessId: business.id,
            firstName,
            lastName: str(fd, "clientLastName"),
            phone: opt(fd, "clientPhone"),
            email: opt(fd, "clientEmail")?.toLowerCase() ?? null,
          })
          .returning();
        clientId = c.id;
      }

      const price = str(fd, "price") ? int(fd, "price", 0, 0) : ctx.service.price;
      const [created] = await tx
        .insert(appointments)
        .values({
          businessId: business.id,
          branchId: ids.branchId,
          professionalId: ids.professionalId,
          serviceId: ids.serviceId,
          clientId,
          serviceName: ctx.service.name,
          startsAt: start,
          endsAt: new Date(start.getTime() + ctx.service.durationMinutes * 60_000),
          blockEndsAt: blockEnd,
          price,
          status: "confirmed",
          notes: opt(fd, "notes"),
        })
        .returning({ id: appointments.id });
      return created.id;
    });

    revalidatePath("/panel", "layout");
    return { ok: true, message: "Turno agendado", id: appointmentId };
  } catch (err) {
    return fail(err);
  }
}

export async function rescheduleByBusinessAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  try {
    const { business } = await businessForAction();
    const db = await getDb();
    const id = str(fd, "id");
    const date = str(fd, "date");
    const minutes = hhmmToMinutes(str(fd, "time"));
    if (!isValidDateStr(date) || minutes == null) return { error: "Elegí fecha y hora" };
    const force = bool(fd, "force");

    await db.transaction(async (tx) => {
      const requestedPro = str(fd, "professionalId");
      const row = await lockAppointment(tx, id, { professionals: true, extraProfessionals: requestedPro ? [requestedPro] : [] });
      const a = row?.appointment;
      if (!a || a.businessId !== business.id) throw new BookingError("Turno inexistente");
      if (!["confirmed", "pending_payment"].includes(a.status)) throw new BookingError("Sólo se pueden reprogramar turnos activos");
      const professionalId = requestedPro || a.professionalId;
      const ctx = await getSlotContext(tx, business.id, { serviceId: a.serviceId, professionalId, branchId: a.branchId });
      if (!ctx) throw new BookingError("Ese profesional no presta el servicio en esta sucursal");
      const start = zonedToUtc(date, minutes, business.timezone);
      const blockEnd = new Date(start.getTime() + (a.blockEndsAt.getTime() - a.startsAt.getTime()));
      if (!force) await assertFree(tx, { businessId: business.id, professionalId, branchId: a.branchId, start, end: blockEnd, excludeId: a.id });
      await tx
        .update(appointments)
        .set({
          professionalId,
          startsAt: start,
          endsAt: new Date(start.getTime() + (a.endsAt.getTime() - a.startsAt.getTime())),
          blockEndsAt: blockEnd,
          reminderSentAt: null,
        })
        .where(eq(appointments.id, a.id));
    });
    revalidatePath("/panel", "layout");
    return { ok: true, message: "Turno reprogramado" };
  } catch (err) {
    return fail(err);
  }
}

export async function searchClientsAction(query: string) {
  const { business } = await businessForAction();
  const db = await getDb();
  const q = `%${query.trim().replace(/[%_]/g, "")}%`;
  return db
    .select({ id: clients.id, firstName: clients.firstName, lastName: clients.lastName, phone: clients.phone, email: clients.email })
    .from(clients)
    .where(
      and(
        eq(clients.businessId, business.id),
        or(
          ilike(sql`${clients.firstName} || ' ' || ${clients.lastName}`, q),
          ilike(clients.phone, q),
          ilike(clients.email, q),
        ),
      ),
    )
    .orderBy(clients.firstName)
    .limit(20);
}

/* ───────────── novedades y recordatorios ───────────── */

export async function markNotificationsReadAction(): Promise<void> {
  const { business } = await businessForAction();
  const db = await getDb();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.businessId, business.id), isNull(notifications.readAt)));
  revalidatePath("/panel", "layout");
}

/** Marca que se envió el recordatorio por WhatsApp (lo hace el negocio con un click). */
export async function markReminderSentAction(appointmentId: string): Promise<void> {
  const { business } = await businessForAction();
  const db = await getDb();
  await db
    .update(appointments)
    .set({ reminderSentAt: new Date() })
    .where(and(eq(appointments.id, appointmentId), eq(appointments.businessId, business.id)));
  revalidatePath("/panel/recordatorios");
}

/* ───────────── imágenes ───────────── */

/** Borra la imagen subida anterior cuando se reemplaza o se quita. */
async function deleteReplacedImage(db: Tx | Awaited<ReturnType<typeof getDb>>, businessId: string, previous: string | null | undefined, next: string | null) {
  const oldId = internalImageId(previous);
  if (oldId && previous !== next) {
    await db.delete(images).where(and(eq(images.id, oldId), eq(images.businessId, businessId)));
  }
}

export async function uploadImageAction(fd: FormData): Promise<{ url?: string; error?: string }> {
  const { business } = await businessForAction();
  const file = fd.get("file");
  if (!(file instanceof File)) return { error: "No llegó ninguna imagen" };
  if (file.size > MAX_IMAGE_BYTES) return { error: "La imagen es demasiado pesada" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImageType(bytes);
  if (!type) return { error: "El archivo no es una imagen JPG, PNG o WEBP" };
  const db = await getDb();
  const [row] = await db
    .insert(images)
    .values({ businessId: business.id, contentType: type, data: Buffer.from(bytes).toString("base64") })
    .returning({ id: images.id });
  return { url: `${IMAGE_PATH}${row.id}` };
}
