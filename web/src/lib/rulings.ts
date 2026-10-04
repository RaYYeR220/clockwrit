import 'server-only'
import {timingSafeEqual} from 'node:crypto'
import {generateText, Output} from 'ai'
import {z} from 'zod'
import {model} from './agent'
import {env} from './env'
import {contentClient, kbClient, writeClient} from './sanity'

// The Knowledge Base API on @sanity/client is marked beta; these are the shapes we rely on.
interface IssueSide {
  claim: string
  value?: string
  entryPaths?: string[]
  sourceIds?: string[]
  span?: {sourceId: string; lineStart: number; lineEnd: number}
  authority?: 'primary' | 'secondary' | 'community'
}
interface IssueDoc {
  _id: string
  status: 'open' | 'accepted' | 'rejected'
  resolution?: number
  resolvedBy?: {id: string; kind: 'user' | 'robot'}
  content: {
    kind: string
    severity?: string
    scopePath?: string
    issue?: string
    suggestedFix?: string
    claimKey?: string
    sides?: IssueSide[]
    suggested?: number
  }
}
interface Ctx {
  context: {
    issues: {
      list(q?: object): Promise<IssueDoc[]>
      resolve(a: {issueId: string; resolution: number}): Promise<unknown>
      apply(a: {issueIds: string[]}): Promise<unknown>
    }
    sources: {
      list(q?: object): Promise<{_id?: string; id?: string; title?: string; url?: string}[]>
      content(a: {sourceId: string; startLine?: number; endLine?: number}): Promise<unknown>
    }
  }
}

const kb = () => kbClient() as unknown as Ctx

export interface RulingView {
  issueId: string
  kind: string
  severity?: string
  claimKey?: string
  issue?: string
  status: IssueDoc['status']
  resolution?: number
  sides: (IssueSide & {index: number; sourceTitles: string[]; quote: string | null})[]
  ruling: RulingDoc | null
}

export interface RulingDoc {
  _id: string
  _rev?: string
  issueId: string
  status: 'proposed' | 'approved' | 'rejected' | 'applied'
  proposedSide: number
  question?: string
  rationale?: string
  structuredCheck?: string
  proposedBy?: string
  proposedAt?: string
  reviewer?: string
  reviewNote?: string
  decidedAt?: string
  appliedAt?: string
}

export function rulingIdFor(issueId: string) {
  return `ruling-${issueId.replace(/[^A-Za-z0-9_-]/g, '-')}`
}

async function sourceTitles(): Promise<Map<string, string>> {
  const list = await kb().context.sources.list({})
  return new Map(list.map((s) => [String(s._id ?? s.id), s.title ?? s.url ?? String(s._id ?? s.id)]))
}

function asText(content: unknown): string {
  if (typeof content === 'string') return content
  const c = content as {lines?: {text?: string}[] | string[]; content?: string; text?: string}
  if (Array.isArray(c?.lines)) return c.lines.map((l) => (typeof l === 'string' ? l : (l.text ?? ''))).join('\n')
  return c?.content ?? c?.text ?? JSON.stringify(content)
}

async function quoteFor(side: IssueSide): Promise<string | null> {
  if (!side.span) return null
  try {
    const c = await kb().context.sources.content({sourceId: side.span.sourceId, startLine: side.span.lineStart, endLine: side.span.lineEnd})
    return asText(c).slice(0, 1200)
  } catch {
    return null
  }
}

/** Conflicts the Knowledge Base raised, with each side's quoted evidence and any ruling on record. */
export async function listRulings(): Promise<RulingView[]> {
  const [issues, titles, rulings] = await Promise.all([
    kb().context.issues.list({}),
    sourceTitles(),
    contentClient().fetch<RulingDoc[]>(`*[_type == "ruling"]`),
  ])
  const byIssue = new Map(rulings.map((r) => [r.issueId, r]))
  const conflicts = issues.filter((i) => i.content?.kind === 'conflict')
  return Promise.all(
    conflicts.map(async (i) => ({
      issueId: i._id,
      kind: i.content.kind,
      severity: i.content.severity,
      claimKey: i.content.claimKey,
      issue: i.content.issue,
      status: i.status,
      resolution: i.resolution,
      sides: await Promise.all(
        (i.content.sides ?? []).map(async (s, index) => ({
          ...s,
          index,
          sourceTitles: (s.sourceIds ?? []).map((id) => titles.get(id) ?? id),
          quote: await quoteFor(s),
        })),
      ),
      ruling: byIssue.get(i._id) ?? null,
    })),
  )
}

const Draft = z.object({
  question: z.string().describe('The disputed fact as a short question'),
  proposedSide: z.number().int().min(0),
  rationale: z.string().describe('Why: authority tier, legal status, dates. 2-4 sentences.'),
  structuredCheck: z.string().describe('What the typed dataset records about this fact, and whether it agrees.'),
})

