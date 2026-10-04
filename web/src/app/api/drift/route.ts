import {serverDrift} from '@/lib/drift'

export const runtime = 'nodejs'
export const revalidate = 3600

/** Zones where this server's tz data disagrees with the pinned IANA release, sampled daily over the next ~15 months. */
export async function GET() {
  return Response.json(serverDrift())
}
