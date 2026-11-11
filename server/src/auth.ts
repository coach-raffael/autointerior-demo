import type { NextFunction, Request, Response } from 'express'
import { and, eq, gt } from 'drizzle-orm'
import { schema } from './db/index.js'
import { AppError, randomToken, sha256, verifyPassword } from './lib.js'
import type { Actor, Ctx } from './services/context.js'

export const SESSION_COOKIE = 'ai_session'
const SESSION_DAYS = 30

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express { interface Request { user?: { id: number; email: string; name: string; role: string } } }
}

export async function login(ctx: Ctx, email: string, password: string) {
  const [u] = await ctx.db.select().from(schema.users).where(eq(schema.users.email, email.toLowerCase().trim()))
  // same work whether or not the user exists, so timing does not reveal accounts
  const ok = await verifyPassword(password, u?.passwordHash ?? 'scrypt$AAAAAAAAAAAAAAAAAAAAAA==$' + 'A'.repeat(88))
  if (!u || !ok) throw new AppError(401, 'Email or password is wrong', 'invalid_login')
  const token = randomToken()
  await ctx.db.insert(schema.sessions).values({ tokenHash: sha256(token), userId: u.id, expiresAt: new Date(Date.now() + SESSION_DAYS * 86_400_000) })
  return { token, user: { id: u.id, email: u.email, name: u.name, role: u.role } }
}

export async function userFromSession(ctx: Ctx, token: string | undefined) {
  if (!token) return undefined
  const rows = await ctx.db.select({ id: schema.users.id, email: schema.users.email, name: schema.users.name, role: schema.users.role })
    .from(schema.sessions).innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.tokenHash, sha256(token)), gt(schema.sessions.expiresAt, new Date())))
  return rows[0]
}

export async function logout(ctx: Ctx, token: string | undefined) {
  if (token) await ctx.db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, sha256(token)))
}

export function sessionCookie(ctx: Ctx) {
  return { httpOnly: true, sameSite: 'lax' as const, secure: ctx.config.secureCookies, maxAge: SESSION_DAYS * 86_400_000, path: '/' }
}

/** Express middleware: attaches req.user from the session cookie. */
export const loadUser = (ctx: Ctx) => async (req: Request, _res: Response, next: NextFunction) => {
  try { req.user = await userFromSession(ctx, req.cookies?.[SESSION_COOKIE]) ; next() } catch (e) { next(e) }
}
export const requireUser = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) return next(new AppError(401, 'Please sign in', 'unauthorized'))
  next()
}
export const userActor = (req: Request): Actor => ({ kind: 'user', userId: req.user!.id, label: req.user!.email })
