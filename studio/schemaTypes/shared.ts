import {defineField, defineType} from 'sanity'

export const AUTHORITY = [
  {title: 'Primary — the law itself (statute, decree, gazette, official announcement)', value: 'primary'},
  {title: 'Secondary — a maintained reference (IANA tzdata, vendor notice)', value: 'secondary'},
  {title: 'Community — news, encyclopedias, libraries, blogs', value: 'community'},
]

export const STATUS = [
  {title: 'In force', value: 'in_force'},
  {title: 'Enacted, not yet effective', value: 'enacted_not_effective'},
  {title: 'Conditional (enacted, waits on a trigger)', value: 'conditional'},
  {title: 'Pending bill', value: 'pending_bill'},
  {title: 'Proposed', value: 'proposed'},
  {title: 'Vetoed or lapsed', value: 'vetoed_or_lapsed'},
  {title: 'Suspended', value: 'suspended'},
  {title: 'Superseded', value: 'superseded'},
  {title: 'Expired', value: 'expired'},
]

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((title, i) => ({
  title,
  value: i + 1,
}))

/** One annual clock change, written the way the law (and zic) writes it. */
export const transitionRule = defineType({
  name: 'transitionRule',
  title: 'Transition rule',
  type: 'object',
  fields: [
    defineField({name: 'month', type: 'number', options: {list: MONTHS}, validation: (r) => r.required()}),
    defineField({
      name: 'on',
      title: 'Day',
      type: 'string',
      description: 'A day of month ("15"), "lastSun", or "Sun>=8" / "Fri<=1" — the zic ON field.',
      validation: (r) =>
        r.required().regex(/^(\d{1,2}|last(Mon|Tue|Wed|Thu|Fri|Sat|Sun)|(Mon|Tue|Wed|Thu|Fri|Sat|Sun)(>=|<=)\d{1,2})$/, {
          name: 'zic ON field',
        }),
    }),
    defineField({
      name: 'at',
      title: 'Time',
      type: 'string',
      description: 'Clock reading at which the change happens, e.g. "2:00" or "24:00".',
      validation: (r) => r.required().regex(/^\d{1,2}:\d{2}(:\d{2})?$/),
    }),
    defineField({
      name: 'atType',
      title: 'Measured in',
      type: 'string',
      options: {
        list: [
          {title: 'Local wall clock', value: 'wall'},
          {title: 'Local standard time', value: 'std'},
          {title: 'UTC', value: 'utc'},
        ],
        layout: 'radio',
        direction: 'horizontal',
      },
      initialValue: 'wall',
      validation: (r) => r.required(),
    }),
  ],
  preview: {
    select: {month: 'month', on: 'on', at: 'at', atType: 'atType'},
    prepare: ({month, on, at, atType}) => ({title: `${MONTHS[(month ?? 1) - 1]?.title} ${on} ${at} ${atType}`}),
  },
})

/** A verbatim excerpt that supports a claim, kept in its original language. */
export const quote = defineType({
  name: 'quote',
  title: 'Quote',
  type: 'object',
  fields: [
    defineField({name: 'original', type: 'text', rows: 3, validation: (r) => r.required()}),
    defineField({name: 'language', type: 'string', description: 'BCP-47 tag, e.g. "es", "pl", "uk".'}),
    defineField({name: 'english', type: 'text', rows: 3, description: 'Translation, if the original is not English.'}),
    defineField({name: 'locator', type: 'string', description: 'Article, section, page or line the quote comes from.'}),
  ],
})
