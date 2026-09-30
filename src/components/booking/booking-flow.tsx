"use client";

import {
  BellRing,
  Briefcase,
  CalendarDays,
  Check,
  Clock,
  Info,
  MapPin,
  PencilLine,
  PlusCircle,
  ShoppingCart,
  Ticket,
  Trash2,
  AlertCircle,
  ArrowRight,
  CircleCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useActionState, useCallback, useEffect, useMemo, useState } from "react";
import { AuthForm } from "@/components/auth-form";
import { RecoveryCodeNotice } from "@/components/recovery-code-notice";
import { updateProfileAction, type AccountState } from "@/app/actions/account";
import { Alert, Avatar, Button, Checkbox, cn, Input, Modal, ActionForm } from "@/components/ui";
import type { SessionUser } from "@/lib/auth";
import { formatMoney } from "@/lib/pricing";
import { formatSlot } from "@/lib/schedule";
import { DateSlotPicker } from "./date-picker";
import {
  fullName,
  mapsUrl,
  type BranchInfo,
  type CartItem,
  type DayAvailability,
  type ProfessionalGroup,
  type ProfessionalInfo,
  type PublicBusiness,
  type PublicService,
  type Quote,
} from "./types";

type Step = "service" | "professional" | "datetime" | "cart";
type ModalKind = "service" | "professional" | "checkout" | null;

const STEP_INDEX: Record<Exclude<Step, "cart">, number> = { service: 1, professional: 2, datetime: 3 };
const STEP_TITLE = { service: "Seleccionar Servicio", professional: "Seleccionar Profesional", datetime: "Seleccionar Fecha y hora" };

function storageKey(slug: string) {
  return `cart:${slug}`;
}

function loadCart(slug: string, timeZone: string): CartItem[] {
  try {
    const raw = sessionStorage.getItem(storageKey(slug));
    if (!raw) return [];
    // "Hoy" en la zona horaria del negocio (en-CA formatea como YYYY-MM-DD).
    const today = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
    return (JSON.parse(raw) as CartItem[]).filter((i) => i.date >= today);
  } catch {
    return [];
  }
}

function saveCart(slug: string, cart: CartItem[]) {
  try {
    if (cart.length) sessionStorage.setItem(storageKey(slug), JSON.stringify(cart));
    else sessionStorage.removeItem(storageKey(slug));
  } catch {
    // almacenamiento no disponible (modo privado): el carrito vive sólo en memoria
  }
}

function shortDate(date: string) {
  const [, m, d] = date.split("-");
  return `${d}/${m}`;
}

