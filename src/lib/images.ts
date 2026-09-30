/** Imágenes guardadas en la base y servidas por /api/imagenes/<id>. */

export const IMAGE_PATH = "/api/imagenes/";
export const MAX_IMAGE_BYTES = 600 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const INTERNAL = /^\/api\/imagenes\/([0-9a-f-]{36})$/;

export function internalImageId(url: string | null | undefined): string | null {
  return url ? (INTERNAL.exec(url)?.[1] ?? null) : null;
}

/** URL aceptable para logo o foto: una imagen subida acá o un link https. */
export function isAcceptableImageUrl(url: string): boolean {
  return internalImageId(url) !== null || /^https:\/\/\S+$/.test(url);
}

/** Detecta el tipo real por los primeros bytes (no confía en la extensión ni en el navegador). */
export function sniffImageType(bytes: Uint8Array): (typeof IMAGE_TYPES)[number] | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}
