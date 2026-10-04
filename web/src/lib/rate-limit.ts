import 'server-only'

const hits = new Map<string, number[]>()

/** Small sliding-window limiter, per client IP and bucket. Per instance only; enough to keep casual abuse off paid endpoints. */
export function rateLimit(req: Request, bucket: string, max: number, windowMs: number): boolean {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local'
  const key = `${bucket}:${ip}`
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= max) {
    hits.set(key, recent)
    return false
  }
  recent.push(now)
  hits.set(key, recent)
  return true
}
