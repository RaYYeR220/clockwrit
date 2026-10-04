import {CalendarIcon, PauseIcon, SunIcon, SwitchIcon} from '@sanity/icons'
import {defineArrayMember, defineField, defineType} from 'sanity'
import {STATUS} from './shared'

const basis = defineField({
  name: 'basis',
  title: 'Legal basis',
  type: 'array',
  of: [defineArrayMember({type: 'reference', to: [{type: 'instrument'}]})],
  validation: (r) => r.required().min(1),
})

const jurisdictionRef = defineField({
  name: 'jurisdiction',
  type: 'reference',
  to: [{type: 'jurisdiction'}],
  validation: (r) => r.required(),
})

export const holiday = defineType({
  name: 'holiday',
  title: 'Holiday',
  type: 'document',
  icon: SunIcon,
  fields: [
    jurisdictionRef,
    defineField({name: 'date', type: 'date', validation: (r) => r.required()}),
    defineField({name: 'name', type: 'string', validation: (r) => r.required()}),
    defineField({name: 'nameLocal', title: 'Name (local language)', type: 'string'}),
    defineField({
      name: 'dayOff',
      title: 'Day off for the general workforce',
      type: 'boolean',
      initialValue: true,
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'kind',
      type: 'string',
      options: {list: ['statutory', 'substitute', 'bridge', 'moon-sighted', 'one-off', 'observance']},
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'dateCertainty',
      type: 'string',
      options: {
        list: [
          {title: 'Fixed by law', value: 'fixed'},
          {title: 'Announced by the authority', value: 'announced'},
          {title: 'Calculated in advance (may move on sighting)', value: 'estimated'},
        ],
        layout: 'radio',
      },
      initialValue: 'fixed',
    }),
    defineField({name: 'status', type: 'string', options: {list: STATUS}, initialValue: 'in_force'}),
    basis,
  ],
  orderings: [{title: 'Date', name: 'date', by: [{field: 'date', direction: 'asc'}]}],
  preview: {
    select: {title: 'name', date: 'date', code: 'jurisdiction.code', dayOff: 'dayOff'},
    prepare: ({title, date, code, dayOff}) => ({title, subtitle: `${code} · ${date}${dayOff ? '' : ' · not a day off'}`}),
  },
})

export const weekendRegime = defineType({
  name: 'weekendRegime',
  title: 'Weekend regime',
  type: 'document',
  icon: CalendarIcon,
  fields: [
    jurisdictionRef,
    defineField({name: 'from', type: 'date'}),
    defineField({name: 'to', type: 'date'}),
    defineField({
      name: 'days',
      title: 'Rest days',
      type: 'array',
      of: [{type: 'number'}],
      options: {
        list: [
          {title: 'Monday', value: 1},
          {title: 'Tuesday', value: 2},
          {title: 'Wednesday', value: 3},
          {title: 'Thursday', value: 4},
          {title: 'Friday', value: 5},
          {title: 'Saturday', value: 6},
          {title: 'Sunday', value: 7},
        ],
      },
      validation: (r) => r.required().min(1).unique(),
    }),
    defineField({name: 'note', type: 'text', rows: 2, description: 'Half-days, sector differences, etc.'}),
    basis,
  ],
  preview: {
    select: {code: 'jurisdiction.code', from: 'from', days: 'days'},
    prepare: ({code, from, days}) => ({
      title: `${code} weekend: ${(days ?? []).map((d: number) => ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d]).join('+')}`,
      subtitle: from ? `from ${from}` : 'historical',
    }),
  },
})

export const workdayOverride = defineType({
  name: 'workdayOverride',
  title: 'Workday override',
  type: 'document',
  icon: SwitchIcon,
  description: 'A date whose working status is set explicitly, e.g. a weekend day made a working day to bridge a holiday.',
  fields: [
    jurisdictionRef,
    defineField({name: 'date', type: 'date', validation: (r) => r.required()}),
    defineField({name: 'isWorkday', type: 'boolean', validation: (r) => r.required()}),
    defineField({name: 'reason', type: 'string', validation: (r) => r.required()}),
    basis,
  ],
  preview: {
    select: {code: 'jurisdiction.code', date: 'date', w: 'isWorkday', reason: 'reason'},
    prepare: ({code, date, w, reason}) => ({title: `${code} ${date}: ${w ? 'working day' : 'day off'}`, subtitle: reason}),
  },
})

export const holidaySuspension = defineType({
  name: 'holidaySuspension',
  title: 'Holiday suspension',
  type: 'document',
  icon: PauseIcon,
  fields: [
    jurisdictionRef,
    defineField({name: 'from', type: 'date', validation: (r) => r.required()}),
    defineField({name: 'to', type: 'date'}),
    defineField({name: 'reason', type: 'string', validation: (r) => r.required()}),
    basis,
  ],
  preview: {select: {title: 'reason', subtitle: 'jurisdiction.code'}},
})
