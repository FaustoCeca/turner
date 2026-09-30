const isProd = process.env.NODE_ENV === "production";

function required(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isProd) throw new Error(`Falta la variable de entorno ${name}`);
  return devFallback;
}

export const env = {
  get appUrl() {
    return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  },
  get appName() {
    return process.env.NEXT_PUBLIC_APP_NAME ?? "Turner";
  },
  /** Clave para cifrar tokens de Mercado Pago en la base. */
  get appSecret() {
    return required("APP_SECRET", "dev-secret-cambiar-en-produccion-0123456789");
  },
  get cronSecret() {
    return process.env.CRON_SECRET;
  },
  mp: {
    get clientId() {
      return process.env.MP_CLIENT_ID;
    },
    get clientSecret() {
      return process.env.MP_CLIENT_SECRET;
    },
    get webhookSecret() {
      return process.env.MP_WEBHOOK_SECRET;
    },
    /** Pagos simulados: activos en desarrollo o si MP_MOCK=1. Nunca en producción salvo que se fuerce. */
    get mockEnabled() {
      if (process.env.MP_MOCK === "0") return false;
      return process.env.MP_MOCK === "1" || !isProd;
    },
    get oauthEnabled() {
      return Boolean(process.env.MP_CLIENT_ID && process.env.MP_CLIENT_SECRET);
    },
  },
};
