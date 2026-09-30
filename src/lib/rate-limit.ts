import "server-only";

// Límite en memoria por instancia: frena fuerza bruta básica sin infraestructura extra.
// Con varias instancias conviene reemplazarlo por Redis/Upstash.
const hits = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.resetAt < now) {
    hits.set(key, { count: 1, resetAt: now + windowMs });
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
    }
    return true;
  }
  entry.count++;
  return entry.count <= max;
}
