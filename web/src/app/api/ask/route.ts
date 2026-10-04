import {generateText, stepCountIs} from 'ai'
import {buildAgent, model} from '@/lib/agent'

import {rateLimit} from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 120

/** One question in, one grounded answer out — for scripts, the CLI and the eval harness. */
export async function POST(req: Request) {
  if (!rateLimit(req, 'ask', Number(process.env.ASK_RATE_LIMIT ?? 30), 10 * 60_000)) return Response.json({error: 'Rate limited, try again in a few minutes'}, {status: 429})
  const body = (await req.json().catch(() => ({}))) as {question?: string; scenario?: string}
  const question = body.question?.trim()
  if (!question || question.length > 2000) return Response.json({error: 'Expected a question (1-2000 chars)'}, {status: 400})
  let agent: Awaited<ReturnType<typeof buildAgent>>
  try {
    agent = await buildAgent(body.scenario)
  } catch (e) {
    return Response.json({error: (e as Error).message}, {status: 400})
  }
  try {
    const result = await generateText({
      model: model(),
      system: agent.system,
      prompt: question,
      tools: agent.tools,
      stopWhen: stepCountIs(14),
    })
    const calls = result.steps.flatMap((s) => s.toolCalls.map((c) => c.toolName))
    const outputs = result.steps.flatMap((s) => s.toolResults.map((r) => ({tool: r.toolName, output: r.output})))
    return Response.json({answer: result.text, tools: calls, results: outputs})
  } finally {
    await agent.close()
  }
}
