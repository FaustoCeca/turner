"use client";

import { Check, Copy, KeyRound } from "lucide-react";
import { useState } from "react";
import { Button, Checkbox } from "./ui";

/** Muestra el código de recuperación una única vez y pide confirmar que se guardó. */
export function RecoveryCodeNotice({
  code,
  onContinue,
  continueLabel = "Continuar",
}: {
  code: string;
  onContinue?: () => void;
  continueLabel?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border-2 border-dashed border-brand/50 bg-brand/5 p-4 text-center">
        <p className="flex items-center justify-center gap-2 text-sm font-bold">
          <KeyRound className="size-4" /> Tu código de recuperación
        </p>
        <p className="mt-2 select-all font-mono text-2xl font-bold tracking-widest">{code}</p>
        <button
          type="button"
          className="mt-2 inline-flex items-center gap-1 text-sm underline"
          onClick={() => {
            void navigator.clipboard?.writeText(code).then(() => setCopied(true));
          }}
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <p className="text-sm text-neutral-600">
        Guardalo (una captura de pantalla alcanza). Es la <b>única forma</b> de crear una contraseña nueva si te la olvidás: no enviamos
        emails. No lo vamos a volver a mostrar.
      </p>
      {onContinue && (
        <>
          <Checkbox checked={saved} onChange={(e) => setSaved(e.target.checked)} label="Ya guardé mi código" />
          <Button className="w-full" disabled={!saved} onClick={onContinue}>
            {continueLabel}
          </Button>
        </>
      )}
    </div>
  );
}
