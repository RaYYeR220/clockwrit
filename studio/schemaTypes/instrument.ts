import {DocumentTextIcon} from '@sanity/icons/DocumentText'
import {defineArrayMember, defineField, defineType} from 'sanity'
import {AUTHORITY, STATUS} from './shared'

/**
 * Anything that makes a claim about legal time: a statute, a decree, a bill,
 * an IANA tzdata release, a vendor notice, a news report, a library file.
 * Authority and status are first-class so the agent can rank claims instead of guessing.
 */
export const instrument = defineType({
  name: 'instrument',
  title: 'Instrument',
  type: 'document',
  icon: DocumentTextIcon,
  groups: [
    {name: 'what', title: 'What', default: true},
    {name: 'when', title: 'When'},
    {name: 'evidence', title: 'Evidence'},
  ],
  fields: [
    defineField({name: 'title', type: 'string', group: 'what', validation: (r) => r.required()}),
    defineField({
      name: 'kind',
      type: 'string',
      group: 'what',
      options: {
        list: [
          'statute',
          'decree',
          'regulation',
          'bill',
          'official-announcement',
          'court-ruling',
          'tzdata-release',
          'vendor-notice',
          'news',
          'encyclopedia',
          'library',
        ],
      },
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'authority',
      type: 'string',
      group: 'what',
      options: {list: AUTHORITY, layout: 'radio'},
      validation: (r) => r.required(),
    }),
    defineField({
      name: 'status',
      type: 'string',
      group: 'what',
      options: {list: STATUS},
      description: 'Legal status as of the last review. News and libraries are "in force" only in the sense that they are still published.',
      validation: (r) => r.required(),
    }),
    defineField({name: 'jurisdiction', type: 'reference', to: [{type: 'jurisdiction'}], group: 'what'}),
    defineField({name: 'publisher', type: 'string', group: 'what'}),
    defineField({name: 'summary', type: 'text', rows: 3, group: 'what', description: 'What this instrument says, in one or two sentences.'}),
    defineField({
      name: 'condition',
      type: 'text',
      rows: 2,
      group: 'when',
      description: 'For conditional instruments: the trigger that has to happen first.',
      hidden: ({document}) => document?.status !== 'conditional',
    }),
    defineField({name: 'published', type: 'date', group: 'when'}),
    defineField({name: 'effective', type: 'datetime', group: 'when', description: 'When it takes (or took) effect, as a UTC instant.'}),
    defineField({name: 'reviewedAt', title: 'Status last reviewed', type: 'date', group: 'when', validation: (r) => r.required()}),
    defineField({
      name: 'supersedes',
      type: 'array',
      group: 'when',
      of: [defineArrayMember({type: 'reference', to: [{type: 'instrument'}]})],
    }),
    defineField({name: 'url', type: 'url', group: 'evidence', validation: (r) => r.required()}),
    defineField({name: 'quotes', type: 'array', group: 'evidence', of: [defineArrayMember({type: 'quote'})]}),
    defineField({
      name: 'tzdataVersion',
      title: 'tzdata version',
      type: 'string',
      group: 'evidence',
      description: 'For tzdata releases: the version string, e.g. "2026e".',
      hidden: ({document}) => document?.kind !== 'tzdata-release',
    }),
  ],
  preview: {
    select: {title: 'title', kind: 'kind', authority: 'authority', status: 'status'},
    prepare: ({title, kind, authority, status}) => ({title, subtitle: `${authority} · ${kind} · ${status}`}),
  },
})
