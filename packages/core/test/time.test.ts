import {describe, expect, it} from 'vitest'
import {offsetAt, resolveLocal, transitionsInYear} from '../src/time.ts'
import type {RuleSegment} from '../src/types.ts'

const EU: RuleSegment = {
  id: 'pl-eu-1996',
  zone: 'Europe/Warsaw',
  from: null,
  to: null,
  stdOffset: 60,
  dst: {
    save: 60,
    start: {month: 3, on: 'lastSun', at: '1:00', atType: 'utc'},
    end: {month: 10, on: 'lastSun', at: '1:00', atType: 'utc'},
  },
  abbreviations: ['CET', 'CEST'],
  basis: ['eu-directive-2000-84'],
}

const NY: RuleSegment = {
  id: 'us-ny-2007',
  zone: 'America/New_York',
  from: null,
  to: null,
  stdOffset: -300,
  dst: {
    save: 60,
    start: {month: 3, on: 'Sun>=8', at: '2:00', atType: 'wall'},
    end: {month: 11, on: 'Sun>=1', at: '2:00', atType: 'wall'},
  },
}

const SYD: RuleSegment = {
  id: 'au-nsw-2008',
  zone: 'Australia/Sydney',
  from: null,
  to: null,
  stdOffset: 600,
  dst: {
    save: 60,
    start: {month: 10, on: 'Sun>=1', at: '2:00', atType: 'std'},
    end: {month: 4, on: 'Sun>=1', at: '2:00', atType: 'std'},
  },
}

// Paraguay: DST regime until the 2024 law, then permanent UTC-3.
const ASU: RuleSegment[] = [
  {
    id: 'py-dst-2010',
    zone: 'America/Asuncion',
    from: null,
    to: '2024-10-06T04:00:00Z',
    stdOffset: -240,
    dst: {
      save: 60,
      start: {month: 10, on: 'Sun>=1', at: '0:00', atType: 'wall'},
      end: {month: 3, on: 'Sun>=22', at: '0:00', atType: 'wall'},
    },
  },
  {
    id: 'py-permanent-2024',
    zone: 'America/Asuncion',
    from: '2024-10-06T04:00:00Z',
    to: null,
    stdOffset: -180,
    dst: null,
    basis: ['py-ley-7353-2024'],
  },
]

describe('transitionsInYear', () => {
  it('computes EU transitions at 01:00 UTC on the last Sundays', () => {
    const t = transitionsInYear(EU, 2026)
    expect(t.map((x) => x.instant)).toEqual(['2026-03-29T01:00:00.000Z', '2026-10-25T01:00:00.000Z'])
  })

  it('computes US transitions on second Sunday of March / first Sunday of November (wall time)', () => {
    const t = transitionsInYear(NY, 2026)
    // 2026-03-08 02:00 EST = 07:00Z ; 2026-11-01 02:00 EDT = 06:00Z
    expect(t.map((x) => x.instant)).toEqual(['2026-03-08T07:00:00.000Z', '2026-11-01T06:00:00.000Z'])
  })
})

describe('offsetAt', () => {
  it('matches the runtime for Warsaw across a year', () => {
    for (const iso of ['2026-01-15T12:00:00Z', '2026-03-29T00:59:00Z', '2026-03-29T01:00:00Z', '2026-07-01T00:00:00Z', '2026-10-25T00:59:00Z', '2026-10-25T01:00:00Z']) {
      expect(offsetAt([EU], iso).offsetMinutes, iso).toBe(runtimeOffset('Europe/Warsaw', iso))
    }
  })

  it('matches the runtime for New York and Sydney (southern hemisphere)', () => {
    for (const iso of ['2026-01-01T00:00:00Z', '2026-03-08T06:59:00Z', '2026-03-08T07:00:00Z', '2026-11-01T05:59:00Z', '2026-11-01T06:00:00Z']) {
      expect(offsetAt([NY], iso).offsetMinutes, iso).toBe(runtimeOffset('America/New_York', iso))
    }
    for (const iso of ['2026-01-01T00:00:00Z', '2026-04-04T15:59:00Z', '2026-04-04T16:00:00Z', '2026-07-01T00:00:00Z', '2026-10-03T15:59:00Z', '2026-10-03T16:00:00Z', '2026-12-31T23:00:00Z']) {
      expect(offsetAt([SYD], iso).offsetMinutes, iso).toBe(runtimeOffset('Australia/Sydney', iso))
    }
  })

  it('switches segments when the law changes', () => {
    expect(offsetAt(ASU, '2024-07-01T12:00:00Z').offsetMinutes).toBe(-240)
    const after = offsetAt(ASU, '2026-11-15T13:00:00Z')
    expect(after.offsetMinutes).toBe(-180)
    expect(after.isDst).toBe(false)
    expect(after.basis).toEqual(['py-ley-7353-2024'])
  })

  it('reports the next transition', () => {
    const r = offsetAt([EU], '2026-10-04T12:00:00Z')
    expect(r.nextTransition).toEqual({instant: '2026-10-25T01:00:00.000Z', offsetMinutes: 60})
  })

  it('finds the next change across a regime boundary that keeps the offset', () => {
    const a: RuleSegment = {...EU, id: 'a', to: '2026-12-01T00:00:00Z'}
    const b: RuleSegment = {...EU, id: 'b', from: '2026-12-01T00:00:00Z', to: null}
    expect(offsetAt([a, b], '2026-11-15T12:00:00Z').nextTransition).toEqual({instant: '2027-03-28T01:00:00.000Z', offsetMinutes: 120})
  })

  it('throws when no segment covers the instant', () => {
    expect(() => offsetAt([{...EU, from: '2030-01-01T00:00:00Z'}], '2026-01-01T00:00:00Z')).toThrow(/no rule segment/i)
  })
})

describe('resolveLocal', () => {
  it('resolves an ordinary local time uniquely', () => {
    const r = resolveLocal([EU], '2026-12-24T10:00')
    expect(r).toMatchObject({kind: 'unique', instant: '2026-12-24T09:00:00.000Z', offsetMinutes: 60})
  })

  it('flags local times inside the spring-forward gap as nonexistent, with the real transition instant', () => {
    for (const local of ['2026-03-08T02:00', '2026-03-08T02:30', '2026-03-08T02:59']) {
      const r = resolveLocal([NY], local)
      expect(r.kind, local).toBe('nonexistent')
      if (r.kind === 'nonexistent') expect(r.gapStart, local).toBe('2026-03-08T07:00:00.000Z')
    }
  })

  it('flags local times inside the fall-back overlap as ambiguous', () => {
    const r = resolveLocal([NY], '2026-11-01T01:30')
    expect(r.kind).toBe('ambiguous')
    if (r.kind === 'ambiguous') {
      expect(r.candidates.map((c) => c.offsetMinutes).sort((a, b) => a - b)).toEqual([-300, -240])
    }
  })
})

function runtimeOffset(zone: string, iso: string): number {
  const d = new Date(iso)
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
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return Math.round((asUtc - d.getTime()) / 60000)
}
