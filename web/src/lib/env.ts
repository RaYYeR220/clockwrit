import 'server-only'

function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing environment variable ${name}`)
  return v
}

export const env = {
  projectId: () => required('NEXT_PUBLIC_SANITY_PROJECT_ID'),
  dataset: () => process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production',
  orgId: () => required('SANITY_ORGANIZATION_ID'),
  /** Org token with Context Viewer (read) — used for the MCP endpoints. */
  contextToken: () => required('SANITY_CONTEXT_TOKEN'),
  /** Org token with Context Editor — used for Knowledge Base issues and Insights. */
  contextEditorToken: () => process.env.SANITY_CONTEXT_EDITOR_TOKEN ?? required('SANITY_CONTEXT_TOKEN'),
  /** Project token with write access — rulings are written back to the dataset. */
  writeToken: () => required('SANITY_WRITE_TOKEN'),
  /** Project token with the Viewer role — needed to read Content Release versions. */
  readToken: () => required('SANITY_READ_TOKEN'),
  mcpCatalog: () => process.env.SANITY_MCP_CATALOG ?? 'clockwrit-catalog',
  mcpKnowledge: () => process.env.SANITY_MCP_KNOWLEDGE ?? 'clockwrit-sources',
  knowledgeBaseId: () => required('SANITY_KNOWLEDGE_BASE_ID'),
  llmBaseUrl: () => process.env.LLM_BASE_URL ?? 'https://api.venice.ai/api/v1',
  llmApiKey: () => required('LLM_API_KEY'),
  llmModel: () => process.env.LLM_MODEL ?? 'claude-sonnet-5-5',
  /** Passcode that lets a reviewer approve rulings from the public desk. */
  reviewerPasscode: () => process.env.REVIEWER_PASSCODE ?? '',
}

export const API_VERSION = '2026-09-01'
