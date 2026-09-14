import { argon2id, argon2Verify } from 'hash-wasm'

/**
 * argon2id via WASM rather than a native binding.
 *
 * Deliberate: the deployment target is a free tier, and native builds are the
 * first thing to break there. WASM runs the same everywhere, at the cost of
 * being somewhat slower — which for a login endpoint nobody but the owner hits
 * is not a cost worth optimising.
 *
 * Parameters follow OWASP's argon2id guidance: 19 MiB, 2 passes, 1 lane.
 */
const PARAMS = { parallelism: 1, iterations: 2, memorySize: 19_456, hashLength: 32 }

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  return argon2id({ password, salt, ...PARAMS, outputType: 'encoded' })
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return argon2Verify({ password, hash })
}

/** Opaque session id — 32 random bytes, base64url. Never a JWT. */
export function newToken(bytes = 32): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes))
  return Buffer.from(buf).toString('base64url')
}

/**
 * Constant-time string compare for the CSRF double-submit check, so the
 * comparison itself cannot be used as an oracle.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
