import { serve } from '@hono/node-server'
import { createApp } from './app.js'
import { db } from './db/client.js'

const port = Number(process.env.PORT ?? 8787)
serve({ fetch: createApp(db).fetch, port })
console.log(`API listening on :${port}`)
