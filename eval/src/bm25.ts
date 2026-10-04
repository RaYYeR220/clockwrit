/** A plain Okapi BM25 index: the "keyword search" baseline the agent is measured against. */
export interface Passage {
  id: string
  source: string
  url?: string
  text: string
}

const STOP = new Set('a an and are as at be by for from has have in is it its of on or that the this to was were will with'.split(' '))

export function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9+\-:.]+/)
    .map((t) => t.replace(/^[.:\-]+|[.:\-]+$/g, ''))
    .filter((t) => t.length > 1 && !STOP.has(t))
}

export class Bm25 {
  private docs: {p: Passage; tf: Map<string, number>; len: number}[] = []
  private df = new Map<string, number>()
  private avgLen = 0

  constructor(
    passages: Passage[],
    private k1 = 1.2,
    private b = 0.75,
  ) {
    for (const p of passages) {
      const toks = tokenize(p.text)
      const tf = new Map<string, number>()
      for (const t of toks) tf.set(t, (tf.get(t) ?? 0) + 1)
      for (const t of tf.keys()) this.df.set(t, (this.df.get(t) ?? 0) + 1)
      this.docs.push({p, tf, len: toks.length})
    }
    this.avgLen = this.docs.reduce((a, d) => a + d.len, 0) / Math.max(1, this.docs.length)
  }

  search(query: string, k = 6): {passage: Passage; score: number}[] {
    const q = tokenize(query)
    const N = this.docs.length
    return this.docs
      .map((d) => {
        let score = 0
        for (const t of q) {
          const f = d.tf.get(t)
          if (!f) continue
          const n = this.df.get(t) ?? 0
          const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5))
          score += (idf * f * (this.k1 + 1)) / (f + this.k1 * (1 - this.b + (this.b * d.len) / this.avgLen))
        }
        return {passage: d.p, score}
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
  }
}

/** Split a source document into overlapping paragraph windows. */
export function chunk(source: string, text: string, url?: string, size = 900): Passage[] {
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  const out: Passage[] = []
  let buf = ''
  for (const p of paras) {
    if (buf && buf.length + p.length > size) {
      out.push({id: `${source}#${out.length}`, source, url, text: buf})
      buf = buf.slice(-200)
    }
    buf = buf ? `${buf}\n\n${p}` : p
  }
  if (buf) out.push({id: `${source}#${out.length}`, source, url, text: buf})
  return out
}
