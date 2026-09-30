import { describe, expect, it } from "vitest";
import { rateLimit } from "./rate-limit";

describe("rateLimit (en la base)", () => {
  it("permite hasta el máximo y después bloquea", async () => {
    const key = `test:${crypto.randomUUID()}`;
    expect(await rateLimit(key, 2, 60_000)).toBe(true);
    expect(await rateLimit(key, 2, 60_000)).toBe(true);
    expect(await rateLimit(key, 2, 60_000)).toBe(false);
    expect(await rateLimit(`${key}:otra`, 2, 60_000)).toBe(true);
  });

  it("se reinicia cuando vence la ventana", async () => {
    const key = `test:${crypto.randomUUID()}`;
    expect(await rateLimit(key, 1, 20)).toBe(true);
    expect(await rateLimit(key, 1, 20)).toBe(false);
    await new Promise((r) => setTimeout(r, 40));
    expect(await rateLimit(key, 1, 20)).toBe(true);
  });

  it("cuenta bien intentos simultáneos", async () => {
    const key = `test:${crypto.randomUUID()}`;
    const results = await Promise.all(Array.from({ length: 10 }, () => rateLimit(key, 3, 60_000)));
    expect(results.filter(Boolean)).toHaveLength(3);
  });
});
