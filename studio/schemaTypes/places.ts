import {EarthGlobeIcon, PinIcon} from '@sanity/icons'
import {defineField, defineType} from 'sanity'

export const jurisdiction = defineType({
  name: 'jurisdiction',
  title: 'Jurisdiction',
  type: 'document',
  icon: EarthGlobeIcon,
  fields: [
    defineField({
      name: 'code',
      type: 'string',
      description: 'ISO 3166-1 alpha-2, or ISO 3166-2 for a subdivision (e.g. "CA-BC").',
      validation: (r) => r.required().regex(/^[A-Z]{2}(-[A-Z0-9]{1,3})?$/),
    }),
    defineField({name: 'name', type: 'string', validation: (r) => r.required()}),
    defineField({name: 'parent', type: 'reference', to: [{type: 'jurisdiction'}]}),
    defineField({
      name: 'timeAuthority',
      title: 'Who sets the clock',
      type: 'text',
      rows: 2,
      description: 'Which body can legally change the time here (e.g. "Provincial legislature, but only in step with US Pacific states").',
    }),
  ],
  preview: {select: {title: 'name', subtitle: 'code'}},
})

export const zone = defineType({
  name: 'zone',
  title: 'Time zone',
  type: 'document',
  icon: PinIcon,
  fields: [
    defineField({
      name: 'ianaId',
      title: 'IANA identifier',
      type: 'string',
      validation: (r) => r.required().regex(/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)+$/),
    }),
    defineField({name: 'aliases', type: 'array', of: [{type: 'string'}], description: 'Backward-compatible links, e.g. "Canada/Pacific".'}),
    defineField({name: 'jurisdiction', type: 'reference', to: [{type: 'jurisdiction'}], validation: (r) => r.required()}),
    defineField({name: 'city', title: 'Representative city', type: 'string'}),
    defineField({name: 'location', type: 'geopoint'}),
  ],
  preview: {select: {title: 'ianaId', subtitle: 'city'}},
})
