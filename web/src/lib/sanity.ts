import 'server-only'
import {createClient, type ClientPerspective, type SanityClient} from '@sanity/client'
import {API_VERSION, env} from './env'

let content: SanityClient | null = null
let writer: SanityClient | null = null
let org: SanityClient | null = null
const kbClients = new Map<string, SanityClient>()

/** Read client for the structured dataset. Pass a release id to read "as if this release shipped". */
export function contentClient(perspective?: ClientPerspective): SanityClient {
  content ??= createClient({
    projectId: env.projectId(),
    dataset: env.dataset(),
    apiVersion: API_VERSION,
    useCdn: false,
    token: env.readToken() ?? env.writeToken(),
    perspective: 'published',
  })
  return perspective ? content.withConfig({perspective}) : content
}

export function writeClient(): SanityClient {
  writer ??= createClient({
    projectId: env.projectId(),
    dataset: env.dataset(),
    apiVersion: API_VERSION,
    useCdn: false,
    token: env.writeToken(),
  })
  return writer
}

/** Organisation-scoped client for Sanity Context (conversations, Knowledge Base listing). */
export function orgClient(): SanityClient {
  org ??= createClient({
    apiVersion: API_VERSION,
    token: env.contextEditorToken(),
    useProjectHostname: false,
    context: {organizationId: env.orgId()},
  } as Parameters<typeof createClient>[0])
  return org
}

/** Client scoped to one Knowledge Base (issues, instructions, entries, sources). */
export function kbClient(knowledgeBaseId = env.knowledgeBaseId()): SanityClient {
  let c = kbClients.get(knowledgeBaseId)
  if (!c) {
    c = createClient({
      apiVersion: API_VERSION,
      token: env.contextEditorToken(),
      useProjectHostname: false,
      resource: {type: 'knowledge-base', id: knowledgeBaseId},
      context: {organizationId: env.orgId()},
    } as Parameters<typeof createClient>[0])
    kbClients.set(knowledgeBaseId, c)
  }
  return c
}
