import 'server-only'

const hits = new Map<string, number[]>()

/** Small sliding-window limiter, per client IP and bucket. Per instance only; enough to keep casual abuse off paid endpoints. */
const GLOBAL_PER_WINDOW = 200

/** The client address as set by the platform proxy; never the client-supplied left end of X-Forwarded-For. */
function clientIp(req: Request): string {
  const real = req.headers.get('x-real-ip')?.trim()
  if (real) return real
  const hops = req.headers.get('x-forwarded-for')?.split(',').map((h) => h.trim()).filter(Boolean) ?? []
  return hops.at(-1) ?? 'local'
}

function allow(key: string, max: number, windowMs: number, now: number): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= max) {
    hits.set(key, recent)
    return false
  }
  recent.push(now)
  hits.set(key, recent)
  return true
}

/**
 * Sliding-window limiter per client IP and bucket, plus a per-bucket ceiling for all clients together
 * as a backstop against rotating addresses. Per instance only.
 */
export function rateLimit(req: Request, bucket: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  if (!allow(`${bucket}:*`, Math.max(GLOBAL_PER_WINDOW, max), windowMs, now)) return false
  return allow(`${bucket}:${clientIp(req)}`, max, windowMs, now)
}
