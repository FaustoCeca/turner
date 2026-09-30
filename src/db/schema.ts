import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { WeekSchedule } from "@/lib/schedule";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const tstz = (name: string) => timestamp(name, { withTimezone: true });

/* ───────────────────────── Usuarios y sesiones ───────────────────────── */

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone"),
  // Hash del código de recuperación (reemplaza al email para restablecer la contraseña).
  recoveryCodeHash: text("recovery_code_hash"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable(
  "sessions",
  {
    // SHA-256 del token que viaja en la cookie; el token en claro nunca se guarda.
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: tstz("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/* ───────────────────────────── Negocios ───────────────────────────── */

export const businesses = pgTable("businesses", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  slogan: text("slogan"),
  category: text("category"),
  logoUrl: text("logo_url"),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  timezone: text("timezone").notNull().default("America/Argentina/Buenos_Aires"),
  currency: text("currency").notNull().default("ARS"),

  // Apariencia de la página de reservas
  primaryColor: text("primary_color").notNull().default("#5d5def"),
  secondaryColor: text("secondary_color").notNull().default("#312f32"),
  backgroundColor: text("background_color").notNull().default("#fcf8ff"),

  // Contacto y redes
  whatsapp: text("whatsapp"),
  instagram: text("instagram"),
  facebook: text("facebook"),
  website: text("website"),
  termsAndConditions: text("terms_and_conditions"),

  // Configuración de reservas
  isOnline: boolean("is_online").notNull().default(true),
  requireDeposit: boolean("require_deposit").notNull().default(false),
  depositPercent: integer("deposit_percent").notNull().default(20),
  depositMinAmount: integer("deposit_min_amount").notNull().default(0),
  maxDaysInFuture: integer("max_days_in_future").notNull().default(30),
  minAnticipationMinutes: integer("min_anticipation_minutes").notNull().default(0),
  minAnticipationEditMinutes: integer("min_anticipation_edit_minutes").notNull().default(0),
  maxClientEdits: integer("max_client_edits").notNull().default(1),
  autoRefund: boolean("auto_refund").notNull().default(true),
  refundMinAnticipationMinutes: integer("refund_min_anticipation_minutes").notNull().default(0),
  showPrices: boolean("show_prices").notNull().default(true),
  // Minutos de cada hora en los que puede empezar un turno (ej. [0, 15, 30, 45]).
  slotMinutes: jsonb("slot_minutes").$type<number[]>().notNull().default([0, 15, 30, 45]),
  holdMinutes: integer("hold_minutes").notNull().default(15),

  // Mercado Pago (tokens cifrados con APP_SECRET)
  mpUserId: text("mp_user_id"),
  mpAccessToken: text("mp_access_token"),
  mpRefreshToken: text("mp_refresh_token"),
  mpPublicKey: text("mp_public_key"),
  mpTokenExpiresAt: tstz("mp_token_expires_at"),
  mpLiveMode: boolean("mp_live_mode"),

  // Suscripción a la plataforma
  trialEndsAt: tstz("trial_ends_at")
    .notNull()
    .default(sql`now() + interval '14 days'`),
  plan: text("plan"),
  subscriptionStatus: text("subscription_status").notNull().default("trial"),
  subscriptionId: text("subscription_id"),

  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const businessMembers = pgTable(
  "business_members",
  {
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "admin"] }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.userId] })],
);

