"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { loginAction, registerAction, type AuthState } from "@/app/actions/auth";
import type { SessionUser } from "@/lib/auth";
import { RecoveryCodeNotice } from "./recovery-code-notice";
import { Alert, cn, Field, Input, SubmitButton } from "./ui";

export function AuthForm({
  initialMode = "login",
  next,
  onSuccess,
  onRegistered,
  title,
}: {
  initialMode?: "login" | "register";
  next?: string;
  onSuccess?: (user: SessionUser) => void;
  /** Si se pasa, quien usa el formulario se encarga de mostrar el código de recuperación. */
  onRegistered?: (user: SessionUser, recoveryCode: string) => void;
  /** Título que se muestra sólo mientras se ve el formulario (no con el código de recuperación). */
  title?: string;
}) {
  const [mode, setMode] = useState(initialMode);
  // Los avisos se disparan apenas responde la acción (no en un efecto): al crear la cuenta el servidor
  // vuelve a renderizar con la sesión nueva y este formulario puede desmontarse en ese mismo render.
  const [loginState, loginFormAction] = useActionState<AuthState, FormData>(async (prev, fd) => {
    const res = await loginAction(prev, fd);
    if (res.ok && res.user) onSuccess?.(res.user);
    return res;
  }, {});
  const [registerState, registerFormAction] = useActionState<AuthState, FormData>(async (prev, fd) => {
    const res = await registerAction(prev, fd);
    if (res.ok && res.user && res.recoveryCode) onRegistered?.(res.user, res.recoveryCode);
    return res;
  }, {});

  // Cuenta recién creada: primero se muestra el código de recuperación, después se continúa.
  if (!onRegistered && registerState.ok && registerState.user && registerState.recoveryCode) {
    const user = registerState.user;
    return (
      <RecoveryCodeNotice
        code={registerState.recoveryCode}
        onContinue={() => {
          if (next) window.location.assign(next);
          else onSuccess?.(user);
        }}
      />
    );
  }

  return (
    <div>
      {title && <h3 className="mb-3 text-center text-lg font-bold">{title}</h3>}
      <div className="mb-4 grid grid-cols-2 rounded-lg bg-neutral-100 p-1 text-sm font-medium" role="tablist">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn("rounded-md py-2 transition", mode === m ? "bg-white shadow-sm" : "text-neutral-500")}
          >
            {m === "login" ? "Ingresar" : "Crear cuenta"}
          </button>
        ))}
      </div>

      {mode === "login" ? (
        <form action={loginFormAction} className="space-y-3">
          {next && <input type="hidden" name="next" value={next} />}
          <Field label="Email">
            <Input name="email" type="email" autoComplete="email" placeholder="Ingresá tu email" required />
          </Field>
          <Field label="Contraseña">
            <Input name="password" type="password" autoComplete="current-password" required />
          </Field>
          {loginState.error && <Alert>{loginState.error}</Alert>}
          <SubmitButton className="w-full">Ingresar</SubmitButton>
          <p className="text-center text-sm">
            <Link href="/recuperar" className="text-neutral-600 underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </p>
        </form>
      ) : (
        <form action={registerFormAction} className="space-y-3">
          {next && <input type="hidden" name="next" value={next} />}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre">
              <Input name="firstName" autoComplete="given-name" required />
            </Field>
            <Field label="Apellido">
              <Input name="lastName" autoComplete="family-name" required />
            </Field>
          </div>
          <Field label="Email">
            <Input name="email" type="email" autoComplete="email" required />
          </Field>
          <Field label="Teléfono (opcional)" hint="Con código de área, para que el negocio te recuerde el turno por WhatsApp">
            <Input name="phone" type="tel" autoComplete="tel" placeholder="341 123 4567" />
          </Field>
          <Field label="Contraseña" hint="Mínimo 8 caracteres">
            <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
          </Field>
          {registerState.error && <Alert>{registerState.error}</Alert>}
          <SubmitButton className="w-full">Crear cuenta</SubmitButton>
        </form>
      )}
    </div>
  );
}
