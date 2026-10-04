#!/usr/bin/env -S npx tsx
// clockwrit — legal time from the command line.
//   clockwrit now <zone> [--at ISO | --local YYYY-MM-DDTHH:mm]
//   clockwrit day <jurisdiction> <YYYY-MM-DD>
//   clockwrit audit <file.ics> [--with "Warsaw=Europe/Warsaw:PL,..."] [--from D --to D]
//   clockwrit drift [fromYear toYear]      (offline: where does THIS runtime disagree with IANA?)
import {readFileSync} from 'node:fs'
import {formatOffset, runtimeOffset, runtimeTzVersion} from '@wallclock/core'
import {ianaOffset, ianaVersion} from '@wallclock/core/iana'

const API = process.env.CLOCKWRIT_API ?? 'https://clockwrit.vercel.app'
const [cmd, ...rest] = process.argv.slice(2)
const flag = (name: string) => {
  const i = rest.indexOf(`--${name}`)
  return i >= 0 ? rest[i + 1] : undefined
}

async function get(path: string) {
  const res = await fetch(`${API}${path}`)
  const body = await res.json()
  if (!res.ok) throw new Error((body as {error?: string}).error ?? res.statusText)
  return body as Record<string, any>
}

async function main() {
  if (cmd === 'now') {
    const zone = rest[0]
    if (!zone) throw new Error('usage: clockwrit now <zone>')
    const q = new URLSearchParams({zone})
    if (flag('at')) q.set('at', flag('at')!)
    if (flag('local')) q.set('local', flag('local')!)
    const r = await get(`/api/clock?${q}`)
    if (!r.ok) return console.log(r.error)
    if (r.resolution === 'nonexistent') return console.log(r.explanation)
    console.log(`${r.zone}  ${r.local}  UTC${r.offset}${r.abbreviation ? ` (${r.abbreviation})` : ''}${r.isDst ? '  DST' : ''}`)
    for (const b of r.basis) console.log(`  § ${b.title} — ${b.authority}, ${b.status}\n    ${b.url}`)
    for (const d of r.clocks.disagreements) console.log(`  ⚠ ${d}`)
    const local = runtimeOffset(r.zone, r.instant)
    if (formatOffset(local) !== r.offset) console.log(`  ⚠ your Node (tz ${runtimeTzVersion() ?? '?'}) says UTC${formatOffset(local)}`)
    if (r.nextTransition) console.log(`  next change: ${r.nextTransition.instant} → UTC${r.nextTransition.offset}`)
    return
  }
  if (cmd === 'day') {
    const [jurisdiction, date] = rest
    if (!jurisdiction || !date) throw new Error('usage: clockwrit day <jurisdiction> <YYYY-MM-DD>')
    const r = await get(`/api/day?${new URLSearchParams({jurisdiction, date})}`)
    if (!r.ok) return console.log(r.error)
    console.log(`${r.jurisdiction} ${r.date}: ${r.workday ? 'working day' : 'NOT a working day'}`)
    for (const reason of r.reasons) console.log(`  - ${reason.text}${reason.basis[0] ? `  (${reason.basis[0].title})` : ''}`)
    if (r.caveat) console.log(`  note: ${r.caveat}`)
    return
  }
  if (cmd === 'audit') {
    const file = rest[0]
    if (!file) throw new Error('usage: clockwrit audit <file.ics>')
    const participants = (flag('with') ?? '')
      .split(',')
      .filter(Boolean)
      .map((p) => {
        const [label, rhs = ''] = p.split('=')
        const [zone, jurisdiction] = rhs.split(':')
        return {label: label!, zone: zone!, jurisdiction: jurisdiction!}
      })
    const res = await fetch(`${API}/api/audit`, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({ics: readFileSync(file, 'utf8'), participants, from: flag('from'), to: flag('to')}),
    })
    const r = (await res.json()) as Record<string, any>
    if (!res.ok) throw new Error(r.error)
    console.log(`${r.flagged} of ${r.total} occurrences need attention`)
    for (const o of r.occurrences) {
      const serious = o.flags.filter((f: {severity: string}) => f.severity !== 'info')
      if (!serious.length) continue
      console.log(`\n${o.event} — ${o.local} ${o.zone}`)
      for (const f of serious) console.log(`  ${f.severity === 'critical' ? '✗' : '!'} ${f.message}`)
    }
    return
  }
  if (cmd === 'drift') {
    const from = Number(rest[0] ?? new Date().getUTCFullYear())
    const to = Number(rest[1] ?? from + 1)
    const {createRequire} = await import('node:module')
    const zones = (createRequire(import.meta.url)('moment-timezone') as {tz: {names(): string[]}}).tz.names()
    console.log(`IANA ${ianaVersion()} vs this runtime (tz ${runtimeTzVersion() ?? 'unknown'}), ${from}-${to}`)
    let n = 0
    for (const zone of zones) {
      for (let t = Date.UTC(from, 0, 1, 12); t < Date.UTC(to + 1, 0, 1); t += 86_400_000) {
        const iso = new Date(t).toISOString()
        let rt: number
        try {
          rt = runtimeOffset(zone, iso)
        } catch {
          break
        }
        const ref = ianaOffset(zone, iso)
        if (rt !== ref) {
          n++
          console.log(`  ${zone.padEnd(30)} from ${iso.slice(0, 10)}: IANA UTC${formatOffset(ref)}, runtime UTC${formatOffset(rt)}`)
          break
        }
      }
    }
    console.log(n ? `${n} zones disagree. Update your runtime's tz data (or ship an override).` : 'No disagreements.')
    return
  }
  console.log('usage: clockwrit <now|day|audit|drift> ...')
}

main().catch((e) => {
  console.error(`clockwrit: ${(e as Error).message}`)
  process.exit(1)
})
