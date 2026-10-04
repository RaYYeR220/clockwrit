import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: process.env.SANITY_STUDIO_PROJECT_ID,
    dataset: process.env.SANITY_STUDIO_DATASET ?? 'production',
  },
  deployment: {appId: process.env.SANITY_STUDIO_APP_ID, autoUpdates: true},
  typegen: {path: '../web/src/**/*.{ts,tsx}', generates: '../web/src/sanity/types.ts'},
})
