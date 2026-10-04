import {ScaleIcon} from '@sanity/icons'
import {defineArrayMember, defineField, defineType} from 'sanity'

/**
 * The record of a decision on a Knowledge Base conflict.
 * The agent drafts it, a person approves it, and only then is it applied to the Knowledge Base,
 * where it becomes a standing instruction for every later build.
 */
export const ruling = defineType({
  name: 'ruling',
  title: 'Ruling',
  type: 'document',
  icon: ScaleIcon,
  fields: [
    defineField({name: 'issueId', title: 'Knowledge Base issue', type: 'string', readOnly: true, validation: (r) => r.required()}),
    defineField({name: 'knowledgeBase', type: 'string', readOnly: true}),
    defineField({name: 'claimKey', type: 'string', readOnly: true}),
    defineField({name: 'question', type: 'string', description: 'The fact in dispute, phrased as a question.'}),
    defineField({
      name: 'sides',
      type: 'array',
      readOnly: true,
      of: [
        defineArrayMember({
          type: 'object',
          name: 'side',
          fields: [
            defineField({name: 'index', type: 'number'}),
            defineField({name: 'claim', type: 'text', rows: 2}),
            defineField({name: 'value', type: 'string'}),
            defineField({name: 'authority', type: 'string'}),
            defineField({name: 'sourceTitles', type: 'array', of: [{type: 'string'}]}),
            defineField({name: 'quote', type: 'text', rows: 3}),
          ],
          preview: {select: {title: 'value', subtitle: 'authority'}},
        }),
      ],
    }),
    defineField({
      name: 'status',
      type: 'string',
      options: {
        list: [
          {title: 'Proposed by the agent', value: 'proposed'},
          {title: 'Approved by a person', value: 'approved'},
          {title: 'Sent back', value: 'rejected'},
          {title: 'Applied to the Knowledge Base', value: 'applied'},
        ],
        layout: 'radio',
      },
      initialValue: 'proposed',
      validation: (r) => r.required(),
    }),
    defineField({name: 'proposedSide', type: 'number', validation: (r) => r.required().integer().min(0)}),
    defineField({name: 'rationale', type: 'text', rows: 5, description: 'Why this side, in terms of authority, status and dates.'}),
    defineField({
      name: 'structuredCheck',
      title: 'Cross-check against the dataset',
      type: 'text',
      rows: 3,
      description: 'What the typed records (instruments, clock regimes, holidays) say about the same fact.',
    }),
    defineField({name: 'proposedBy', type: 'string', readOnly: true}),
    defineField({name: 'proposedAt', type: 'datetime', readOnly: true}),
    defineField({name: 'reviewer', type: 'string'}),
    defineField({name: 'reviewNote', type: 'text', rows: 2}),
    defineField({name: 'decidedAt', type: 'datetime'}),
    defineField({name: 'appliedAt', type: 'datetime', readOnly: true}),
    defineField({name: 'instructionId', title: 'Knowledge Base instruction', type: 'string', readOnly: true}),
    defineField({
      name: 'affects',
      type: 'array',
      of: [defineArrayMember({type: 'reference', to: [{type: 'zone'}, {type: 'jurisdiction'}, {type: 'instrument'}]})],
    }),
  ],
  preview: {
    select: {title: 'question', claimKey: 'claimKey', status: 'status'},
    prepare: ({title, claimKey, status}) => ({title: title ?? claimKey, subtitle: status}),
  },
})
