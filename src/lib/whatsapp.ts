/**
 * Número en formato wa.me. Si no trae código de país se asume Argentina (celular: 54 9 + área + número).
 * Devuelve null si no parece un teléfono.
 */
export function toWhatsAppNumber(phone: string | null | undefined, countryCode = "54"): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  if (phone.trim().startsWith("+") || digits.startsWith(countryCode)) return digits;
  digits = digits.replace(/^0/, ""); // 0341… → 341…
  // Celular escrito con el "15" (341 15 555-7777): característica + 15 + número = 12 dígitos.
  // WhatsApp lo necesita sin el 15 (54 9 + característica + número = 10 dígitos).
  if (digits.length === 12) {
    for (const areaLength of [2, 3, 4]) {
      if (digits.slice(areaLength, areaLength + 2) === "15") {
        digits = digits.slice(0, areaLength) + digits.slice(areaLength + 2);
        break;
      }
    }
  }
  return `${countryCode}9${digits}`;
}

export function whatsappLink(phone: string | null | undefined, text?: string): string | null {
  const number = toWhatsAppNumber(phone);
  if (!number) return null;
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** Teléfono utilizable para WhatsApp (con o sin código de país). */
export function isValidPhone(phone: string | null | undefined): boolean {
  return toWhatsAppNumber(phone) !== null && (phone ?? "").replace(/\D/g, "").length <= 15;
}
