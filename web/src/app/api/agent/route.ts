import {sanityInsightsIntegration} from '@sanity/context/ai-sdk'
import {convertToModelMessages, stepCountIs, streamText, type UIMessage} from 'ai'
import {buildAgent, model} from '@/lib/agent'
import {env} from '@/lib/env'
import {orgClient} from '@/lib/sanity'

import {rateLimit} from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: Request) {
  if (!rateLimit(req, 'agent', 20, 10 * 60_000)) return Response.json({error: 'Rate limited, try again in a few minutes'}, {status: 429})
  const body = (await req.json()) as {messages: UIMessage[]; id?: string; scenario?: string}
  if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 40) {
    return Response.json({error: 'Expected 1-40 messages'}, {status: 400})
  }
  const agent = await buildAgent(body.scenario)
  const threadId = body.id ?? crypto.randomUUID()
  const result = streamText({
    model: model(),
    system: agent.system,
    messages: await convertToModelMessages(body.messages),
    tools: agent.tools,
    stopWhen: stepCountIs(14),
    telemetry: {
      integrations: [
        sanityInsightsIntegration({
          client: orgClient(),
          threadId,
          metadata: {mcpEndpoints: [env.mcpCatalog(), env.mcpKnowledge()], surface: 'ask'},
        }),
      ],
    },
    onEnd: () => agent.close(),
    onError: () => agent.close(),
  })
  return result.toUIMessageStreamResponse()
}
