import { createApp } from '../src/app.js'
import { db } from '../src/db/client.js'

/**
 * Vercel entry point.
 *
 * Vercel detects a default-exported Hono app and turns every route into a
 * Vercel Function on Fluid compute — no adapter and no config beyond the
 * rewrite in vercel.json. `src/server.ts` stays for local development, where a
 * long-running Node process is simpler to work against.
 */
export default createApp(db)
