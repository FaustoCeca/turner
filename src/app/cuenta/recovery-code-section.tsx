"use client";

import { KeyRound } from "lucide-react";
import { useActionState, useState } from "react";
import { regenerateRecoveryCodeAction, type AuthState } from "@/app/actions/auth";
import { RecoveryCodeNotice } from "@/components/recovery-code-notice";
import { Alert, Button, Field, Input, SubmitButton, ActionForm } from "@/components/ui";

/** Genera un código de recuperación nuevo (para quien lo perdió o creó la cuenta antes de que existieran). */
export function RecoveryCodeSection({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState<AuthState, FormData>(regenerateRecoveryCodeAction, {});

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="flex items-center gap-2 font-bold">
        <KeyRound className="size-4" /> Código de recuperación
      </h2>
      <p className="mt-1 text-sm text-neutral-600">
        Es lo que te permite crear una contraseña nueva si te la olvidás. Si lo perdiste, generá uno nuevo: el anterior deja de funcionar.
      </p>
      {state.ok && state.recoveryCode ? (
        <div className="mt-4">
          <RecoveryCodeNotice code={state.recoveryCode} />
        </div>
      ) : open ? (
        <ActionForm action={action} className="mt-4 flex flex-wrap items-end gap-2">
          <input type="email" name="username" autoComplete="username" defaultValue={email} readOnly tabIndex={-1} aria-hidden className="sr-only" />
          <Field label="Tu contraseña actual" className="min-w-56 flex-1">
            <Input name="password" type="password" autoComplete="current-password" required />
          </Field>
          <SubmitButton>Generar código nuevo</SubmitButton>
          {state.error && (
            <div className="w-full">
              <Alert>{state.error}</Alert>
            </div>
          )}
        </ActionForm>
      ) : (
        <Button variant="secondary" className="mt-3" onClick={() => setOpen(true)}>
          Generar un código nuevo
        </Button>
      )}
    </section>
  );
}
