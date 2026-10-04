import 'server-only'
import {createMCPClient} from '@ai-sdk/mcp'
import {createOpenAICompatible} from '@ai-sdk/openai-compatible'
import type {ToolSet} from 'ai'
import {env} from './env'
import {localTools} from './tools'

export function model() {
  const provider = createOpenAICompatible({name: 'llm', baseURL: env.llmBaseUrl(), apiKey: env.llmApiKey()})
  return provider(env.llmModel())
}

function mcpUrl(name: string): string {
  return `https://api.sanity.io/v1/context/organizations/${env.orgId()}/mcp/${name}`
}

const initialContextCache = new Map<string, {text: string; at: number}>()

/** The endpoint's orientation text, fetched over HTTP so the agent doesn't spend a tool call on it. */
async function initialContext(name: string): Promise<string> {
  const hit = initialContextCache.get(name)
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.text
  const res = await fetch(`${mcpUrl(name)}/initial-context?heading_offset=2`, {
    headers: {Authorization: `Bearer ${env.contextToken()}`},
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`initial-context ${name}: ${res.status} ${await res.text()}`)
  const text = await res.text()
  initialContextCache.set(name, {text, at: Date.now()})
  return text
}

type Closer = () => Promise<void>

/** Connect to both Sanity Context endpoints and namespace their tools so they can't collide. */
async function contextTools(scenario?: string): Promise<{tools: ToolSet; close: Closer}> {
  const headers = {Authorization: `Bearer ${env.contextToken()}`}
  const catalogUrl = scenario ? `${mcpUrl(env.mcpCatalog())}?perspective=${encodeURIComponent(scenario)}` : mcpUrl(env.mcpCatalog())
  const [catalog, knowledge] = await Promise.all([
    createMCPClient({transport: {type: 'http', url: catalogUrl, headers}, clientName: 'wallclock'}),
    createMCPClient({transport: {type: 'http', url: mcpUrl(env.mcpKnowledge()), headers}, clientName: 'wallclock'}),
  ])
  const tools: ToolSet = {}
  for (const [name, t] of Object.entries(await catalog.tools())) {
    if (name !== 'initial_context') tools[`catalog_${name}`] = t as ToolSet[string]
  }
  for (const [name, t] of Object.entries(await knowledge.tools())) {
    if (name !== 'initial_context') tools[`sources_${name}`] = t as ToolSet[string]
  }
  return {
    tools,
    close: async () => {
      await Promise.allSettled([catalog.close(), knowledge.close()])
    },
  }
}

const POLICY = `You are Wallclock, an agent that answers what the clock and the calendar legally say at a place and moment, and on whose authority.

How you work:
- Never state a UTC offset, a DST status, or whether a day is a working day from memory. Compute it with legal_time / working_day / audit_schedule. These read typed clock regimes and calendars that cite the instruments they rest on.
- Use catalog_* tools (GROQ over the structured dataset) to find instruments, their status (in force, enacted but not effective, conditional, pending bill, vetoed) and their dates. Status decides whether a law applies; a headline does not.
- Use sources_* tools (the Knowledge Base distilled from the original sources: decrees, gazettes, IANA tzdata, vendor notices, news) for what the sources actually say. When sources contradict each other, say so, name both, and say which one the dataset follows and why (authority tier, status, date).
- If legal_time reports that IANA tzdata or the server runtime disagree with the law, lead with that: it is the bug the user is about to ship.
- Pending or conditional laws are modelled as Content Releases. Answer under the law in force; if a pending law would change the answer, call the tool again with its scenario id and show both.
- If something is outside the dataset, say so plainly. Do not guess.

Answer shape: one short paragraph with the answer first (local time, offset, working day or not), then the basis: the instrument title, its authority tier and status. Keep it under 120 words unless asked for more. The UI renders your tool results as cards, so don't repeat every field.`

export async function buildAgent(scenario?: string) {
  const [catalogContext, knowledgeContext, ctx] = await Promise.all([
    initialContext(env.mcpCatalog()),
    initialContext(env.mcpKnowledge()),
    contextTools(scenario),
  ])
  const system = `${POLICY}

Today is ${new Date().toISOString().slice(0, 10)}.

# Structured dataset (catalog_* tools)
${catalogContext}

# Knowledge Base (sources_* tools)
${knowledgeContext}`
  return {system, tools: {...localTools, ...ctx.tools} as ToolSet, close: ctx.close}
}
