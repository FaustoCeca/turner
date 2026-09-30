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
  return `${countryCode}9${digits}`;
}

export function whatsappLink(phone: string | null | undefined, text?: string): string | null {
  const number = toWhatsAppNumber(phone);
  if (!number) return null;
  return `https://wa.me/${number}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}
