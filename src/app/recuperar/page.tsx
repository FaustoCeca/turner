"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { resetWithRecoveryCodeAction, type AuthState } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth-shell";
import { RecoveryCodeNotice } from "@/components/recovery-code-notice";
import { Alert, Field, Input, SubmitButton } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState<AuthState, FormData>(resetWithRecoveryCodeAction, {});
  const router = useRouter();

  if (state.ok && state.recoveryCode) {
    return (
      <AuthShell title="Contraseña actualizada" subtitle={state.message}>
        <p className="mb-4 text-sm text-neutral-600">El código que usaste ya no sirve. Este es tu código nuevo:</p>
        <RecoveryCodeNotice code={state.recoveryCode} onContinue={() => router.push("/mis-turnos")} continueLabel="Ir a mis turnos" />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Recuperar contraseña" subtitle="Usá el código de recuperación que guardaste al crear tu cuenta.">
      <form action={action} className="space-y-3">
        <Field label="Email">
          <Input name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Código de recuperación" hint="Formato XXXX-XXXX-XXXX">
          <Input name="code" autoComplete="off" autoCapitalize="characters" placeholder="K7QM-3XWP-9HDA" className="font-mono uppercase" required />
        </Field>
        <Field label="Nueva contraseña" hint="Mínimo 8 caracteres">
          <Input name="password" type="password" autoComplete="new-password" minLength={8} required />
        </Field>
        {state.error && <Alert>{state.error}</Alert>}
        <SubmitButton className="w-full">Cambiar contraseña</SubmitButton>
      </form>
      <p className="mt-4 text-center text-sm text-neutral-600">
        ¿Te acordaste?{" "}
        <Link href="/login" className="underline">
          Iniciar sesión
        </Link>
      </p>
    </AuthShell>
  );
}
