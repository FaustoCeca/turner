"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  changePasswordAction,
  deleteAccountAction,
  updateProfileAction,
  type AccountState,
} from "@/app/actions/account";
import { Alert, Button, Field, Input, SubmitButton, ActionForm } from "@/components/ui";

function Message({ state }: { state: AccountState }) {
  if (state.error) return <Alert>{state.error}</Alert>;
  if (state.ok && state.message) return <Alert tone="green">{state.message}</Alert>;
  return null;
}

export function AccountForms({ user, email }: { user: { firstName: string; lastName: string; phone: string }; email: string }) {
  const [profile, profileAction] = useActionState<AccountState, FormData>(updateProfileAction, {});
  const [password, passwordAction] = useActionState<AccountState, FormData>(changePasswordAction, {});
  const [removal, removalAction] = useActionState<AccountState, FormData>(deleteAccountAction, {});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const passwordForm = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (password.ok) passwordForm.current?.reset();
  }, [password]);

  return (
    <>
      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="font-bold">Tus datos</h2>
        <ActionForm action={profileAction} className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Nombre">
            <Input name="firstName" defaultValue={user.firstName} autoComplete="given-name" required />
          </Field>
          <Field label="Apellido">
            <Input name="lastName" defaultValue={user.lastName} autoComplete="family-name" required />
          </Field>
          <Field label="Teléfono (WhatsApp)" hint="Los negocios donde reservaste ven este número" className="sm:col-span-2">
            <Input name="phone" type="tel" defaultValue={user.phone} autoComplete="tel" placeholder="341 123 4567" required />
          </Field>
          <div className="sm:col-span-2">
            <Message state={profile} />
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>Guardar</SubmitButton>
          </div>
        </ActionForm>
      </section>

      <section className="rounded-xl border border-neutral-200 bg-white p-5">
        <h2 className="font-bold">Contraseña</h2>
        <ActionForm ref={passwordForm} action={passwordAction} className="mt-4 grid gap-3 sm:grid-cols-2">
          {/* Usuario oculto: permite que los gestores de contraseñas asocien la clave a la cuenta. */}
          <input type="email" name="username" autoComplete="username" defaultValue={email} readOnly tabIndex={-1} aria-hidden className="sr-only" />
          <Field label="Contraseña actual">
            <Input name="currentPassword" type="password" autoComplete="current-password" required />
          </Field>
          <Field label="Contraseña nueva" hint="Mínimo 8 caracteres">
            <Input name="newPassword" type="password" autoComplete="new-password" minLength={8} required />
          </Field>
          <div className="sm:col-span-2">
            <Message state={password} />
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>Cambiar contraseña</SubmitButton>
          </div>
        </ActionForm>
      </section>

      <section className="rounded-xl border border-red-200 bg-white p-5">
        <h2 className="font-bold text-red-700">Eliminar cuenta</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Se borran tu usuario y tus datos de acceso. Los negocios conservan el historial de los turnos que tomaste.
        </p>
        {!confirmDelete ? (
          <Button variant="secondary" className="mt-3 text-red-600" onClick={() => setConfirmDelete(true)}>
            Quiero eliminar mi cuenta
          </Button>
        ) : (
          <ActionForm action={removalAction} className="mt-3 flex flex-wrap items-end gap-2">
            <input type="email" name="username" autoComplete="username" defaultValue={email} readOnly tabIndex={-1} aria-hidden className="sr-only" />
            <Field label="Confirmá con tu contraseña" className="min-w-56 flex-1">
              <Input name="password" type="password" autoComplete="current-password" required />
            </Field>
            <SubmitButton variant="danger">Eliminar definitivamente</SubmitButton>
            <div className="w-full">
              <Message state={removal} />
            </div>
          </ActionForm>
        )}
      </section>
    </>
  );
}