/** The agent drafts a ruling. It is stored as "proposed" and changes nothing until a person approves it. */
export async function draftRuling(issueId: string): Promise<RulingDoc> {
  const all = await listRulings()
  const view = all.find((v) => v.issueId === issueId)
  if (!view) throw new Error('No such conflict')
  if (view.status !== 'open') throw new Error('This conflict is already resolved')
  // A live draft is never overwritten: the reviewer must be approving exactly what they read.
  if (view.ruling && view.ruling.status !== 'rejected') throw new Error(`A ${view.ruling.status} ruling already exists for this conflict`)

  const keywords = `${view.claimKey ?? ''} ${view.issue ?? ''}`.slice(0, 300)
  const related = await contentClient().fetch(
    `*[_type == "instrument" && [title, summary] match $q] | order(authority asc)[0...8]{title, kind, authority, status, effective, url}`,
    {q: keywords.split(/\W+/).filter((w) => w.length > 3).slice(0, 8)},
  )
  const sides = view.sides
    .map((s) => `Side ${s.index} [${s.authority ?? 'unknown'}] from ${s.sourceTitles.join(', ')}: ${s.claim}${s.value ? ` (value: ${s.value})` : ''}\nQuote: ${s.quote ?? 'n/a'}`)
    .join('\n\n')
  const {output} = await generateText({
    model: model(),
    output: Output.object({schema: Draft}),
    system:
      'You draft rulings on conflicting claims about legal time and calendars. Prefer the claim backed by the law itself (primary) over reference data (secondary) over news (community), unless the primary source is superseded, conditional or not yet in force. Name dates and statuses. Never invent a third answer: pick a side index.',
    prompt: `Conflict: ${view.issue ?? view.claimKey}\n\n${sides}\n\nTyped records that may bear on it:\n${JSON.stringify(related, null, 1)}`,
  })
  if (output.proposedSide >= view.sides.length) throw new Error('Draft picked a side that does not exist')

  const doc: RulingDoc & {_type: 'ruling'} = {
    _id: rulingIdFor(issueId),
    _type: 'ruling',
    issueId,
    status: 'proposed',
    proposedSide: output.proposedSide,
    question: output.question,
    rationale: output.rationale,
    structuredCheck: output.structuredCheck,
    proposedBy: `agent:${env.llmModel()}`,
    proposedAt: new Date().toISOString(),
  }
  const body = {
    ...doc,
    knowledgeBase: env.knowledgeBaseId(),
    claimKey: view.claimKey,
    sides: view.sides.map((s) => ({
      _key: `s${s.index}`,
      index: s.index,
      claim: s.claim,
      value: s.value,
      authority: s.authority,
      sourceTitles: s.sourceTitles,
      quote: s.quote ?? undefined,
    })),
  }
  // Create when absent; replace only a rejected draft, and only the revision we just read.
  if (view.ruling?._rev) {
    const {_id, _type, ...fields} = body
    await writeClient().patch(_id).ifRevisionId(view.ruling._rev).set(fields).unset(['reviewer', 'reviewNote', 'decidedAt', 'appliedAt']).commit()
  } else {
    await writeClient().create(body)
  }
  return doc
}

export function checkPasscode(given: string | undefined): boolean {
  const expected = env.reviewerPasscode()
  if (!expected || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** A person approves or sends back the agent's draft. Approval resolves the conflict in the Knowledge Base. */
export async function decide(input: {
  issueId: string
  decision: 'approve' | 'reject'
  reviewer: string
  note?: string
  /** The draft revision and side the reviewer was shown. */
  expectedRev: string
  expectedSide: number
}): Promise<RulingDoc> {
  const id = rulingIdFor(input.issueId)
  const ruling = await contentClient().fetch<RulingDoc | null>(`*[_id == $id][0]`, {id})
  if (!ruling) throw new Error('No draft ruling for this conflict')
  if (ruling.status !== 'proposed') throw new Error(`Ruling is already ${ruling.status}`)
  if (ruling._rev !== input.expectedRev || ruling.proposedSide !== input.expectedSide)
    throw new Error('The draft changed since you opened it; reload and review again')
  const decidedAt = new Date().toISOString()

  if (input.decision === 'reject') {
    await writeClient().patch(id).ifRevisionId(input.expectedRev).set({status: 'rejected', reviewer: input.reviewer, reviewNote: input.note, decidedAt}).commit()
    return {...ruling, status: 'rejected', reviewer: input.reviewer, reviewNote: input.note, decidedAt}
  }

  // Record the human decision first, so the audit trail exists even if the Knowledge Base call fails.
  await writeClient().patch(id).ifRevisionId(input.expectedRev).set({status: 'approved', reviewer: input.reviewer, reviewNote: input.note, decidedAt}).commit()
  await kb().context.issues.resolve({issueId: input.issueId, resolution: ruling.proposedSide})
  const appliedAt = new Date().toISOString()
  await writeClient().patch(id).set({status: 'applied', appliedAt}).commit()
  return {...ruling, status: 'applied', reviewer: input.reviewer, reviewNote: input.note, decidedAt, appliedAt}
}
