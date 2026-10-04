import {createOpenAICompatible} from '@ai-sdk/openai-compatible'
import {generateText} from 'ai'

export type Verdict = 'correct' | 'incorrect' | 'abstained' | 'error'

const provider = createOpenAICompatible({
  name: 'judge',
  baseURL: process.env.LLM_BASE_URL ?? 'https://api.venice.ai/api/v1',
  apiKey: process.env.LLM_API_KEY!,
})
// A different model family from the one answering, so the judge doesn't favour its own phrasing.
const judgeModel = provider(process.env.JUDGE_MODEL ?? 'openai-gpt-6-sol')

const RUBRIC = `You grade answers about legal time and calendars against an answer key.
Return exactly one line of JSON: {"verdict":"correct"|"incorrect"|"abstained","reason":"<one sentence>"}.
- correct: the answer's core claim matches the key (same offset, same local time, same yes/no, same date). Extra context is fine; hedging is fine if the committed answer is right.
- incorrect: it commits to a different value, or presents a pending/conditional/unsigned law as in force when the key says otherwise, or the right value with the wrong conclusion.
- abstained: it declines to commit to an answer or says it cannot tell.
Judge only against the key, not your own knowledge.`

export async function judge(question: string, key: string, answer: string): Promise<{verdict: Verdict; reason: string}> {
  if (!answer.trim()) return {verdict: 'abstained', reason: 'empty answer'}
  const {text} = await generateText({
    model: judgeModel,
    system: RUBRIC,
    prompt: `Question: ${question}\nAnswer key: ${key}\nAnswer to grade: ${answer}`,
  })
  const m = /\{[\s\S]*\}/.exec(text)
  try {
    const j = JSON.parse(m?.[0] ?? '') as {verdict: Verdict; reason: string}
    if (!['correct', 'incorrect', 'abstained'].includes(j.verdict)) throw new Error('bad verdict')
    return j
  } catch {
    return {verdict: 'error', reason: `unparseable judge output: ${text.slice(0, 120)}`}
  }
}
