import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";

// Sin caracteres que se confunden al copiar a mano (0/O, 1/I/L).
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const GROUPS = 3;
const GROUP_SIZE = 4;

/** Código de recuperación tipo "K7QM-3XWP-9HDA" (~59 bits de entropía). */
export function generateRecoveryCode(): string {
  const groups = Array.from({ length: GROUPS }, () =>
    Array.from({ length: GROUP_SIZE }, () => ALPHABET[randomInt(ALPHABET.length)]).join(""),
  );
  return groups.join("-");
}

/** Acepta el código con o sin guiones/espacios y en minúsculas. */
export function normalizeRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashRecoveryCode(code: string): Promise<string> {
  return bcrypt.hash(normalizeRecoveryCode(code), 10);
}

export function verifyRecoveryCode(input: string, hash: string): Promise<boolean> {
  const normalized = normalizeRecoveryCode(input);
  if (normalized.length !== GROUPS * GROUP_SIZE) return Promise.resolve(false);
  return bcrypt.compare(normalized, hash);
}
