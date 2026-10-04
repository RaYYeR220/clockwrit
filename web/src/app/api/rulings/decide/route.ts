import {checkPasscode, decide} from '@/lib/rulings'
import {rateLimit} from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  if (!rateLimit(req, 'decide', 10, 10 * 60_000)) return Response.json({error: 'Too many attempts'}, {status: 429})
  const body = (await req.json().catch(() => ({}))) as {issueId?: string; decision?: string; reviewer?: string; note?: string; passcode?: string}
  // The gate is in code, not in the prompt: no passcode, no change to the Knowledge Base.
  if (!checkPasscode(body.passcode)) return Response.json({error: 'Reviewer passcode required'}, {status: 403})
  if (!body.issueId || (body.decision !== 'approve' && body.decision !== 'reject'))
    return Response.json({error: 'issueId and decision (approve|reject) required'}, {status: 400})
  const reviewer = (body.reviewer ?? '').trim().slice(0, 80) || 'reviewer'
  try {
    return Response.json({ruling: await decide({issueId: body.issueId, decision: body.decision, reviewer, note: body.note?.slice(0, 500)})})
  } catch (e) {
    return Response.json({error: (e as Error).message}, {status: 409})
  }
}
