import {describe, expect, it} from 'vitest'
import {dayVerdict, nextWorkdays} from '../src/calendar.ts'
import type {CalendarData} from '../src/types.ts'

const data: CalendarData = {
  holidays: [
    {id: 'pl-2026-12-24', jurisdiction: 'PL', date: '2026-12-24', name: 'Christmas Eve', dayOff: true, kind: 'statutory', basis: ['pl-act-2024-christmas-eve']},
    {id: 'pl-2026-12-25', jurisdiction: 'PL', date: '2026-12-25', name: 'Christmas Day', dayOff: true, kind: 'statutory'},
    {id: 'cn-2026-10-01', jurisdiction: 'CN', date: '2026-10-01', name: 'National Day', dayOff: true, kind: 'statutory'},
    {id: 'ua-2026-08-24', jurisdiction: 'UA', date: '2026-08-24', name: 'Independence Day', dayOff: true, kind: 'statutory'},
  ],
  weekends: [
    {id: 'pl-weekend', jurisdiction: 'PL', from: null, to: null, days: [6, 7]},
    {id: 'cn-weekend', jurisdiction: 'CN', from: null, to: null, days: [6, 7]},
    {id: 'ua-weekend', jurisdiction: 'UA', from: null, to: null, days: [6, 7]},
    {id: 'ae-weekend-old', jurisdiction: 'AE', from: null, to: '2021-12-31', days: [5, 6]},
    {id: 'ae-weekend-2022', jurisdiction: 'AE', from: '2022-01-01', to: null, days: [6, 7], basis: ['ae-weekend-2022']},
  ],
  overrides: [
    {id: 'cn-2026-10-10', jurisdiction: 'CN', date: '2026-10-10', isWorkday: true, reason: 'Adjusted working Saturday for National Day', basis: ['cn-state-council-2026']},
  ],
  suspensions: [
    {id: 'ua-martial-law', jurisdiction: 'UA', from: '2022-02-24', to: null, reason: 'Holiday days-off suspended under martial law', basis: ['ua-labour-code-art-73']},
  ],
}

describe('dayVerdict', () => {
  it('treats a statutory holiday as a day off and cites it', () => {
    const v = dayVerdict(data, 'PL', '2026-12-24')
    expect(v.workday).toBe(false)
    expect(v.reasons[0]).toMatchObject({code: 'holiday', basis: ['pl-act-2024-christmas-eve']})
  })

  it('honours an explicit working Saturday over the weekend rule', () => {
    const v = dayVerdict(data, 'CN', '2026-10-10')
    expect(v.workday).toBe(true)
    expect(v.reasons.map((r) => r.code)).toEqual(['override'])
  })

  it('applies a holiday suspension: the holiday exists but is a workday', () => {
    const v = dayVerdict(data, 'UA', '2026-08-24')
    expect(v.workday).toBe(true)
    expect(v.reasons.map((r) => r.code)).toEqual(['holiday', 'suspension'])
  })

  it('uses the weekend regime in force on that date', () => {
    expect(dayVerdict(data, 'AE', '2021-12-31').workday).toBe(false) // Friday, old regime
    expect(dayVerdict(data, 'AE', '2026-10-09').workday).toBe(true) // Friday, new regime
    expect(dayVerdict(data, 'AE', '2026-10-10').workday).toBe(false) // Saturday
  })

  it('says an ordinary weekday is a workday', () => {
    const v = dayVerdict(data, 'PL', '2026-10-06')
    expect(v).toMatchObject({workday: true, reasons: [{code: 'ordinary'}]})
  })

  it('refuses jurisdictions it has no weekend data for', () => {
    expect(() => dayVerdict(data, 'XX', '2026-10-06')).toThrow(/no calendar data/i)
  })
})

describe('nextWorkdays', () => {
  it('skips weekends and holidays', () => {
    expect(nextWorkdays(data, 'PL', '2026-12-23', 3)).toEqual(['2026-12-28', '2026-12-29', '2026-12-30'])
  })
})
