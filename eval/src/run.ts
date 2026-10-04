// Runs the question set against three arms and grades every answer against the key.
//   model   — the same LLM with no tools
//   keyword — BM25 over the same source texts the Knowledge Base was built from, top passages to the same LLM
//   agent   — the deployed agent (structured dataset + Knowledge Base + legal-time tools), via /api/ask
// Usage: pnpm --filter @wallclock/eval eval [--split test|dev|all] [--arms model,keyword,agent] [--limit N]
import {createOpenAICompatible} from '@ai-sdk/openai-compatible'
import {generateText} from 'ai'
import {mkdirSync, readdirSync, readFileSync, writeFileSync} from 'node:fs'
import {join, resolve} from 'node:path'
import {Bm25, chunk, type Passage} from './bm25.ts'
import {judge, type Verdict} from './judge.ts'

interface Question {
  id: string
  split: 'dev' | 'test'
  question: string
  answer: string
  computation?: string
  category: string
  trap: boolean
  trap_reason?: string
}

type Arm = 'model' | 'keyword' | 'agent'

const root = resolve(import.meta.dirname, '..')
const args = new Map(process.argv.slice(2).map((a, i, all) => (a.startsWith('--') ? [a.slice(2), all[i + 1] ?? ''] : ['', ''])))
const split = args.get('split') || 'test'
const arms = (args.get('arms') || 'model,keyword,agent').split(',') as Arm[]
const limit = Number(args.get('limit') || 0)
const today = process.env.EVAL_TODAY ?? new Date().toISOString().slice(0, 10)

const provider = createOpenAICompatible({
  name: 'llm',
  baseURL: process.env.LLM_BASE_URL ?? 'https://api.venice.ai/api/v1',
  apiKey: process.env.LLM_API_KEY!,
})
const answerModel = provider(process.env.LLM_MODEL ?? 'claude-sonnet-5-5')
const agentUrl = process.env.AGENT_URL ?? 'http://localhost:3000'

function loadQuestions(): Question[] {
  const all = readFileSync(join(root, 'questions.jsonl'), 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as Question)
  const picked = split === 'all' ? all : all.filter((q) => q.split === split)
  return limit ? picked.slice(0, limit) : picked
}

function loadPassages(): Passage[] {
  const dir = join(root, '..', 'knowledge', 'sources')
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .flatMap((f) => {
      const raw = readFileSync(join(dir, f), 'utf8')
      const url = /^url:\s*(.+)$/m.exec(raw)?.[1]?.trim()
      return chunk(f.replace(/\.md$/, ''), raw.replace(/^---[\s\S]*?---\n/, ''), url)
    })
}

const BASE = `Today is ${today}. Answer the question concisely (under 80 words). Give the concrete answer first (a UTC offset like UTC-05:00, a local time, yes/no, a date). If you cannot tell, say so.`

async function armModel(q: Question) {
  const {text} = await generateText({model: answerModel, system: BASE, prompt: q.question})
  return {answer: text}
}

let index: Bm25 | null = null
async function armKeyword(q: Question) {
  index ??= new Bm25(loadPassages())
  const hits = index.search(q.question, 6)
  const context = hits.map((h, i) => `[${i + 1}] (${h.passage.source}) ${h.passage.text}`).join('\n\n')
  const {text} = await generateText({
    model: answerModel,
    system: `${BASE} Use ONLY the numbered search results below; cite them like [1].`,
    prompt: `Search results:\n${context || '(no results)'}\n\nQuestion: ${q.question}`,
  })
  return {answer: text, retrieved: hits.map((h) => h.passage.id)}
}

async function armAgent(q: Question) {
  const res = await fetch(`${agentUrl}/api/ask`, {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({question: q.question, today}),
  })
  if (!res.ok) throw new Error(`agent ${res.status}: ${await res.text()}`)
  const body = (await res.json()) as {answer: string; tools: string[]}
  return {answer: body.answer, tools: body.tools}
}

const runners: Record<Arm, (q: Question) => Promise<{answer: string; retrieved?: string[]; tools?: string[]}>> = {
  model: armModel,
  keyword: armKeyword,
  agent: armAgent,
}

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let i = 0
  await Promise.all(
    Array.from({length: n}, async () => {
      while (i < items.length) {
        const k = i++
        out[k] = await fn(items[k]!)
      }
    }),
  )
  return out
}

interface Row {
  id: string
  category: string
  trap: boolean
  question: string
  key: string
  arms: Partial<Record<Arm, {answer: string; verdict: Verdict; reason: string; ms: number; retrieved?: string[]; tools?: string[]; error?: string}>>
}

async function main() {
  const questions = loadQuestions()
  console.log(`${questions.length} questions (${split}), arms: ${arms.join(', ')}`)
  const rows = await pool(questions, 4, async (q): Promise<Row> => {
    const row: Row = {id: q.id, category: q.category, trap: q.trap, question: q.question, key: q.answer, arms: {}}
    for (const arm of arms) {
      const t0 = Date.now()
      try {
        const r = await runners[arm](q)
        const g = await judge(q.question, q.answer, r.answer)
        row.arms[arm] = {...r, verdict: g.verdict, reason: g.reason, ms: Date.now() - t0}
      } catch (e) {
        row.arms[arm] = {answer: '', verdict: 'error', reason: '', ms: Date.now() - t0, error: (e as Error).message}
      }
    }
    process.stdout.write(`${q.id} ${arms.map((a) => `${a}:${row.arms[a]?.verdict}`).join(' ')}\n`)
    return row
  })

  const summary = Object.fromEntries(
    arms.map((arm) => {
      const vs = rows.map((r) => r.arms[arm]?.verdict)
      const traps = rows.filter((r) => r.trap).map((r) => r.arms[arm]?.verdict)
      return [
        arm,
        {
          correct: vs.filter((v) => v === 'correct').length,
          incorrect: vs.filter((v) => v === 'incorrect').length,
          abstained: vs.filter((v) => v === 'abstained').length,
          errors: vs.filter((v) => v === 'error').length,
          trapsCorrect: traps.filter((v) => v === 'correct').length,
          traps: traps.length,
        },
      ]
    }),
  )
  const result = {
    ranAt: new Date().toISOString(),
    today,
    split,
    total: rows.length,
    answerModel: process.env.LLM_MODEL ?? 'claude-sonnet-5-5',
    judgeModel: process.env.JUDGE_MODEL ?? 'openai-gpt-6-sol',
    summary,
    rows,
  }
  const outDir = join(root, 'results')
  mkdirSync(outDir, {recursive: true})
  const stamp = result.ranAt.replace(/[:.]/g, '-')
  writeFileSync(join(outDir, `${split}-${stamp}.json`), JSON.stringify(result, null, 2))
  writeFileSync(join(outDir, `latest-${split}.json`), JSON.stringify(result, null, 2))
  console.table(summary)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
