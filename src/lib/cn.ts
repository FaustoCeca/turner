import { twMerge } from "tailwind-merge";

/** Une clases de Tailwind resolviendo conflictos. Sirve en componentes de servidor y de cliente. */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return twMerge(classes.filter(Boolean).join(" "));
}
