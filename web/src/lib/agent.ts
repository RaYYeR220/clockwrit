import 'server-only'
import {createMCPClient} from '@ai-sdk/mcp'
import {createOpenAICompatible} from '@ai-sdk/openai-compatible'
import type {ToolSet} from 'ai'
import {env} from './env'
import {resolveScenario} from './data'
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

async function endpointTools(name: string, url: string, prefix: string): Promise<{tools: ToolSet; close: Closer}> {
  const client = await createMCPClient({
    transport: {type: 'http', url, headers: {Authorization: `Bearer ${env.contextToken()}`}},
    clientName: 'clockwrit',
  })
  const tools: ToolSet = {}
  for (const [tool, t] of Object.entries(await client.tools())) {
    if (tool !== 'initial_context') tools[`${prefix}_${tool}`] = t as ToolSet[string]
  }
  return {tools, close: () => client.close()}
}

interface Endpoint {
  ok: boolean
  context: string
  tools: ToolSet
  close: Closer
}

/** One Sanity Context endpoint: its orientation text and its tools, namespaced so the two endpoints can't collide. */
async function connect(name: string, prefix: string, scenario?: string): Promise<Endpoint> {
  const url = scenario ? `${mcpUrl(name)}?perspective=${encodeURIComponent(scenario)}` : mcpUrl(name)
  try {
    const [context, t] = await Promise.all([initialContext(name), endpointTools(name, url, prefix)])
    return {ok: true, context, ...t}
  } catch (e) {
    // Reported to the model and the user rather than silently dropped.
    return {ok: false, context: `Unavailable right now (${(e as Error).message.slice(0, 160)}).`, tools: {}, close: async () => {}}
  }
}

const POLICY = `You are Clockwrit, an agent that answers what the clock and the calendar legally say at a place and moment, and on whose authority.

How you work:
- Never state a UTC offset, a DST status, or whether a day is a working day from memory. Compute it with legal_time / working_day / audit_schedule. These read typed clock regimes and calendars that cite the instruments they rest on.
- Use catalog_* tools (GROQ over the structured dataset) to find instruments, their status (in force, enacted but not effective, conditional, pending bill, vetoed) and their dates. Status decides whether a law applies; a headline does not.
- Use sources_* tools (the Knowledge Base distilled from the original sources: decrees, gazettes, IANA tzdata, vendor notices, news) for what the sources actually say. When sources contradict each other, say so, name both, and say which one the dataset follows and why (authority tier, status, date).
- If legal_time reports that IANA tzdata or the server runtime disagree with the law, lead with that: it is the bug the user is about to ship.
- Pending or conditional laws are modelled as Content Releases. Answer under the law in force; if a pending law would change the answer, call the tool again with its scenario id and show both.
- If something is outside the dataset, say so plainly. Do not guess.

Answer shape: one short paragraph with the answer first (local time, offset, working day or not), then the basis: the instrument title, its authority tier and status. Keep it under 120 words unless asked for more. The UI renders your tool results as cards, so don't repeat every field.`

export async function buildAgent(requestedScenario?: string) {
  const scenario = await resolveScenario(requestedScenario)
  const [catalog, knowledge] = await Promise.all([
    connect(env.mcpCatalog(), 'catalog', scenario),
    connect(env.mcpKnowledge(), 'sources'),
  ])
  const unavailable = knowledge.ok ? '' : '\nThe Knowledge Base is unavailable for this answer. Say so if the question needs what the sources say.\n'
  const system = `${POLICY}
${unavailable}
Today is ${new Date().toISOString().slice(0, 10)}.

# Structured dataset (catalog_* tools)
${catalog.context}

# Knowledge Base (sources_* tools)
${knowledge.context}`
  return {
    system,
    tools: {...localTools, ...catalog.tools, ...knowledge.tools} as ToolSet,
    sources: {catalog: catalog.ok, knowledge: knowledge.ok},
    close: async () => {
      await Promise.allSettled([catalog.close(), knowledge.close()])
    },
  }
}
