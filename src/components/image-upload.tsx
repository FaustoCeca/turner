"use client";

import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { uploadImageAction } from "@/app/panel/actions";
import { Avatar } from "./ui";

const SIZE = 400;

/** Recorta al centro en cuadrado y achica a 400×400 JPEG (fondo blanco para PNG con transparencia). */
async function resize(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo procesar la imagen"))), "image/jpeg", 0.85),
  );
}

/** Campo de imagen: sube el archivo y deja la URL en un input oculto `name` para el formulario. */
export function ImageUpload({ name, defaultValue, label }: { name: string; defaultValue: string | null; label: string }) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await resize(file);
      const fd = new FormData();
      fd.append("file", new File([blob], "imagen.jpg", { type: "image/jpeg" }));
      const res = await uploadImageAction(fd);
      if (res.error || !res.url) setError(res.error ?? "No se pudo subir la imagen");
      else setUrl(res.url);
    } catch {
      setError("No se pudo leer la imagen. Probá con un JPG o PNG.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      <p className="mb-1 text-sm font-medium">{label}</p>
      <input type="hidden" name={name} value={url} />
      <div className="flex items-center gap-3">
        <Avatar name="?" src={url || null} size={56} />
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm hover:bg-neutral-50">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          {url ? "Cambiar" : "Subir imagen"}
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={busy}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
        {url && (
          <button type="button" onClick={() => setUrl("")} className="inline-flex items-center gap-1 text-sm text-red-600">
            <Trash2 className="size-4" /> Quitar
          </button>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      <p className="mt-1 text-xs text-neutral-500">Se recorta cuadrada. Recordá guardar los cambios.</p>
    </div>
  );
}
