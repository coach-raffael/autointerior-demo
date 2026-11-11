import crypto from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>

/** Short, readable, unguessable enough ids: PREFIX-7 chars of Crockford base32. */
export function newId(prefix: string, len = 7) {
  const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
  const bytes = crypto.randomBytes(len)
  let s = ''
  for (const b of bytes) s += alphabet[b % 32]
  return `${prefix}-${s}`
}

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url')
export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex')

export async function hashPassword(pw: string) {
  const salt = crypto.randomBytes(16)
  const key = await scrypt(pw, salt, 64)
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`
}
export async function verifyPassword(pw: string, stored: string) {
  const [alg, saltB64, keyB64] = stored.split('$')
  if (alg !== 'scrypt' || !saltB64 || !keyB64) return false
  const key = await scrypt(pw, Buffer.from(saltB64, 'base64'), 64)
  const expected = Buffer.from(keyB64, 'base64')
  return key.length === expected.length && crypto.timingSafeEqual(key, expected)
}

/** Error with an HTTP status and a message that is safe to show to the caller. */
export class AppError extends Error {
  constructor(public status: number, message: string, public code = 'error') { super(message) }
}
export const notFound = (what: string) => new AppError(404, `${what} not found`, 'not_found')
export const badRequest = (msg: string) => new AppError(400, msg, 'bad_request')

/** Today in the workshop's timezone as YYYY-MM-DD. */
export function todayLocal(tz = 'Asia/Tbilisi', offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}
