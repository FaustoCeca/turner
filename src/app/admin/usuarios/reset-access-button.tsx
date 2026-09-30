"use client";

import { KeyRound, MessageCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { whatsappLink } from "@/lib/whatsapp";
import { adminResetRecoveryCodeAction } from "../actions";

export function ResetAccessButton({ userId, email, phone }: { userId: string; email: string; phone: string | null }) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (code) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const wa = whatsappLink(
      phone,
      `Hola! Tu código de recuperación es ${code}. Entrá a ${origin}/recuperar, poné tu email (${email}), este código y tu contraseña nueva.`,
    );
    return (
      <div className="text-right text-sm">
        <p className="font-mono text-lg font-bold tracking-widest">{code}</p>
        <p className="text-xs text-neutral-500">El código anterior dejó de funcionar.</p>
        {wa && (
          <a href={wa} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[#128c4a] underline">
            <MessageCircle className="size-4" /> Enviar por WhatsApp
          </a>
        )}
      </div>
    );
  }

  if (!confirming) {
    return (
      <Button variant="secondary" onClick={() => setConfirming(true)}>
        <KeyRound className="size-4" /> Rescatar acceso
      </Button>
    );
  }

  return (
    <div className="text-right text-sm">
      <p className="mb-2 max-w-64 text-neutral-600">Se genera un código nuevo y el anterior deja de servir. ¿Confirmás que hablaste con el titular?</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => setConfirming(false)}>
          No
        </Button>
        <Button
          loading={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await adminResetRecoveryCodeAction(userId);
              if (res.code) setCode(res.code);
              else setError(res.error ?? "Error");
            })
          }
        >
          Sí, generar código
        </Button>
      </div>
      {error && <p className="mt-1 text-red-600">{error}</p>}
    </div>
  );
}
