# Turner — turnos online con seña por Mercado Pago

Plataforma de reservas para negocios que trabajan con turnos (barberías, estética, consultorios…), con el mismo flujo que tuturno.io:

- **Clientes**: eligen servicio → profesional (agrupado por sucursal) → día y horario. Pueden sumar varios servicios al carrito, usar un cupón, crear su cuenta con email y contraseña y pagar la seña con Mercado Pago. Desde **Mis turnos** cancelan (con devolución automática de la seña si cancelan a tiempo), reprograman y agregan el turno a su calendario.
- **Negocios**: sucursales; servicios (precio, duración, tiempo que ocupa en agenda, seña por servicio, días en que se ofrece); profesionales con horario semanal por sucursal (franjas cortadas) y bloqueos de agenda. Además: agenda diaria por profesional, turnos manuales, novedades, recordatorios por WhatsApp, clientes (notas, sin seña, bloqueados, exportación CSV), cupones, estadísticas, colores de la página, reglas de reserva y cancelación, vinculación de Mercado Pago y suscripción a la plataforma.

## Funciona sin enviar emails

La app no manda ningún email. Donde otras plataformas usan email:

| Necesidad | Cómo se resuelve |
| --- | --- |
| Confirmación al cliente | Pantalla de confirmación y *Mis turnos*, con "A tener en cuenta" del servicio |
| Recordatorio al cliente | "Agregar al calendario" (Google o archivo .ics para iPhone/Outlook) con alarmas 1 día y 2 horas antes |
| Recordatorio desde el negocio | *Panel → Recordatorios*: turnos de mañana con un botón de WhatsApp y el mensaje ya escrito; marca cuáles se enviaron |
| Aviso al negocio de reservas, cancelaciones y cambios | *Panel → Novedades* (campanita con contador). Con el panel abierto se actualiza solo y puede mostrar avisos del navegador |
| Aviso al cliente de cambios hechos por el negocio | Botón de WhatsApp con el mensaje ya escrito (por ejemplo, al cancelar) |
| Olvidé mi contraseña | **Código de recuperación**: se muestra una sola vez al crear la cuenta. Con email + código se crea una contraseña nueva y se entrega un código nuevo. Desde *Mis turnos* se puede generar otro (pide la contraseña actual) |

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Drizzle ORM · PostgreSQL · SDK oficial de Mercado Pago · Vitest.

## Correr en local

```bash
npm install
npm run db:seed   # datos de demostración (con PGlite, ejecutalo con el servidor detenido)
npm run dev
```

Sin `DATABASE_URL`, en desarrollo se usa **PGlite** (Postgres embebido) guardado en `.data/`, así que no hace falta instalar nada. Las migraciones se aplican solas.

Usuarios de la demo (contraseña `demo1234`, código de recuperación `DEMO-2345-TEST`):

| Rol | Email | Dónde |
| --- | --- | --- |
| Negocio | `negocio@demo.test` | http://localhost:3000/panel |
| Cliente | `cliente@demo.test` | http://localhost:3000/barberia-demo |

