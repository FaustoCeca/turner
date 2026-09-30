import { describe, expect, it } from "vitest";
import { generateRecoveryCode, hashRecoveryCode, normalizeRecoveryCode, verifyRecoveryCode } from "./recovery";
import { toWhatsAppNumber } from "./whatsapp";

describe("código de recuperación", () => {
  it("tiene el formato XXXX-XXXX-XXXX sin caracteres ambiguos", () => {
    const code = generateRecoveryCode();
    expect(code).toMatch(/^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
    expect(generateRecoveryCode()).not.toBe(code);
  });

  it("verifica aunque se escriba en minúsculas, con espacios o sin guiones", async () => {
    const code = generateRecoveryCode();
    const hash = await hashRecoveryCode(code);
    expect(await verifyRecoveryCode(code.toLowerCase().replace(/-/g, " "), hash)).toBe(true);
    expect(await verifyRecoveryCode(normalizeRecoveryCode(code), hash)).toBe(true);
    expect(await verifyRecoveryCode("AAAA-BBBB-CCCC", hash)).toBe(false);
    expect(await verifyRecoveryCode("corto", hash)).toBe(false);
  });
});

describe("toWhatsAppNumber", () => {
  it("normaliza números argentinos", () => {
    expect(toWhatsAppNumber("+54 9 341 320-3537")).toBe("5493413203537");
    expect(toWhatsAppNumber("0341 3203537")).toBe("5493413203537");
    expect(toWhatsAppNumber("341 3203537")).toBe("5493413203537");
    expect(toWhatsAppNumber("0341 15 555-7777")).toBe("5493415557777");
    expect(toWhatsAppNumber("11 15 4444-5555")).toBe("5491144445555");
    expect(toWhatsAppNumber("123")).toBeNull();
  });
});

describe("buildIcs", () => {
  it("genera un evento con dos alarmas y escapa el texto", async () => {
    const { buildIcs } = await import("./calendar");
    const ics = buildIcs(
      [{ uid: "1@test", title: "Corte, barba; y más", start: new Date("2026-10-01T13:00:00Z"), end: new Date("2026-10-01T13:30:00Z"), location: "Salta 1724, Rosario" }],
      "Turner",
    );
    expect(ics).toContain("DTSTART:20261001T130000Z");
    expect(ics).toContain("SUMMARY:Corte\\, barba\\; y más");
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(2);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});

describe("imágenes", () => {
  it("reconoce el tipo real por los primeros bytes y rechaza lo demás", async () => {
    const { sniffImageType, isAcceptableImageUrl } = await import("./images");
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]))).toBe("image/png");
    expect(sniffImageType(new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WEBPVP8 "))).toBe("image/webp");
    expect(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(isAcceptableImageUrl("/api/imagenes/0b8f6a58-6c0f-4f38-9a3c-6f3f1c1b2a10")).toBe(true);
    expect(isAcceptableImageUrl("javascript:alert(1)")).toBe(false);
    expect(isAcceptableImageUrl("http://inseguro.com/logo.png")).toBe(false);
  });
});
