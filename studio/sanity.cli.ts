import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID,
    dataset: process.env.SANITY_STUDIO_DATASET ?? 'production',
  },
  studioHost: 'clockwrit',
  deployment: {appId: 'utzcwhqf865cmpnluybcdn2t', autoUpdates: true},
  typegen: {path: '../web/src/**/*.{ts,tsx}', generates: '../web/src/sanity/types.ts'},
})
