import 'server-only'

const hits = new Map<string, number[]>()
const MAX_KEYS = 10_000
const GLOBAL_PER_WINDOW = 200

/**
 * The client address. Only on Vercel, whose edge overwrites x-real-ip / x-forwarded-for, are the headers trusted;
 * anywhere else every request shares one key rather than letting a client pick its own.
 */
function clientIp(req: Request): string {
  if (!process.env.VERCEL) return 'direct'
  const real = req.headers.get('x-real-ip')?.trim()
  if (real) return real
  return req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim() || 'unknown'
}

function recent(key: string, windowMs: number, now: number): number[] {
  return (hits.get(key) ?? []).filter((t) => now - t < windowMs)
}

function prune(windowMs: number, now: number) {
  if (hits.size < MAX_KEYS) return
  for (const [k, ts] of hits) if (!ts.some((t) => now - t < windowMs)) hits.delete(k)
  // Still too many live keys: drop the oldest half rather than grow without bound.
  if (hits.size >= MAX_KEYS) for (const k of [...hits.keys()].slice(0, MAX_KEYS / 2)) hits.delete(k)
}

/**
 * Sliding-window limiter per client and bucket, with a per-bucket ceiling across all clients as a cost circuit-breaker.
 * A request only counts against the shared ceiling once it has passed its own per-client limit,
 * so one noisy client can't spend everyone else's budget. Per instance only.
 */
export function rateLimit(req: Request, bucket: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  prune(windowMs, now)
  const own = `${bucket}:${clientIp(req)}`
  const shared = `${bucket}:*`
  const mine = recent(own, windowMs, now)
  const all = recent(shared, windowMs, now)
  if (mine.length >= max || all.length >= Math.max(GLOBAL_PER_WINDOW, max)) {
    hits.set(own, mine)
    hits.set(shared, all)
    return false
  }
  mine.push(now)
  all.push(now)
  hits.set(own, mine)
  hits.set(shared, all)
  return true
}
