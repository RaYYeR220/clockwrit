import {createMcpHandler} from 'mcp-handler'
import {z} from 'zod'
import {auditFor, legalTime, workingDay} from '@/lib/tools'

export const runtime = 'nodejs'
export const maxDuration = 60

const scenario = z.string().optional().describe('Content Release id of a pending law; omit for the law in force')

function result(value: unknown) {
  return {content: [{type: 'text' as const, text: JSON.stringify(value, null, 2)}], structuredContent: value as Record<string, unknown>}
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      'legal_time',
      {
        title: 'Legal time',
        description:
          'The legal UTC offset and wall-clock reading for an IANA zone at an instant (or resolve a local reading to UTC), with the law it rests on and what IANA tzdata and the server runtime say.',
        inputSchema: z.object({
          zone: z.string().describe('IANA zone id'),
          at: z.string().optional().describe('UTC instant, ISO 8601'),
          local: z.string().optional().describe('Local reading "YYYY-MM-DDTHH:mm"'),
          scenario,
        }),
      },
      async (input) => result(await legalTime(input)),
    )
    server.registerTool(
      'working_day',
      {
        title: 'Working day',
        description: 'Whether a local date is a legal working day in a jurisdiction, with holidays, weekend regime, overrides and suspensions cited.',
        inputSchema: z.object({jurisdiction: z.string(), date: z.string(), scenario}),
      },
      async (input) => result(await workingDay(input)),
    )
    server.registerTool(
      'audit_schedule',
      {
        title: 'Audit a schedule',
        description: 'Flag occurrences of recurring events that fall in DST gaps/overlaps, on stale runtime tz data, or on a participant’s holiday or rest day.',
        inputSchema: z.object({
          events: z.array(z.object({title: z.string(), start: z.string(), zone: z.string(), rrule: z.string().optional()})).max(10),
          participants: z.array(z.object({label: z.string(), zone: z.string(), jurisdiction: z.string()})).max(12),
          from: z.string(),
          to: z.string(),
          scenario,
        }),
      },
      async (input) => result(await auditFor(input)),
    )
  },
  {serverInfo: {name: 'clockwrit', version: '0.1.0'}},
)

export {handler as GET, handler as POST}