Cupón de prueba: `BIENVENIDA` (10 %). En desarrollo las señas se pagan con un **checkout simulado**. Para probar Mercado Pago real, vinculá un Access Token `TEST-…` en *Configuración → Mercado Pago*.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm test` | Tests: disponibilidad, señas, pagos/devoluciones, códigos de recuperación, calendario |
| `npm run typecheck` / `npm run lint` | Verificaciones estáticas |
| `npm run db:generate` | Genera una migración a partir de `src/db/schema.ts` |
| `npm run db:migrate` | Aplica migraciones sobre `DATABASE_URL` |
| `npm run db:seed` | Carga la demo |

## Producción: Vercel (plan gratuito) + Postgres en tu VPS

### 1. Postgres en el VPS (Ubuntu/Debian)

```bash
sudo apt install postgresql
sudo -u postgres psql -c "CREATE USER turnero WITH PASSWORD 'UNA-CLAVE-LARGA';" -c "CREATE DATABASE turnero OWNER turnero;"
```

- En `postgresql.conf`: `listen_addresses = '*'`. Ubuntu ya trae `ssl = on` con un certificado autofirmado.
- En `pg_hba.conf`, aceptar **sólo conexiones cifradas** para esa base:
  `hostssl turnero turnero 0.0.0.0/0 scram-sha-256`
  Vercel no tiene IPs fijas en el plan gratuito, así que no se puede restringir por IP: la protección es TLS + contraseña larga.
- Abrir el puerto: `sudo ufw allow 5432/tcp` y `sudo systemctl restart postgresql`.
- **Backups**: sin base administrada, los backups son tuyos. Por ejemplo, con un cron diario:
  `pg_dump -Fc turnero > /backups/turnero-$(date +%F).dump`
  Además, copialos fuera del VPS.

### 2. Variables en Vercel

- `DATABASE_URL=postgres://turnero:CLAVE@IP_DEL_VPS:5432/turnero?sslmode=require`
- `DATABASE_CA_CERT`: opcional pero recomendado. Es el contenido de `/etc/ssl/certs/ssl-cert-snakeoil.pem`; con él, la app verifica que se conecta a tu servidor.
- `APP_URL=https://TU-PROYECTO.vercel.app`
- `APP_SECRET`, `CRON_SECRET` y las credenciales de Mercado Pago (ver `.env.example`).

### 3. Migraciones y región

- Desde tu máquina: `DATABASE_URL=... npm run db:migrate`.
- En Vercel: *Settings → Functions → Function Region*, elegí la región **más cercana a tu VPS** (cada página hace varias consultas a la base).

### Notas del plan gratuito de Vercel

- Los cron corren **una vez por día**: `vercel.json` programa `/api/cron` a las 9 UTC para limpiar reservas vencidas. Igual, las páginas liberan las reservas sin pagar al cargarse, así que no depende del cron.
- El plan Hobby de Vercel está pensado para uso personal/no comercial. Cuando empieces a cobrar suscripciones conviene pasar a Pro o correr la app en tu VPS.

### Mercado Pago

- **Señas**: cada negocio vincula su propia cuenta (OAuth con `MP_CLIENT_ID`/`MP_CLIENT_SECRET`, o pegando su Access Token). Las señas se acreditan directo en la cuenta del negocio.
- **Redirect URI de OAuth**: `https://TU-PROYECTO.vercel.app/api/mercadopago/callback`.
- **Webhooks**: `https://TU-PROYECTO.vercel.app/api/webhooks/mercadopago`, eventos *Pagos* y *Planes y suscripciones*. El webhook nunca confía en el cuerpo recibido: vuelve a consultar el pago a la API de Mercado Pago y aplicarlo es idempotente.
- **Suscripciones de los negocios**: se crean con `MP_PLATFORM_ACCESS_TOKEN`. Los precios están en `src/lib/plans.ts`.

## Cómo funciona la agenda

- Los horarios se calculan en bloques de 15 minutos (`src/lib/availability.ts`). Un turno ocupa `blockingMinutes` en la agenda del profesional en **todas** sus sucursales.
- Al reservar se bloquean las filas de los profesionales (`SELECT … FOR UPDATE`) y se vuelve a validar el horario dentro de la transacción. Así, dos clientes no pueden quedarse con el mismo turno. Los locks siguen un orden fijo (reserva → profesionales → turno) para evitar deadlocks.
- Si hay seña, el turno queda reservado `holdMinutes` (15 por defecto) esperando el pago. Si el pago llega tarde y el horario ya se ocupó (o el turno ya pasó), se devuelve automáticamente. Los pagos duplicados también se devuelven.
- Pagos en efectivo (Rapipago/Pago Fácil) extienden la reserva hasta el vencimiento del cupón.

## Pendiente respecto de tuturno.io

Facturación electrónica AFIP, recetas médicas, WhatsApp automático (hoy es con un click), WhatsApp marketing, caja/stock/liquidación de sueldos, invitación de profesionales con usuario propio y roles cajero/administrativo, cuentas de Mercado Pago por profesional, login con Google, subida de imágenes (hoy logo y fotos son URLs) e integración con Tienda Nube.
