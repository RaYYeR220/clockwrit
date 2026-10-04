/** Offset according to whatever tz data this JavaScript runtime ships (ICU). */
export function runtimeOffset(zone: string, instantIso: string): number {
  const d = new Date(instantIso)
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(d)
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return Math.round((asUtc - d.getTime()) / 60_000)
}

/** The tz data version this runtime ships, when the runtime exposes it (Node does). */
export function runtimeTzVersion(): string | null {
  const g = globalThis as {process?: {versions?: {tz?: string}}}
  return g.process?.versions?.tz ?? null
}
