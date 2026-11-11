import path from 'node:path'
import { config } from './config.js'
import { openDb } from './db/index.js'
import { MediaStore } from './storage.js'
import { createApp } from './app.js'
import { ensureAdmin, seedDemo } from './seed.js'
import type { Ctx } from './services/context.js'

const production = process.env.NODE_ENV === 'production'
if (production && !config.publicUrl.startsWith('https://')) {
  console.error('PUBLIC_URL must be https in production (it is the OAuth issuer for the MCP connector).')
  process.exit(1)
}

const { db, close } = await openDb({ databaseUrl: config.databaseUrl, pgliteDir: path.join(config.dataDir, 'pglite') })
const ctx: Ctx = { db, store: new MediaStore(config.mediaDir), config }

const seeded = config.seedDemo ? await seedDemo(ctx) : false
// a demo login only for demo data sets; production needs ADMIN_EMAIL / ADMIN_PASSWORD
const created = await ensureAdmin(ctx, config.seedDemo && !production ? { email: 'owner@autointeriore.demo', password: 'werkstatt-demo' } : undefined)

const { app } = createApp(ctx)
const server = app.listen(config.port, () => {
  console.log(`Auto Interiore API on ${config.publicUrl} (port ${config.port}, ${config.databaseUrl ? 'PostgreSQL' : 'PGlite'})`)
  if (seeded) console.log('Loaded the demo data set.')
  if (created) console.log(`Created owner account ${created}.`)
  console.log(`MCP endpoint: ${config.publicUrl}/mcp`)
})

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => { server.close(); close().finally(() => process.exit(0)) })
}
