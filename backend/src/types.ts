import type { PgDatabase } from 'drizzle-orm/pg-core'
import type { SessionUser } from './services/auth.js'

export type Env = {
  Variables: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db: PgDatabase<any, any, any>
    user: SessionUser
    sessionToken: string
  }
}
