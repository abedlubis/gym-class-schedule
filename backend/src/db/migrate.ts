import { migrate } from 'drizzle-orm/node-postgres/migrator'

// Set before importing the client, and via a dynamic import so it actually
// happens first. Migrations need a session connection: Drizzle Kit errors
// through Neon's transaction-mode pooler.
process.env.DB_DIRECT = '1'
const { db, close } = await import('./client.js')

await migrate(db, { migrationsFolder: './drizzle' })
console.log('Migrations applied.')
await close()
