import {describe, expect, it} from 'vitest'
import {auditSchedule, eventsFromIcs, expandOccurrences} from '../src/audit.ts'
import type {CalendarData, RuleSegment} from '../src/types.ts'

const NY: RuleSegment[] = [
  {
    id: 'us-2007',
    zone: 'America/New_York',
    from: null,
    to: null,
    stdOffset: -300,
    dst: {save: 60, start: {month: 3, on: 'Sun>=8', at: '2:00', atType: 'wall'}, end: {month: 11, on: 'Sun>=1', at: '2:00', atType: 'wall'}},
  },
]
const WAW: RuleSegment[] = [
  {
    id: 'eu',
    zone: 'Europe/Warsaw',
    from: null,
    to: null,
    stdOffset: 60,
    dst: {save: 60, start: {month: 3, on: 'lastSun', at: '1:00', atType: 'utc'}, end: {month: 10, on: 'lastSun', at: '1:00', atType: 'utc'}},
  },
]
const calendar: CalendarData = {
  holidays: [{id: 'pl-1224', jurisdiction: 'PL', date: '2026-12-24', name: 'Christmas Eve', dayOff: true, kind: 'statutory', basis: ['pl-act']}],
  weekends: [
    {id: 'pl', jurisdiction: 'PL', from: null, to: null, days: [6, 7]},
    {id: 'us', jurisdiction: 'US', from: null, to: null, days: [6, 7]},
  ],
  overrides: [],
  suspensions: [],
}

describe('expandOccurrences', () => {
  it('expands a weekly rule inside the window', () => {
    const occ = expandOccurrences({title: 't', start: '2026-12-03T09:00', zone: 'America/New_York', rrule: 'FREQ=WEEKLY;BYDAY=TH'}, '2026-12-01', '2026-12-31')
    expect(occ).toEqual(['2026-12-03T09:00', '2026-12-10T09:00', '2026-12-17T09:00', '2026-12-24T09:00', '2026-12-31T09:00'])
  })
})

describe('auditSchedule', () => {
  it('flags a Warsaw holiday for a New York meeting', () => {
    const r = auditSchedule({
      events: [{title: 'Sync', start: '2026-12-24T09:00', zone: 'America/New_York'}],
      participants: [{label: 'Warsaw team', zone: 'Europe/Warsaw', jurisdiction: 'PL'}],
      segments: {'America/New_York': NY, 'Europe/Warsaw': WAW},
      calendar,
      from: '2026-12-01',
      to: '2026-12-31',
    })
    expect(r).toHaveLength(1)
    expect(r[0]!.participants[0]).toMatchObject({local: '2026-12-24T15:00', offset: '+01:00', workday: false})
    expect(r[0]!.flags.map((f) => f.code)).toContain('holiday')
  })

  it('flags a local time that does not exist', () => {
    const r = auditSchedule({
      events: [{title: 'Batch', start: '2026-03-08T02:30', zone: 'America/New_York'}],
      participants: [],
      segments: {'America/New_York': NY},
      calendar,
      from: '2026-03-01',
      to: '2026-03-31',
    })
    expect(r[0]!.flags[0]!.code).toBe('nonexistent-local-time')
  })
})

describe('eventsFromIcs', () => {
  it('reads summary, local start, TZID and RRULE', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:1',
      'SUMMARY:Standup',
      'DTSTART;TZID=America/Vancouver:20261005T090000',
      'RRULE:FREQ=WEEKLY;BYDAY=MO',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    expect(eventsFromIcs(ics)).toEqual([{title: 'Standup', start: '2026-10-05T09:00', zone: 'America/Vancouver', rrule: 'FREQ=WEEKLY;BYDAY=MO'}])
  })
})
