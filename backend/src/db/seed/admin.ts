import { createAdmin } from '../../services/auth.js'

process.env.DB_DIRECT = '1'
const { db, close } = await import('../client.js')

/**
 * Creates the first admin from environment variables. There is no self-signup
 * anywhere in the system; further admins are made through the admin UI.
 */
const email = process.env.ADMIN_SEED_EMAIL
const password = process.env.ADMIN_SEED_PASSWORD

if (!email || !password) {
  console.error('Set ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD, then re-run.')
  process.exit(1)
}
if (password.length < 12) {
  console.error('Use a password of at least 12 characters.')
  process.exit(1)
}

const row = await createAdmin(db, { email, password })
console.log(`Created admin ${row?.email}. Change this password after first sign-in.`)
await close()
