import {ClockIcon} from '@sanity/icons'
import {defineArrayMember, defineField, defineType} from 'sanity'

/**
 * The legal clock regime of one zone over one span of time.
 * A zone's history is a chain of segments; each one names the instrument it rests on.
 */
export const ruleSegment = defineType({
  name: 'ruleSegment',
  title: 'Clock regime',
  type: 'document',
  icon: ClockIcon,
  fields: [
    defineField({name: 'zone', type: 'reference', to: [{type: 'zone'}], validation: (r) => r.required()}),
    defineField({name: 'validFrom', type: 'datetime', description: 'UTC instant. Empty = since before our records.'}),
    defineField({
      name: 'validTo',
      type: 'datetime',
      description: 'UTC instant (exclusive). Empty = until further notice.',
      validation: (r) =>
        r.custom((to, ctx) => {
          const from = (ctx.document as {validFrom?: string} | undefined)?.validFrom
          return !to || !from || Date.parse(to) > Date.parse(from) ? true : 'validTo must be after validFrom'
        }),
    }),
    defineField({
      name: 'stdOffsetMinutes',
      title: 'Standard offset (minutes from UTC)',
      type: 'number',
      description: 'UTC-3 is -180; UTC+5:30 is 330.',
      validation: (r) => r.required().integer().min(-720).max(840),
    }),
    defineField({
      name: 'dst',
      title: 'Daylight saving',
      type: 'object',
      description: 'Leave empty if the clock does not change in this regime.',
      fields: [
        defineField({name: 'saveMinutes', type: 'number', initialValue: 60, validation: (r) => r.required().integer()}),
        defineField({name: 'start', type: 'transitionRule', validation: (r) => r.required()}),
        defineField({name: 'end', type: 'transitionRule', validation: (r) => r.required()}),
      ],
    }),
    defineField({name: 'abbreviations', type: 'array', of: [{type: 'string'}], validation: (r) => r.max(2)}),
    defineField({
      name: 'basis',
      title: 'Legal basis',
      type: 'array',
      of: [defineArrayMember({type: 'reference', to: [{type: 'instrument'}]})],
      validation: (r) => r.required().min(1),
    }),
    defineField({name: 'note', type: 'text', rows: 2}),
  ],
  orderings: [{title: 'Valid from', name: 'validFrom', by: [{field: 'validFrom', direction: 'desc'}]}],
  preview: {
    select: {zone: 'zone.ianaId', from: 'validFrom', std: 'stdOffsetMinutes', dst: 'dst.saveMinutes'},
    prepare: ({zone, from, std, dst}) => {
      const h = (m: number) => `${m < 0 ? '−' : '+'}${Math.floor(Math.abs(m) / 60)}:${String(Math.abs(m) % 60).padStart(2, '0')}`
      return {
        title: `${zone ?? '?'} · UTC${h(std ?? 0)}${dst ? ` (+${dst}m DST)` : ''}`,
        subtitle: from ? `from ${from.slice(0, 10)}` : 'historical',
      }
    },
  },
})
