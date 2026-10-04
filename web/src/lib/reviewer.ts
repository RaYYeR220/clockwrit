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
 * Valid only if the token can read this project — i.e. the person is a project member.
 */
export async function sanityReviewer(req: Request): Promise<string | null> {
  const auth = req.headers.get('authorization')
  const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null
  if (!token || token.length > 4096) return null
  const headers = {Authorization: `Bearer ${token}`}
  const [project, me] = await Promise.all([
    fetch(`https://api.sanity.io/v2021-06-07/projects/${env.projectId()}`, {headers, cache: 'no-store'}),
    fetch('https://api.sanity.io/v2021-06-07/users/me', {headers, cache: 'no-store'}),
  ])
  if (!project.ok || !me.ok) return null
  const user = (await me.json()) as {name?: string; email?: string; provider?: string}
  // Robot tokens are not people; the human gate needs a human.
  if (user.provider === 'sanity-token') return null
  return `${user.name ?? user.email ?? 'Sanity user'} (Sanity)`
}
