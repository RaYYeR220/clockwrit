// Which zones does this runtime get wrong, compared with the pinned IANA release?
// Usage: pnpm --filter @wallclock/core drift [fromYear] [toYear]
import {createRequire} from 'node:module'
import {ianaOffset, ianaVersion} from '../src/iana.ts'
import {formatOffset} from '../src/time.ts'
import {runtimeOffset, runtimeTzVersion} from '../src/runtime.ts'

const require = createRequire(import.meta.url)
const zones = (require('moment-timezone') as {tz: {names(): string[]}}).tz.names()
const fromYear = Number(process.argv[2] ?? new Date().getUTCFullYear())
const toYear = Number(process.argv[3] ?? fromYear + 1)

console.log(`IANA ${ianaVersion()} vs this runtime (${runtimeTzVersion() ?? 'unknown tz version'}), daily ${fromYear}-${toYear}\n`)
let drifting = 0
for (const zone of zones) {
  let first: string | null = null
  let days = 0
  let sample = ''
  for (let t = Date.UTC(fromYear, 0, 1, 12); t < Date.UTC(toYear + 1, 0, 1); t += 86_400_000) {
    const iso = new Date(t).toISOString()
    let rt: number
    try {
      rt = runtimeOffset(zone, iso)
    } catch {
      continue
    }
    const ref = ianaOffset(zone, iso)
    if (ref !== rt) {
      days++
      if (!first) {
        first = iso.slice(0, 10)
        sample = `IANA ${formatOffset(ref)}, runtime ${formatOffset(rt)}`
      }
    }
  }
  if (days) {
    drifting++
    console.log(`${zone.padEnd(32)} from ${first}  ${String(days).padStart(4)} days  (${sample})`)
  }
}
console.log(`\n${drifting} of ${zones.length} zones disagree.`)
