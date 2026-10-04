const pad = (n: number) => String(n).padStart(2, '0')

/** "UTC−05:00" with a true minus sign. */
export const fmtOffset = (m: number) => `UTC${m < 0 ? '−' : '+'}${pad(Math.floor(Math.abs(m) / 60))}:${pad(Math.abs(m) % 60)}`

/** "-05:00" / "+05:30" → minutes. */
export const toMinutes = (o: string) => {
  const m = /^([+-])(\d{2}):(\d{2})$/.exec(o)
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0
}

/** What this JavaScript runtime's own tz data says the offset is at an instant. */
export function browserOffset(zone: string, at: Date): number {
  const p = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at)
  const g = (t: string) => Number(p.find((x) => x.type === t)?.value)
  return Math.round((Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'), g('second')) - at.getTime()) / 60_000)
}
