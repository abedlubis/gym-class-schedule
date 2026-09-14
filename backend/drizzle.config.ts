import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  // Drizzle Kit always uses the direct connection. Generating or pushing a
  // migration through a transaction-mode pooler errors out.
  dbCredentials: {
    url:
      process.env.DIRECT_URL ??
      process.env.DATABASE_URL ??
      'postgres://localhost:5432/af_schedule',
  },
  strict: true,
  verbose: true,
})
