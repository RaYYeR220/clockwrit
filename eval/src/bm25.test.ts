import {describe, expect, it} from 'vitest'
import {Bm25, chunk, tokenize} from './bm25.ts'

describe('tokenize', () => {
  it('keeps offsets and dates as tokens', () => {
    expect(tokenize('UTC-07:00 from 2026-11-01, Vancouver.')).toEqual(['utc-07:00', '2026-11-01', 'vancouver'])
  })
})

describe('Bm25', () => {
  it('ranks the passage that shares rare terms first', () => {
    const idx = new Bm25([
      {id: 'a', source: 'a', text: 'Manitoba will stay on daylight time permanently'},
      {id: 'b', source: 'b', text: 'Ontario daylight saving time begins in March'},
      {id: 'c', source: 'c', text: 'Recipes for soup'},
    ])
    const r = idx.search('Manitoba permanent daylight time')
    expect(r[0]!.passage.id).toBe('a')
    expect(r.map((x) => x.passage.id)).not.toContain('c')
  })
})

describe('chunk', () => {
  it('splits long text into windows', () => {
    const text = Array.from({length: 10}, (_, i) => `Paragraph ${i} ${'x'.repeat(300)}`).join('\n\n')
    expect(chunk('s', text).length).toBeGreaterThan(2)
  })
})
