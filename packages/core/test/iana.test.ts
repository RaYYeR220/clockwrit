import {describe, expect, it} from 'vitest'
import {ianaOffset, ianaVersion, threeClocks} from '../src/iana.ts'
import type {RuleSegment} from '../src/types.ts'

// British Columbia: Pacific DST rules until the switch to year-round UTC-7.
const VANCOUVER: RuleSegment[] = [
  {
    id: 'bc-pacific-dst',
    zone: 'America/Vancouver',
    from: null,
    to: '2026-03-08T10:00:00Z',
    stdOffset: -480,
    dst: {
      save: 60,
      start: {month: 3, on: 'Sun>=8', at: '2:00', atType: 'wall'},
      end: {month: 11, on: 'Sun>=1', at: '2:00', atType: 'wall'},
    },
  },
  {id: 'bc-year-round', zone: 'America/Vancouver', from: '2026-03-08T10:00:00Z', to: null, stdOffset: -420, dst: null, basis: ['bc-permanent']},
]

describe('IANA reference clock', () => {
  it('is pinned to a 2026 release', () => {
    expect(ianaVersion()).toMatch(/^2026[a-z]$/)
  })

  it('reads Warsaw summer time', () => {
    expect(ianaOffset('Europe/Warsaw', '2026-07-01T12:00:00Z')).toBe(120)
  })
})

describe('threeClocks', () => {
  it('agrees when law, IANA and runtime match', () => {
    const r = threeClocks(VANCOUVER, 'America/Vancouver', '2026-07-01T12:00:00Z', {offsetMinutes: -420, version: 'x'})
    expect(r.agree).toBe(true)
  })

  it('flags a stale runtime after the law changed', () => {
    const r = threeClocks(VANCOUVER, 'America/Vancouver', '2026-12-01T20:00:00Z', {offsetMinutes: -480, version: '2025b'})
    expect(r.law?.offsetMinutes).toBe(-420)
    expect(r.drift).toEqual(['runtime'])
  })

  it('flags IANA when the dataset records a law IANA does not have', () => {
    const fake: RuleSegment[] = [{id: 'x', zone: 'Europe/Warsaw', from: null, to: null, stdOffset: 60, dst: null}]
    const r = threeClocks(fake, 'Europe/Warsaw', '2026-07-01T12:00:00Z', {offsetMinutes: 120, version: null})
    expect(r.drift).toContain('iana')
  })
})
