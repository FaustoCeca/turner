/** Planes de suscripción de la plataforma (precio mensual por profesional, en ARS). Editables. */
export const PLANS = [
  {
    id: "basico",
    name: "Básico",
    pricePerProfessional: 16900,
    features: [
      "Reservas online ilimitadas",
      "Turno en el calendario del cliente con alarma",
      "Recordatorios por WhatsApp en 1 click",
      "Bloqueo de agenda",
      "Términos y condiciones configurables",
      "Cupones de descuento",
    ],
  },
  {
    id: "profesional",
    name: "Profesional",
    pricePerProfessional: 28300,
    features: ["Todo lo del Básico", "Cobro de señas con Mercado Pago", "Varias sucursales", "Servicios con días específicos", "Exportar clientes"],
  },
  {
    id: "empresa",
    name: "Empresa",
    pricePerProfessional: 37700,
    features: ["Todo lo del Profesional", "Varios administradores", "Estadísticas de ventas", "Soporte prioritario"],
  },
] as const;

export type PlanId = (typeof PLANS)[number]["id"];

export const ANNUAL_DISCOUNT = 0.2;
