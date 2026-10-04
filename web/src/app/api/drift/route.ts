import {formatOffset, runtimeOffset, runtimeTzVersion} from '@wallclock/core'
import {ianaOffset, ianaVersion} from '@wallclock/core/iana'
import {createRequire} from 'node:module'

export const runtime = 'nodejs'
export const revalidate = 3600

const require = createRequire(import.meta.url)

/** Zones where this server's tz data disagrees with the pinned IANA release, sampled daily over the next ~15 months. */
export async function GET() {
  const zones = (require('moment-timezone') as {tz: {names(): string[]}}).tz.names()
  const start = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate(), 12)
  const end = start + 460 * 86_400_000
  const drifting: {zone: string; from: string; days: number; iana: string; runtime: string}[] = []
  for (const zone of zones) {
    let first: {from: string; iana: string; runtime: string} | null = null
    let days = 0
    for (let t = start; t < end; t += 86_400_000) {
      const iso = new Date(t).toISOString()
      let rt: number
      try {
        rt = runtimeOffset(zone, iso)
      } catch {
        break
      }
      const ref = ianaOffset(zone, iso)
      if (ref !== rt) {
        days++
        first ??= {from: iso.slice(0, 10), iana: formatOffset(ref), runtime: formatOffset(rt)}
      }
    }
    if (first) drifting.push({zone, days, ...first})
  }
  return Response.json({iana: ianaVersion(), runtime: runtimeTzVersion(), zones: zones.length, drifting})
}
