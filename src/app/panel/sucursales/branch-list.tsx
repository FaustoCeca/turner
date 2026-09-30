"use client";

import { MapPin, Pencil, Plus } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { FormMessage } from "@/components/panel-ui";
import { Badge, Button, Checkbox, Field, Input, Modal, SubmitButton } from "@/components/ui";
import type { Branch } from "@/db/schema";
import { deleteBranchAction, saveBranchAction, type ActionState } from "../actions";

export function BranchList({ branches }: { branches: Branch[] }) {
  const [editing, setEditing] = useState<Branch | "new" | null>(null);
  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setEditing("new")}>
          <Plus className="size-4" /> Nueva sucursal
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {branches.map((b) => (
          <div key={b.id} className="flex items-start justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4">
            <div>
              <p className="font-bold">{b.name || b.address}</p>
              <p className="mt-1 flex items-center gap-1 text-sm text-neutral-600">
                <MapPin className="size-4" /> {[b.address, b.city, b.province].filter(Boolean).join(", ")}
              </p>
              {b.phone && <p className="text-sm text-neutral-600">{b.phone}</p>}
              {!b.isActive && <Badge className="mt-2">Inactiva</Badge>}
            </div>
            <Button variant="ghost" onClick={() => setEditing(b)} aria-label="Editar">
              <Pencil className="size-4" />
            </Button>
          </div>
        ))}
      </div>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Nueva sucursal" : "Editar sucursal"}>
        {editing !== null && <BranchForm key={editing === "new" ? "new" : editing.id} branch={editing === "new" ? null : editing} onDone={() => setEditing(null)} />}
      </Modal>
    </>
  );
}

function BranchForm({ branch, onDone }: { branch: Branch | null; onDone: () => void }) {
  const [state, action] = useActionState<ActionState, FormData>(saveBranchAction, {});
  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);

  return (
    <>
      <form action={action} className="space-y-3">
        {branch && <input type="hidden" name="id" value={branch.id} />}
        <Field label="Nombre (opcional)">
          <Input name="name" defaultValue={branch?.name ?? ""} placeholder="Ej: Centro" />
        </Field>
        <Field label="Dirección">
          <Input name="address" defaultValue={branch?.address} placeholder="Salta 1724" required />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ciudad">
            <Input name="city" defaultValue={branch?.city ?? ""} />
          </Field>
          <Field label="Provincia">
            <Input name="province" defaultValue={branch?.province ?? ""} />
          </Field>
          <Field label="Código postal">
            <Input name="postalCode" defaultValue={branch?.postalCode ?? ""} />
          </Field>
          <Field label="Teléfono">
            <Input name="phone" defaultValue={branch?.phone ?? ""} />
          </Field>
          <Field label="Orden">
            <Input name="order" type="number" defaultValue={branch?.order ?? 0} />
          </Field>
        </div>
        <Checkbox name="isActive" defaultChecked={branch?.isActive ?? true} label="Activa (visible para reservar)" />
        <FormMessage state={state} />
        <SubmitButton className="w-full">Guardar</SubmitButton>
      </form>
      {branch && (
        <form action={deleteBranchAction} className="mt-4 text-center">
          <input type="hidden" name="id" value={branch.id} />
          <button className="text-sm text-red-600 underline" onClick={() => setTimeout(onDone, 0)}>
            Eliminar sucursal
          </button>
        </form>
      )}
    </>
  );
}