export const branches = pgTable(
  "branches",
  {
    id: id(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name"),
    address: text("address").notNull(),
    city: text("city"),
    province: text("province"),
    postalCode: text("postal_code"),
    phone: text("phone"),
    lat: real("lat"),
    lng: real("lng"),
    order: integer("order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("branches_business_idx").on(t.businessId)],
);

export const services = pgTable(
  "services",
  {
    id: id(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    // "A tener en cuenta": se muestra al cliente al reservar y en la confirmación.
    notes: text("notes"),
    category: text("category"),
    modality: text("modality", { enum: ["Presencial", "Virtual", "A domicilio"] })
      .notNull()
      .default("Presencial"),
    price: integer("price").notNull().default(0),
    priceTBD: boolean("price_tbd").notNull().default(false),
    durationMinutes: integer("duration_minutes").notNull(),
    // Tiempo que ocupa en la agenda (puede ser mayor a la duración para dejar margen).
    blockingMinutes: integer("blocking_minutes").notNull(),
    depositEnabled: boolean("deposit_enabled").notNull().default(true),
    // null = usa el porcentaje del negocio.
    depositPercent: integer("deposit_percent"),
    isActive: boolean("is_active").notNull().default(true),
    isOnline: boolean("is_online").notNull().default(true),
    order: integer("order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("services_business_idx").on(t.businessId)],
);

export const professionals = pgTable(
  "professionals",
  {
    id: id(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull().default(""),
    email: text("email"),
    phone: text("phone"),
    avatarUrl: text("avatar_url"),
    bio: text("bio"),
    isActive: boolean("is_active").notNull().default(true),
    order: integer("order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("professionals_business_idx").on(t.businessId)],
);

/** Un profesional atiende en una sucursal con su propio horario semanal. */
export const professionalBranches = pgTable(
  "professional_branches",
  {
    id: id(),
    professionalId: text("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" }),
    schedule: jsonb("schedule").$type<WeekSchedule>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("professional_branch_unique").on(t.professionalId, t.branchId)],
);

/** Servicios que presta cada profesional y en qué días de la semana (0 = lunes). */
export const professionalServices = pgTable(
  "professional_services",
  {
    professionalId: text("professional_id")
      .notNull()
      .references(() => professionals.id, { onDelete: "cascade" }),
    serviceId: text("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    weekdays: jsonb("weekdays").$type<number[]>().notNull().default([0, 1, 2, 3, 4, 5, 6]),
  },
  (t) => [primaryKey({ columns: [t.professionalId, t.serviceId] })],
);

/** Bloqueos de agenda: vacaciones, feriados, trámites. professionalId null = todo el negocio. */
export const timeBlocks = pgTable(
  "time_blocks",
  {
    id: id(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    professionalId: text("professional_id").references(() => professionals.id, {
      onDelete: "cascade",
    }),
    branchId: text("branch_id").references(() => branches.id, { onDelete: "cascade" }),
    startsAt: tstz("starts_at").notNull(),
    endsAt: tstz("ends_at").notNull(),
    reason: text("reason"),
    createdAt: createdAt(),
  },
  (t) => [index("time_blocks_business_idx").on(t.businessId, t.startsAt)],
);

/** Ficha del cliente dentro de cada negocio (puede no tener cuenta si lo cargó el negocio). */
export const clients = pgTable(
  "clients",
  {
    id: id(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull().default(""),
    email: text("email"),
    phone: text("phone"),
    notes: text("notes"),
    depositExempt: boolean("deposit_exempt").notNull().default(false),
    isBlocked: boolean("is_blocked").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index("clients_business_idx").on(t.businessId),
    uniqueIndex("clients_business_user_unique")
      .on(t.businessId, t.userId)
      .where(sql`${t.userId} is not null`),
  ],
);

export const coupons = pgTable(
  "coupons",
  {
    id: id(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    discountType: text("discount_type", { enum: ["percent", "fixed"] }).notNull(),
    value: integer("value").notNull(),
    validFrom: tstz("valid_from"),
    validUntil: tstz("valid_until"),
    maxUses: integer("max_uses"),
    usesCount: integer("uses_count").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("coupons_business_code_unique").on(t.businessId, t.code)],
);

export const BOOKING_STATUS = ["pending_payment", "confirmed", "cancelled", "expired"] as const;
export const PAYMENT_STATUS = ["none", "pending", "approved", "rejected", "refunded"] as const;

/** Una reserva agrupa uno o más turnos que se pagan juntos (el "carrito"). */
export const bookings = pgTable(
  "bookings",
  {
    id: id(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    status: text("status", { enum: BOOKING_STATUS }).notNull(),
    source: text("source", { enum: ["online", "panel"] }).notNull().default("online"),
    subtotal: integer("subtotal").notNull(),
    discount: integer("discount").notNull().default(0),
    total: integer("total").notNull(),
    depositAmount: integer("deposit_amount").notNull().default(0),
    couponId: text("coupon_id").references(() => coupons.id, { onDelete: "set null" }),
    paymentStatus: text("payment_status", { enum: PAYMENT_STATUS }).notNull().default("none"),
    paymentProvider: text("payment_provider", { enum: ["mercadopago", "mock"] }),
    mpPreferenceId: text("mp_preference_id"),
    checkoutUrl: text("checkout_url"),
    paymentId: text("payment_id"),
    paidAmount: integer("paid_amount").notNull().default(0),
    refundedAmount: integer("refunded_amount").notNull().default(0),
    holdExpiresAt: tstz("hold_expires_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("bookings_business_idx").on(t.businessId, t.createdAt),
    index("bookings_pending_hold_idx").on(t.holdExpiresAt).where(sql`${t.status} = 'pending_payment'`),
  ],
);

export const APPOINTMENT_STATUS = [
  "pending_payment",
  "confirmed",
  "completed",
  "no_show",
  "cancelled",
  "expired",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUS)[number];

export const appointments = pgTable(
  "appointments",
  {
    id: id(),
    bookingId: text("booking_id").references(() => bookings.id, { onDelete: "cascade" }),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    branchId: text("branch_id")
      .notNull()
      .references(() => branches.id),
    professionalId: text("professional_id")
      .notNull()
      .references(() => professionals.id),
    serviceId: text("service_id")
      .notNull()
      .references(() => services.id),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id),
    serviceName: text("service_name").notNull(),
    startsAt: tstz("starts_at").notNull(),
    endsAt: tstz("ends_at").notNull(),
    // Fin del tiempo bloqueado en la agenda (startsAt + blockingMinutes).
    blockEndsAt: tstz("block_ends_at").notNull(),
    price: integer("price").notNull(),
    discount: integer("discount").notNull().default(0),
    depositAmount: integer("deposit_amount").notNull().default(0),
    status: text("status", { enum: APPOINTMENT_STATUS }).notNull(),
    notes: text("notes"),
    clientEdits: integer("client_edits").notNull().default(0),
    cancelledAt: tstz("cancelled_at"),
    cancelledBy: text("cancelled_by", { enum: ["client", "business", "system"] }),
    cancelReason: text("cancel_reason"),
    reminderSentAt: tstz("reminder_sent_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("appointments_professional_idx").on(t.professionalId, t.startsAt),
    index("appointments_business_idx").on(t.businessId, t.startsAt),
    index("appointments_client_idx").on(t.clientId),
    index("appointments_booking_idx").on(t.bookingId),
  ],
);

export const payments = pgTable(
  "payments",
  {
    id: id(),
    bookingId: text("booking_id")
      .notNull()
      .references(() => bookings.id, { onDelete: "cascade" }),
    provider: text("provider", { enum: ["mercadopago", "mock"] }).notNull(),
    externalId: text("external_id").notNull(),
    status: text("status").notNull(),
    statusDetail: text("status_detail"),
    amount: integer("amount").notNull(),
    raw: jsonb("raw"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("payments_provider_external_unique").on(t.provider, t.externalId)],
);

/** Novedades para el panel del negocio (reemplazan los emails al dueño). */
export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["booking", "cancellation", "reschedule", "refund"] }).notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    // Link interno (ej. la agenda del día del turno).
    href: text("href"),
    readAt: tstz("read_at"),
    createdAt: createdAt(),
  },
  (t) => [index("notifications_business_idx").on(t.businessId, t.createdAt)],
);

/* ─────────────────────────── Relaciones ─────────────────────────── */

export const businessesRelations = relations(businesses, ({ many, one }) => ({
  owner: one(users, { fields: [businesses.ownerId], references: [users.id] }),
  branches: many(branches),
  services: many(services),
  professionals: many(professionals),
}));

export const branchesRelations = relations(branches, ({ one, many }) => ({
  business: one(businesses, { fields: [branches.businessId], references: [businesses.id] }),
  professionals: many(professionalBranches),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  business: one(businesses, { fields: [services.businessId], references: [businesses.id] }),
  professionals: many(professionalServices),
}));

export const professionalsRelations = relations(professionals, ({ one, many }) => ({
  business: one(businesses, { fields: [professionals.businessId], references: [businesses.id] }),
  branches: many(professionalBranches),
  services: many(professionalServices),
}));

export const professionalBranchesRelations = relations(professionalBranches, ({ one }) => ({
  professional: one(professionals, {
    fields: [professionalBranches.professionalId],
    references: [professionals.id],
  }),
  branch: one(branches, { fields: [professionalBranches.branchId], references: [branches.id] }),
}));

export const professionalServicesRelations = relations(professionalServices, ({ one }) => ({
  professional: one(professionals, {
    fields: [professionalServices.professionalId],
    references: [professionals.id],
  }),
  service: one(services, { fields: [professionalServices.serviceId], references: [services.id] }),
}));

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  business: one(businesses, { fields: [bookings.businessId], references: [businesses.id] }),
  client: one(clients, { fields: [bookings.clientId], references: [clients.id] }),
  appointments: many(appointments),
  coupon: one(coupons, { fields: [bookings.couponId], references: [coupons.id] }),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  booking: one(bookings, { fields: [appointments.bookingId], references: [bookings.id] }),
  business: one(businesses, { fields: [appointments.businessId], references: [businesses.id] }),
  branch: one(branches, { fields: [appointments.branchId], references: [branches.id] }),
  professional: one(professionals, {
    fields: [appointments.professionalId],
    references: [professionals.id],
  }),
  service: one(services, { fields: [appointments.serviceId], references: [services.id] }),
  client: one(clients, { fields: [appointments.clientId], references: [clients.id] }),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  business: one(businesses, { fields: [clients.businessId], references: [businesses.id] }),
  user: one(users, { fields: [clients.userId], references: [users.id] }),
  appointments: many(appointments),
}));

export type User = typeof users.$inferSelect;
export type Business = typeof businesses.$inferSelect;
export type Branch = typeof branches.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Professional = typeof professionals.$inferSelect;
export type ProfessionalBranch = typeof professionalBranches.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
