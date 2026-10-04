import 'server-only'
import {env} from './env'

const ALLOWED_ORIGINS = [/^https:\/\/www\.sanity\.io$/, /^https:\/\/[a-z0-9-]+\.sanity\.studio$/, /^http:\/\/localhost:3333$/]

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  if (!ALLOWED_ORIGINS.some((r) => r.test(origin))) return {}
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type',
    vary: 'origin',
  }
}

/**
 * A reviewer signed in to Sanity (the Dashboard desk app sends the user's token).
 * Valid only for a human whose own permissions let them edit this ruling: we ask the Content Lake
 * with a dry-run patch made with their token, so project roles, org roles and custom roles all count exactly,
 * and they must administer the organisation that owns the Knowledge Base the approval writes to.
 */
export async function sanityReviewer(req: Request, rulingId: string): Promise<string | null> {
  const auth = req.headers.get('authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null
  if (!token || token.length > 4096) return null
  const headers = {Authorization: `Bearer ${token}`, 'content-type': 'application/json'}
  const me = await fetch('https://api.sanity.io/v2021-06-07/users/me', {headers, cache: 'no-store'})
  if (!me.ok) return null
  const user = (await me.json()) as {id?: string; name?: string; email?: string; provider?: string}
  // Robot tokens are not people; the human gate needs a human.
  if (!user.id || user.provider === 'sanity-token') return null
  const probe = await fetch(`https://${env.projectId()}.api.sanity.io/v2026-09-01/data/mutate/${env.dataset()}?dryRun=true`, {
    method: 'POST',
    headers,
    cache: 'no-store',
    body: JSON.stringify({mutations: [{patch: {id: rulingId, set: {reviewer: user.name ?? 'reviewer'}}}]}),
  })
  if (!probe.ok) return null
  // Approving also resolves an issue in the organisation's Knowledge Base, so the person must administer that organisation too.
  if (!(await administersOrg(token, user.id))) return null
  return `${user.name ?? user.email ?? 'Sanity user'} (Sanity)`
}

const KB_ROLES = new Set(['administrator'])

async function administersOrg(token: string, userId: string): Promise<boolean> {
  const res = await fetch('https://api.sanity.io/v2025-01-01/organizations', {headers: {Authorization: `Bearer ${token}`}, cache: 'no-store'})
  if (!res.ok) return false
  const orgs = (await res.json()) as {id: string; members?: {sanityUserId: string; isCurrentUser?: boolean; roles?: {name: string}[]}[]}[]
  const org = orgs.find((o) => o.id === env.orgId())
  const me = org?.members?.find((m) => m.sanityUserId === userId)
  return Boolean(me?.roles?.some((r) => KB_ROLES.has(r.name)))
}
