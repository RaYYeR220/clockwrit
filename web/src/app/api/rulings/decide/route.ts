import {rateLimit} from '@/lib/rate-limit'
import {corsHeaders, sanityReviewer} from '@/lib/reviewer'
import {checkPasscode, decide} from '@/lib/rulings'

export const runtime = 'nodejs'
export const maxDuration = 60

export function OPTIONS(req: Request) {
  return new Response(null, {status: 204, headers: corsHeaders(req)})
}

export async function POST(req: Request) {
  const cors = corsHeaders(req)
  if (!rateLimit(req, 'decide', 10, 10 * 60_000)) return Response.json({error: 'Too many attempts'}, {status: 429, headers: cors})
  const body = (await req.json().catch(() => ({}))) as {
    issueId?: string
    decision?: string
    reviewer?: string
    note?: string
    passcode?: string
    expectedRev?: string
    expectedSide?: number
  }
  // The gate is in code, not in the prompt: either a Sanity project member's token or the reviewer passcode.
  const member = await sanityReviewer(req)
  if (!member && !checkPasscode(body.passcode)) return Response.json({error: 'Reviewer sign-in or passcode required'}, {status: 403, headers: cors})
  if (!body.issueId || (body.decision !== 'approve' && body.decision !== 'reject') || !body.expectedRev || typeof body.expectedSide !== 'number')
    return Response.json({error: 'issueId, decision (approve|reject), expectedRev and expectedSide required'}, {status: 400, headers: cors})
  const reviewer = member ?? ((body.reviewer ?? '').trim().slice(0, 80) || 'reviewer')
  try {
    const ruling = await decide({
      issueId: body.issueId,
      decision: body.decision,
      reviewer,
      note: body.note?.slice(0, 500),
      expectedRev: body.expectedRev,
      expectedSide: body.expectedSide,
    })
    return Response.json({ruling}, {headers: cors})
  } catch (e) {
    return Response.json({error: (e as Error).message}, {status: 409, headers: cors})
  }
}
