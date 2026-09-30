"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Modal } from "@/components/ui";
import { ClientForm } from "./client-form";

export function NewClientButton() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Nuevo cliente
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo cliente">
        {open && (
          <ClientForm
            client={null}
            onSaved={(id) => {
              setOpen(false);
              router.push(`/panel/clientes/${id}`);
            }}
          />
        )}
      </Modal>
    </>
  );
}