export function BookingFlow({
  business,
  services,
  user: initialUser,
}: {
  business: PublicBusiness;
  services: PublicService[];
  user: SessionUser | null;
}) {
  const router = useRouter();
  // La sesión viene del servidor (se actualiza sola al ingresar o registrarse); el estado local
  // sólo cubre el instante entre la respuesta de la acción y el nuevo render del servidor.
  const [loggedUser, setLoggedUser] = useState<SessionUser | null>(null);
  const user = initialUser ?? loggedUser;
  // Código de recuperación de una cuenta recién creada: vive acá para no perderse si se cierra el modal.
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  // Este componente se renderiza sólo en el navegador (ver booking-flow-loader), así que puede leer sessionStorage.
  const [cart, setCart] = useState<CartItem[]>(() => loadCart(business.slug, business.timezone));
  const [step, setStep] = useState<Step>(() => (cart.length ? "cart" : "service"));
  const [modal, setModal] = useState<ModalKind>(() => (cart.length ? null : "service"));

  // Selección en curso
  const [service, setService] = useState<PublicService | null>(null);
  const [groups, setGroups] = useState<ProfessionalGroup[] | null>(null);
  const [professional, setProfessional] = useState<ProfessionalInfo | null>(null);
  const [branch, setBranch] = useState<BranchInfo | null>(null);
  const [days, setDays] = useState<DayAvailability[] | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [minutes, setMinutes] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    saveCart(business.slug, cart);
  }, [cart, business.slug]);

  const categories = useMemo(() => {
    const map = new Map<string, PublicService[]>();
    for (const s of services) {
      const key = s.category?.trim() || "";
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.entries()];
  }, [services]);

  async function chooseService(s: PublicService) {
    setService(s);
    setProfessional(null);
    setBranch(null);
    setDays(null);
    setDate(null);
    setMinutes(null);
    setGroups(null);
    setLoadError(null);
    setStep("professional");
    setModal("professional");
    const res = await fetch(`/api/b/${business.slug}/professionals?serviceId=${s.id}`);
    if (!res.ok) return setLoadError("No pudimos cargar los profesionales.");
    setGroups((await res.json()).groups);
  }

  const loadAvailability = useCallback(
    async (s: PublicService, p: ProfessionalInfo, b: BranchInfo) => {
      setDays(null);
      setLoadError(null);
      const q = new URLSearchParams({ serviceId: s.id, professionalId: p.id, branchId: b.id });
      const res = await fetch(`/api/b/${business.slug}/availability?${q}`, { cache: "no-store" });
      if (!res.ok) return setLoadError("No pudimos cargar los horarios.");
      const data: { days: DayAvailability[] } = await res.json();
      setDays(data.days);
    },
    [business.slug],
  );

  function chooseProfessional(p: ProfessionalInfo, b: BranchInfo) {
    setProfessional(p);
    setBranch(b);
    setDate(null);
    setMinutes(null);
    setStep("datetime");
    setModal(null);
    if (service) void loadAvailability(service, p, b);
  }

  function addToCart() {
    if (!service || !professional || !branch || !date || minutes == null) return;
    setCart((c) => [...c, { key: crypto.randomUUID(), service, professional, branch, date, minutes }]);
    setService(null);
    setProfessional(null);
    setBranch(null);
    setDays(null);
    setDate(null);
    setMinutes(null);
    setStep("cart");
    setModal("checkout");
  }

  function startNewService() {
    setStep("service");
    setModal("service");
  }

  function removeItem(key: string) {
    setCart((c) => {
      const next = c.filter((i) => i.key !== key);
      if (!next.length) {
        setModal("service");
        setStep("service");
      }
      return next;
    });
  }

  // Horarios que ya están en el carrito con el mismo profesional no se ofrecen de nuevo.
  const visibleDays = useMemo(() => {
    if (!days || !professional || !service) return days;
    const taken = cart.filter((i) => i.professional.id === professional.id);
    if (!taken.length) return days;
    return days.map((d) => {
      const clashes = taken.filter((t) => t.date === d.date);
      if (!clashes.length) return d;
      const slots = d.slots.filter((m) =>
        clashes.every((t) => m + service.blockingMinutes <= t.minutes || t.minutes + t.service.blockingMinutes <= m),
      );
      return { ...d, slots, status: slots.length ? d.status : ("full" as const) };
    });
  }, [days, cart, professional, service]);

  const stepNumber = step === "cart" ? 3 : STEP_INDEX[step];

  return (
    <div className="mx-auto w-full max-w-[480px] px-4 pb-32 pt-6">
      {step !== "cart" && (
        <nav aria-label="Progreso de reserva" className="rounded-xl bg-white p-3 shadow-[0_4px_18px_rgba(93,93,239,0.18)]">
          <div className="mb-2 flex items-center justify-between px-1 text-[13px]">
            <span>
              Paso <b>{stepNumber}</b> de <b>3</b>
            </span>
            <span className="font-bold">{STEP_TITLE[step]}</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(["service", "professional", "datetime"] as const).map((s) => {
              const idx = STEP_INDEX[s];
              const done = idx < stepNumber || (s === "datetime" && minutes != null);
              const active = idx === stepNumber;
              const canGo = idx < stepNumber;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={!canGo}
                  onClick={() => {
                    if (s === "service") startNewService();
                    if (s === "professional") {
                      setStep("professional");
                      setModal("professional");
                    }
                  }}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-full border py-2 text-[13px] font-bold transition",
                    active ? "brand-soft border-brand/40 text-ink" : "border-neutral-200 text-neutral-400",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full text-[11px]",
                      done ? "brand-soft text-brand" : active ? "bg-brand/15 text-brand" : "bg-neutral-100",
                    )}
                  >
                    {done ? <Check className="size-3" strokeWidth={3} /> : idx}
                  </span>
                  {s === "service" ? "Servicio" : s === "professional" ? "Profesional" : "Horario"}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {step === "service" && (
        <button type="button" onClick={() => setModal("service")} className="mt-8 flex w-full items-center justify-center gap-2 text-xl font-bold">
          <BellRing className="size-5" /> Elegir servicio
        </button>
      )}

      {step === "professional" && service && (
        <>
          <ChosenService service={service} business={business} onEdit={startNewService} />
          <button type="button" onClick={() => setModal("professional")} className="mt-8 flex w-full items-center justify-center gap-2 text-xl font-bold">
            <Briefcase className="size-5" /> Elegir profesional
          </button>
        </>
      )}

      {step === "datetime" && service && professional && branch && (
        <>
          <ChosenService service={service} business={business} onEdit={startNewService} />
          <section className="mt-10">
            <SectionTitle
              icon={<Briefcase className="size-5" />}
              title="Profesional elegido"
              onEdit={() => {
                setStep("professional");
                setModal("professional");
              }}
            />
            <div className="flex items-center gap-4 rounded-xl border-2 border-neutral-200 bg-white px-4 py-3.5 shadow-sm">
              <Avatar name={fullName(professional)} src={professional.avatarUrl} size={32} />
              <div>
                <p className="text-lg">{fullName(professional)}</p>
                <p className="flex items-center gap-1 text-xs text-neutral-500">
                  <MapPin className="size-3" /> {branch.address}
                </p>
              </div>
            </div>
          </section>

          <section className="mt-10">
            <h3 className="mb-3 flex items-center gap-2 text-lg font-bold">
              <CalendarDays className="size-5" /> Elegir fecha y horario
            </h3>
            {loadError && <Alert>{loadError}</Alert>}
            {!visibleDays && !loadError && <p className="py-8 text-center text-sm text-neutral-500">Cargando horarios…</p>}
            {visibleDays && (
              <DateSlotPicker
                days={visibleDays}
                selectedDate={date}
                selectedMinutes={minutes}
                onSelectDate={(d) => {
                  setDate(d);
                  setMinutes(null);
                }}
                onSelectSlot={setMinutes}
              />
            )}
          </section>
        </>
      )}

      {step === "cart" && (
        <CartSummary cart={cart} business={business} onFinish={() => setModal("checkout")} onAdd={startNewService} />
      )}

      {step === "datetime" && minutes != null && (
        <div className="fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto max-w-[484px]">
            <Button onClick={addToCart} className="h-14 w-full text-xl font-medium uppercase shadow-lg">
              <ShoppingCart className="size-6" /> Continuar
            </Button>
          </div>
        </div>
      )}

      {/* Paso 1: servicios */}
      <Modal
        open={modal === "service"}
        onClose={() => setModal(null)}
        footer={
          <Button variant="ghost" className="w-full bg-neutral-100 text-base" onClick={() => setModal(null)}>
            Cerrar
          </Button>
        }
      >
        <h2 className="mb-5 mt-2 flex items-center justify-center gap-2 text-3xl font-bold">
          <BellRing className="size-7" /> Elegir servicio
        </h2>
        {services.length === 0 && (
          <p className="py-6 text-center text-neutral-600">Este negocio todavía no tiene servicios disponibles online.</p>
        )}
        {categories.map(([category, list]) => (
          <Fragment key={category}>
            {category && <h3 className="mb-2 mt-4 text-sm font-bold uppercase text-neutral-500">{category}</h3>}
            <div className="space-y-2.5">
              {list.map((s) => (
                <ServiceRow key={s.id} service={s} business={business} onSelect={() => chooseService(s)} />
              ))}
            </div>
          </Fragment>
        ))}
      </Modal>

      {/* Paso 2: profesionales por sucursal */}
      <Modal
        open={modal === "professional"}
        onClose={() => setModal(null)}
        footer={
          <Button variant="ghost" className="w-full bg-neutral-100 text-base" onClick={() => setModal(null)}>
            Cerrar
          </Button>
        }
      >
        <h2 className="mb-6 mt-2 flex items-center justify-center gap-2 text-3xl font-bold">
          <Briefcase className="size-7" /> Elegir profesional
        </h2>
        {loadError && <Alert>{loadError}</Alert>}
        {!groups && !loadError && <p className="py-6 text-center text-sm text-neutral-500">Cargando…</p>}
        {groups?.length === 0 && <p className="py-6 text-center text-neutral-600">No hay profesionales disponibles para este servicio.</p>}
        {groups?.map((g) => (
          <div key={g.branch.id} className="mb-8">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-2 py-1 text-[13px] font-bold">
                <MapPin className="size-3.5 text-brand" /> {[g.branch.address, g.branch.city].filter(Boolean).join(", ")}
              </span>
              <a href={mapsUrl(g.branch)} target="_blank" rel="noreferrer" className="text-sm underline underline-offset-2">
                Mapa
              </a>
            </div>
            <div className="space-y-2">
              {g.professionals.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => chooseProfessional(p, g.branch)}
                  className="flex w-full items-center gap-4 rounded-xl border-2 border-neutral-200 bg-white px-4 py-3 text-left text-[17px] transition hover:border-brand"
                >
                  <Avatar name={fullName(p)} src={p.avatarUrl} size={32} />
                  {fullName(p)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </Modal>

      {/* Carrito y confirmación */}
      <CheckoutModal
        open={modal === "checkout"}
        onClose={() => setModal(null)}
        business={business}
        cart={cart}
        user={user}
        recoveryCode={recoveryCode}
        onRecoveryDone={() => setRecoveryCode(null)}
        onUser={(u) => {
          setLoggedUser(u);
          router.refresh();
        }}
        onRegistered={(u, code) => {
          setLoggedUser(u);
          setRecoveryCode(code);
        }}
        onRemove={removeItem}
        onAddService={() => {
          setModal("service");
          setStep("service");
        }}
        onSlotTaken={() => setModal(null)}
      />
    </div>
  );
}

function priceLabel(s: PublicService, business: PublicBusiness) {
  if (!business.showPrices) return null;
  return s.priceTBD ? "A definir" : formatMoney(s.price, business.currency);
}

function ServiceRow({ service, business, onSelect }: { service: PublicService; business: PublicBusiness; onSelect: () => void }) {
  const [open, setOpen] = useState(false);
  const hasInfo = Boolean(service.description || service.notes);
  return (
    <div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onSelect}
          className="flex flex-1 items-center justify-between gap-3 rounded-xl border-2 border-neutral-200 bg-white px-4 py-2.5 text-left transition hover:border-brand"
        >
          <div>
            <p className="font-bold">{service.name}</p>
            <span className="mt-0.5 inline-block rounded-full border border-neutral-200 px-2 text-[11px]">{service.modality}</span>
          </div>
          <div className="text-right">
            {priceLabel(service, business) && <p className="font-bold text-brand">{priceLabel(service, business)}</p>}
            <p>{service.durationMinutes} min</p>
          </div>
        </button>
        {hasInfo && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label={`Ver detalle de ${service.name}`}
            className={cn("rounded-full", open ? "text-brand" : "text-ink")}
          >
            <Info className="size-6" fill="currentColor" stroke="white" />
          </button>
        )}
      </div>
      {open && (
        <div className="px-1 pb-2 pt-3 text-[15px]">
          {service.description && (
            <>
              <h3 className="font-bold underline underline-offset-4">Descripción</h3>
              <p className="mt-1 whitespace-pre-line">{service.description}</p>
            </>
          )}
          {service.notes && (
            <>
              <h3 className="mt-3 font-bold underline underline-offset-4">A tener en cuenta</h3>
              <p className="mt-1 whitespace-pre-line">{service.notes}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SectionTitle({ icon, title, onEdit }: { icon: React.ReactNode; title: string; onEdit: () => void }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h3 className="flex items-center gap-2 text-lg font-bold">
        {icon} {title}
      </h3>
      <button type="button" onClick={onEdit} className="flex items-center gap-1.5 text-[15px]">
        <PencilLine className="size-4" /> Modificar
      </button>
    </div>
  );
}

function ChosenService({ service, business, onEdit }: { service: PublicService; business: PublicBusiness; onEdit: () => void }) {
  return (
    <section className="mt-6">
      <SectionTitle icon={<BellRing className="size-5" />} title="Servicio elegido" onEdit={onEdit} />
      <div className="flex items-center justify-between rounded-xl border-2 border-neutral-200 bg-white px-4 py-3 shadow-sm">
        <div>
          <p className="text-lg font-bold">{service.name}</p>
          <span className="inline-block rounded-full border border-neutral-200 px-2 text-xs">{service.modality}</span>
        </div>
        <div className="text-right">
          {priceLabel(service, business) && <p className="text-lg font-bold text-brand">{priceLabel(service, business)}</p>}
          <p>{service.durationMinutes} min</p>
        </div>
      </div>
    </section>
  );
}

function CartSummary({
  cart,
  business,
  onFinish,
  onAdd,
}: {
  cart: CartItem[];
  business: PublicBusiness;
  onFinish: () => void;
  onAdd: () => void;
}) {
  const total = cart.reduce((a, i) => a + (i.service.priceTBD ? 0 : i.service.price), 0);
  return (
    <div className="space-y-6">
      <div className="brand-soft flex items-center gap-3 rounded-xl p-4 shadow-[0_4px_18px_rgba(93,93,239,0.18)] ring-2 ring-brand/20">
        <span className="flex size-10 items-center justify-center rounded-full bg-white/60 text-brand">
          <ShoppingCart className="size-5" />
        </span>
        <div className="flex-1">
          <p className="text-lg font-bold">Detalle de tu reserva</p>
          <p className="flex items-center gap-1 text-xs">
            <CircleCheck className="size-4 fill-brand text-white" /> {cart.length} {cart.length === 1 ? "servicio agregado" : "servicios agregados"}
          </p>
        </div>
        <div className="text-right">
          {business.showPrices && (
            <>
              <p className="text-xs">Total</p>
              <p className="text-lg font-bold">{formatMoney(total, business.currency)}</p>
            </>
          )}
          <Button onClick={onFinish} className="mt-1 rounded-xl px-3 py-1.5 text-sm font-bold">
            Finalizar <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="flex w-full items-center gap-3 rounded-xl border-2 border-neutral-200 bg-white px-4 py-4 text-xl font-bold shadow-sm transition hover:border-brand"
      >
        <BellRing className="size-5" /> Agregar un nuevo servicio
      </button>
    </div>
  );
}

function CheckoutModal({
  open,
  onClose,
  business,
  cart,
  user,
  recoveryCode,
  onRecoveryDone,
  onUser,
  onRegistered,
  onRemove,
  onAddService,
  onSlotTaken,
}: {
  open: boolean;
  onClose: () => void;
  business: PublicBusiness;
  cart: CartItem[];
  user: SessionUser | null;
  recoveryCode: string | null;
  onRecoveryDone: () => void;
  onUser: (u: SessionUser) => void;
  onRegistered: (u: SessionUser, code: string) => void;
  onRemove: (key: string) => void;
  onAddService: () => void;
  onSlotTaken: () => void;
}) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<string | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const serviceIds = cart.map((i) => i.service.id).join(",");

  useEffect(() => {
    if (!open || !serviceIds) return;
    let cancelled = false;
    fetch(`/api/b/${business.slug}/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serviceIds: serviceIds.split(","), couponCode: coupon }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((q: Quote | null) => {
        if (!cancelled) setQuote(q);
      });
    return () => {
      cancelled = true;
    };
  }, [open, serviceIds, coupon, user?.id, business.slug]);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/b/${business.slug}/bookings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((i) => ({
            serviceId: i.service.id,
            professionalId: i.professional.id,
            branchId: i.branch.id,
            date: i.date,
            minutes: i.minutes,
          })),
          couponCode: quote?.coupon?.code ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No pudimos crear la reserva");
        setSubmitting(false);
        return;
      }
      saveCart(business.slug, []);
      window.location.assign(data.redirectUrl);
    } catch {
      setError("Error de conexión. Revisá tu internet y volvé a intentar.");
      setSubmitting(false);
    }
  }

  const deposit = quote?.deposit ?? 0;
  const needsTerms = Boolean(business.termsAndConditions);
  const canSubmit =
    Boolean(user?.phone) && !recoveryCode && cart.length > 0 && quote !== null && (!needsTerms || acceptTerms);

  return (
    <Modal
      open={open}
      onClose={onClose}
      footer={
        <div>
          {error && (
            <div className="mb-3">
              <Alert>{error}</Alert>
              {error.includes("horario") && (
                <button type="button" className="mt-1 text-sm underline" onClick={onSlotTaken}>
                  Elegir otro horario
                </button>
              )}
            </div>
          )}
          <Button onClick={submit} disabled={!canSubmit} loading={submitting} className="h-14 w-full text-lg">
            {deposit > 0 ? `Abonar seña (${formatMoney(deposit, business.currency)})` : cart.length > 1 ? "Confirmar turnos" : "Confirmar turno"}
          </Button>
          {deposit > 0 && (
            <p className="mt-3 text-[13px]">
              <AlertCircle className="mr-1 inline size-4 fill-red-500 text-white" />
              <b className="text-red-500">Seña obligatoria</b>:{" "}
              {quote?.paymentMode === "mock"
                ? "modo de prueba, el pago se simula sin cobrar."
                : "tarjeta de crédito/débito, saldo en Mercado Pago o efectivo en Rapipago."}
            </p>
          )}
          <button type="button" onClick={onAddService} className="mx-auto mt-3 flex items-center gap-2 text-[15px] underline underline-offset-4">
            <PlusCircle className="size-4 text-neutral-400" /> Añadir otro servicio
          </button>
        </div>
      }
    >
      <button type="button" onClick={onClose} aria-label="Cerrar" className="absolute right-3 top-3 rounded-full bg-white px-2 text-sm shadow">
        x
      </button>
      <div className="flex items-center justify-between gap-3 border-b border-dashed border-neutral-300 pb-2 pr-6">
        <h3 className="text-2xl font-bold">{cart.length > 1 ? "Turnos a reservar" : "Turno a reservar"}</h3>
        {business.showPrices && quote && <p className="text-2xl font-bold text-brand">{formatMoney(quote.total, business.currency)}</p>}
      </div>

      <div className="mt-2 space-y-3">
        {cart.map((item, idx) => (
          <div key={item.key} className="space-y-3 rounded-lg border border-neutral-200 p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar name={fullName(item.professional)} src={item.professional.avatarUrl} size={24} />
                <span>
                  {item.professional.firstName} {item.professional.lastName.slice(0, 1)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <CalendarDays className="size-4" /> {shortDate(item.date)}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="size-4" /> {formatSlot(item.minutes).padStart(5, "0")}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-3">
                <BellRing className="size-4" /> {item.service.name}{" "}
                <span className="text-sm text-neutral-500">({item.service.durationMinutes} min)</span>
              </span>
              {business.showPrices && (
                <span>
                  {item.service.priceTBD
                    ? "A definir"
                    : quote?.items[idx]?.discount
                      ? formatMoney(quote.items[idx].final, business.currency)
                      : formatMoney(item.service.price, business.currency)}
                </span>
              )}
            </div>
            <a href={mapsUrl(item.branch)} target="_blank" rel="noreferrer" className="flex items-center gap-3">
              <MapPin className="size-4" /> {[item.branch.address, item.branch.city].filter(Boolean).join(", ")}
            </a>
            <div className="flex justify-end">
              <button type="button" onClick={() => onRemove(item.key)} aria-label="Quitar turno" className="text-red-500">
                <Trash2 className="size-4" />
              </button>
            </div>
          </div>
        ))}

        <div className="text-center">
          {!couponOpen && !quote?.coupon ? (
            <button type="button" onClick={() => setCouponOpen(true)} className="inline-flex items-center gap-2 underline underline-offset-4">
              <Ticket className="size-4" /> Tengo código de descuento
            </button>
          ) : quote?.coupon ? (
            <p className="text-sm text-emerald-700">
              Código <b>{quote.coupon.code}</b> aplicado: −{formatMoney(quote.discount, business.currency)}{" "}
              <button type="button" className="ml-1 underline" onClick={() => { setCoupon(null); setCouponInput(""); }}>
                quitar
              </button>
            </p>
          ) : (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setCoupon(couponInput.trim() || null);
              }}
            >
              <Input value={couponInput} onChange={(e) => setCouponInput(e.target.value.toUpperCase())} placeholder="Código de descuento" aria-label="Código de descuento" />
              <Button type="submit" variant="dark">
                Aplicar
              </Button>
            </form>
          )}
          {quote?.couponError && <p className="mt-1 text-sm text-red-600">{quote.couponError}</p>}
        </div>
      </div>

      <div className="mt-6">
        {recoveryCode ? (
          <RecoveryCodeNotice code={recoveryCode} onContinue={onRecoveryDone} continueLabel="Continuar con la reserva" />
        ) : user && !user.phone ? (
          <PhonePrompt />
        ) : user ? (
          <p className="rounded-lg bg-neutral-50 px-3 py-2 text-sm">
            Reservando como <b>{user.firstName} {user.lastName}</b> ({user.email})
          </p>
        ) : (
          <AuthForm onSuccess={onUser} onRegistered={onRegistered} title="Iniciá sesión para reservar" />
        )}
        {needsTerms && (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer font-medium">Términos y condiciones del negocio</summary>
            <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-line rounded bg-neutral-50 p-2 text-neutral-700">
              {business.termsAndConditions}
            </p>
          </details>
        )}
        {needsTerms && (
          <Checkbox className="mt-2" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} label="Leí y acepto los términos y condiciones" />
        )}
      </div>
    </Modal>
  );
}

/** Cuentas creadas antes de que el teléfono fuera obligatorio: se pide antes de reservar. */
function PhonePrompt() {
  const router = useRouter();
  const [state, action] = useActionState<AccountState, FormData>(async (prev, fd) => {
    const res = await updateProfileAction(prev, fd);
    if (res.ok) router.refresh();
    return res;
  }, {});
  return (
    <ActionForm action={action} className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
      <p className="text-sm">
        Agregá tu teléfono para que el negocio pueda avisarte por WhatsApp si hay algún cambio en tu turno.
      </p>
      <div className="flex gap-2">
        <Input name="phone" type="tel" autoComplete="tel" placeholder="341 123 4567" aria-label="Teléfono" required />
        <Button type="submit" variant="dark">
          Guardar
        </Button>
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
    </ActionForm>
  );
}
