import fs from 'node:fs'
import express, { type NextFunction, type Request, type Response } from 'express'
import cookieParser from 'cookie-parser'
import { desc, eq, max, sql } from 'drizzle-orm'
import { z, ZodError } from 'zod'
import { mcpAuthRouter, getOAuthProtectedResourceMetadataUrl } from '@modelcontextprotocol/sdk/server/auth/router.js'
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js'
import { schema } from './db/index.js'
import { AppError } from './lib.js'
import { SIZES, type Size } from './storage.js'
import type { Ctx } from './services/context.js'
import * as I from './services/inputs.js'
import * as content from './services/content.js'
import * as workshop from './services/workshop.js'
import * as purchasing from './services/purchasing.js'
import * as social from './services/social.js'
import { loadUser, login, logout, requireUser, sessionCookie, SESSION_COOKIE, userActor } from './auth.js'
import { WorkshopOAuthProvider, SCOPE } from './oauth/provider.js'
import { consentRouter } from './oauth/consent.js'
import { mcpHandler } from './mcp/server.js'
import { TOOL_MAP } from './mcp/registry.js'
import { decideApproval, listApprovals, policies, setPolicy } from './mcp/governance.js'

const parse = <T extends z.ZodRawShape>(shape: T, v: unknown) => z.object(shape).parse(v ?? {})
const PUBLIC = { kind: 'public', label: 'public' } as const

/** Tiny fixed-window limiter for the anonymous endpoints (single instance). */
function rateLimit(max: number, windowMs: number) {
  const hits = new Map<string, { n: number; reset: number }>()
  return (req: Request, _res: Response, next: NextFunction) => {
    const key = req.ip ?? 'unknown'
    const now = Date.now()
    const h = hits.get(key)
    if (!h || h.reset < now) { hits.set(key, { n: 1, reset: now + windowMs }); return next() }
    if (++h.n > max) return next(new AppError(429, 'Too many requests, please try again later', 'rate_limited'))
    next()
  }
}

export function createApp(ctx: Ctx) {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', 1)
  app.use(cookieParser())

  const provider = new WorkshopOAuthProvider(ctx)
  const mcpUrl = new URL(`${ctx.config.publicUrl}/mcp`)

  /* ---------------- health & media ---------------- */
  app.get('/health', (_req, res) => { res.json({ ok: true }) })
  app.get('/media/:id/:file', (req, res, next) => {
    const size = Number(String(req.params.file).replace('.webp', '')) as Size
    if (!SIZES.includes(size)) return next(new AppError(404, 'Not found'))
    const file = ctx.store.filePath(String(req.params.id), size)
    if (!fs.existsSync(file)) return next(new AppError(404, 'Not found'))
    res.set('Cache-Control', 'public, max-age=31536000, immutable').set('Access-Control-Allow-Origin', '*').type('image/webp').sendFile(file)
  })

  /* ---------------- OAuth 2.1 + MCP ---------------- */
  app.use(mcpAuthRouter({
    provider, issuerUrl: new URL(ctx.config.publicUrl), resourceServerUrl: mcpUrl, scopesSupported: [SCOPE],
    resourceName: 'Auto Interiore workshop',
  }))
  app.use(consentRouter(ctx, provider))
  const bearer = requireBearerAuth({ verifier: provider, requiredScopes: [], resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpUrl) })
  const sameResource = (req: Request, _res: Response, next: NextFunction) => {
    const r = req.auth?.resource
    if (r && r.href.replace(/\/$/, '') !== mcpUrl.href.replace(/\/$/, '')) return next(new AppError(401, 'Token was not issued for this server', 'invalid_token'))
    next()
  }
  app.post('/mcp', bearer, sameResource, express.json({ limit: '25mb' }), mcpHandler(ctx))
  app.all('/mcp', (_req, res) => { res.status(405).set('Allow', 'POST').json({ error: 'Use POST (stateless Streamable HTTP)' }) })

  /* ---------------- JSON API ---------------- */
  const api = express.Router()
  api.use((req, res, next) => {
    const origin = req.headers.origin
    if (origin && ctx.config.webOrigins.includes(origin)) {
      res.set({ 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', Vary: 'Origin',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE', 'Access-Control-Allow-Headers': 'Content-Type' })
    }
    if (req.method === 'OPTIONS') return res.sendStatus(204)
    next()
  })
  // mutating requests from a browser must come from our own web origin (CSRF guard for cookie auth)
  api.use((req, _res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
    const origin = req.headers.origin
    if (origin && !ctx.config.webOrigins.includes(origin) && origin !== ctx.config.publicUrl) return next(new AppError(403, 'Cross-site request blocked', 'csrf'))
    next()
  })
  api.use(loadUser(ctx))
  const json = express.json({ limit: '1mb' })
  const rawImage = express.raw({ type: ['image/*', 'application/octet-stream'], limit: '16mb' })

  /* auth */
  api.post('/auth/login', rateLimit(20, 15 * 60_000), json, async (req, res) => {
    const { email, password } = parse({ email: z.string().email(), password: z.string().min(1) }, req.body)
    const s = await login(ctx, email, password)
    res.cookie(SESSION_COOKIE, s.token, sessionCookie(ctx)).json({ user: s.user })
  })
  api.post('/auth/logout', async (req, res) => {
    await logout(ctx, req.cookies?.[SESSION_COOKIE])
    res.clearCookie(SESSION_COOKIE, { path: '/' }).json({ ok: true })
  })
  api.get('/auth/me', (req, res) => { res.json({ user: req.user ?? null }) })

  /* public website */
  api.get('/public/gallery', async (_req, res) => { res.json(await content.listGallery(ctx, { publishedOnly: true })) })
  api.get('/public/parts', async (_req, res) => { res.json(await content.listParts(ctx, { publishedOnly: true })) })
  api.get('/public/blocked-days', async (_req, res) => { res.json(await workshop.blockedDays(ctx)) })
  api.post('/public/photos', rateLimit(30, 60 * 60_000), rawImage, async (req, res) => {
    if (!Buffer.isBuffer(req.body) || !req.body.length) throw new AppError(400, 'Send the image as the request body')
    const m = await content.saveImage(ctx, PUBLIC, { buffer: req.body }, 'customer')
    res.status(201).json({ id: m.id, url: content.mediaUrl(ctx, m.id, 400) })
  })
  api.post('/public/orders', rateLimit(10, 60 * 60_000), json, async (req, res) => {
    const o = await workshop.createOrder(ctx, PUBLIC, parse(I.orderCreate, req.body))
    res.status(201).json({ id: o.id })
  })

  /* admin (signed in) */
  const admin = express.Router()
  admin.use(requireUser)
  const A = userActor
  admin.get('/overview', async (req, res) => { res.json(await TOOL_MAP.get('get_overview')!.run(ctx, A(req), {})) })
  admin.post('/media', rawImage, async (req, res) => {
    if (!Buffer.isBuffer(req.body) || !req.body.length) throw new AppError(400, 'Send the image as the request body')
    const m = await content.saveImage(ctx, A(req), { buffer: req.body, alt: String(req.query.alt ?? '') })
    res.status(201).json({ id: m.id, url: content.mediaUrl(ctx, m.id) })
  })

  admin.get('/gallery', async (_req, res) => { res.json(await content.listGallery(ctx)) })
  admin.post('/gallery', json, async (req, res) => { res.status(201).json(await content.createGalleryItem(ctx, A(req), parse(I.galleryCreate, req.body))) })
  admin.patch('/gallery/:id', json, async (req, res) => { res.json(await content.updateGalleryItem(ctx, A(req), parse(I.galleryUpdate, { ...req.body, id: req.params.id }))) })
  admin.delete('/gallery/:id', async (req, res) => { res.json(await content.deleteGalleryItem(ctx, A(req), String(req.params.id))) })

  admin.get('/parts', async (_req, res) => { res.json(await content.listParts(ctx)) })
  admin.post('/parts', json, async (req, res) => { res.status(201).json(await content.createPart(ctx, A(req), parse(I.partCreate, req.body))) })
  admin.patch('/parts/:id', json, async (req, res) => { res.json(await content.updatePart(ctx, A(req), parse(I.partUpdate, { ...req.body, id: req.params.id }))) })
  admin.delete('/parts/:id', async (req, res) => { res.json(await content.deletePart(ctx, A(req), String(req.params.id))) })

  admin.get('/orders', async (req, res) => { res.json(await workshop.listOrders(ctx, parse(I.orderFilter, { ...req.query, limit: req.query.limit ? Number(req.query.limit) : undefined }))) })
  admin.get('/orders/:id', async (req, res) => { res.json(await workshop.getOrder(ctx, String(req.params.id))) })
  admin.post('/orders', json, async (req, res) => { res.status(201).json(await workshop.createOrder(ctx, A(req), parse(I.orderCreate, req.body))) })
  admin.patch('/orders/:id/status', json, async (req, res) => { const b = parse(I.orderStatus, { ...req.body, id: req.params.id }); res.json(await workshop.setOrderStatus(ctx, A(req), b.id, b.status)) })
  admin.patch('/orders/:id/note', json, async (req, res) => { const b = parse(I.orderNote, { ...req.body, id: req.params.id }); res.json(await workshop.setOrderNote(ctx, A(req), b.id, b.note)) })
  admin.post('/orders/:id/quote', json, async (req, res) => { res.json(await workshop.saveQuote(ctx, A(req), String(req.params.id), parse(I.quoteCalc, req.body))) })
  admin.post('/orders/:id/book', json, async (req, res) => { res.json(await workshop.bookOrderIn(ctx, A(req), parse(I.bookOrder, { ...req.body, orderId: req.params.id }))) })
  admin.post('/quote/calculate', json, (req, res) => { res.json(workshop.calculateQuote(parse(I.quoteCalc, req.body))) })

  admin.get('/events', async (req, res) => { res.json(await workshop.listEvents(ctx, parse(I.eventRange, req.query))) })
  admin.post('/events', json, async (req, res) => { res.status(201).json(await workshop.createEvent(ctx, A(req), parse(I.eventCreate, req.body))) })
  admin.delete('/events/:id', async (req, res) => { res.json(await workshop.deleteEvent(ctx, A(req), String(req.params.id))) })

  admin.get('/contacts', async (_req, res) => { res.json(await purchasing.listContacts(ctx)) })
  admin.post('/contacts', json, async (req, res) => { res.json(await purchasing.upsertContact(ctx, A(req), parse(I.contactUpsert, req.body))) })
  admin.delete('/contacts/:id', async (req, res) => { res.json(await purchasing.deleteContact(ctx, A(req), String(req.params.id))) })

  admin.get('/purchase-orders', async (_req, res) => { res.json(await purchasing.listPurchaseOrders(ctx)) })
  admin.post('/purchase-orders', json, async (req, res) => { res.status(201).json(await purchasing.createPurchaseOrder(ctx, A(req), parse(I.poCreate, req.body))) })
  admin.patch('/purchase-orders/:id', json, async (req, res) => { res.json(await purchasing.updatePurchaseOrder(ctx, A(req), parse(I.poUpdate, { ...req.body, id: req.params.id }))) })
  admin.post('/purchase-orders/:id/send', json, async (req, res) => { const b = parse(I.poSend, { ...req.body, id: req.params.id }); res.json(await purchasing.sendPurchaseOrder(ctx, A(req), b.id, b.via)) })
  admin.post('/purchase-orders/:id/mark', json, async (req, res) => {
    const b = parse({ status: z.enum(['sent', 'received', 'cancelled']), via: z.string().optional() }, req.body)
    res.json(await purchasing.markPurchaseOrder(ctx, A(req), String(req.params.id), b.status, b.via))
  })
  admin.delete('/purchase-orders/:id', async (req, res) => { res.json(await purchasing.deletePurchaseOrder(ctx, A(req), String(req.params.id))) })

  admin.get('/posts', async (_req, res) => { res.json(await social.listPosts(ctx)) })
  admin.post('/posts/generate', async (req, res) => { res.json(await social.generateDrafts(ctx, A(req))) })
  admin.patch('/posts/:id', json, async (req, res) => { res.json(await social.updatePost(ctx, A(req), parse(I.postUpdate, { ...req.body, id: req.params.id }))) })
  admin.post('/posts/:id/approve', async (req, res) => { res.json(await social.approvePost(ctx, A(req), String(req.params.id))) })
  admin.post('/posts/:id/schedule', json, async (req, res) => { const b = parse(I.postSchedule, { ...req.body, id: req.params.id }); res.json(await social.schedulePost(ctx, A(req), b.id, b.lang)) })
  admin.get('/posts/:id/metricool', async (req, res) => {
    const [p] = await ctx.db.select().from(schema.posts).where(eq(schema.posts.id, String(req.params.id)))
    if (!p) throw new AppError(404, 'Post not found')
    res.json(social.metricoolInfo(ctx, p, (req.query.lang as 'ka' | 'en' | 'ru') ?? 'ka'))
  })
  admin.delete('/posts/:id', async (req, res) => { res.json(await social.deletePost(ctx, A(req), String(req.params.id))) })

  /* AI access: approvals, policies, connected clients, audit */
  admin.get('/approvals', async (req, res) => { res.json(await listApprovals(ctx, req.query.status as never)) })
  admin.post('/approvals/:id/approve', async (req, res) => { res.json(await decideApproval(ctx, req.user!, String(req.params.id), true)) })
  admin.post('/approvals/:id/reject', async (req, res) => { res.json(await decideApproval(ctx, req.user!, String(req.params.id), false)) })
  admin.get('/mcp/policies', async (_req, res) => { res.json(await policies(ctx)) })
  admin.put('/mcp/policies/:tool', json, async (req, res) => {
    const { mode } = parse({ mode: z.enum(['ALLOW', 'APPROVAL', 'DENY']) }, req.body)
    res.json(await setPolicy(ctx, A(req), String(req.params.tool), mode))
  })
  admin.get('/mcp/clients', async (_req, res) => {
    const rows = await ctx.db.select({ clientId: schema.oauthClients.clientId, info: schema.oauthClients.info, createdAt: schema.oauthClients.createdAt,
      lastToken: max(schema.oauthTokens.createdAt), active: sql<number>`count(*) filter (where ${schema.oauthTokens.revoked} = false and ${schema.oauthTokens.expiresAt} > now())::int` })
      .from(schema.oauthClients).leftJoin(schema.oauthTokens, eq(schema.oauthTokens.clientId, schema.oauthClients.clientId))
      .groupBy(schema.oauthClients.clientId).orderBy(desc(schema.oauthClients.createdAt))
    res.json({ endpoint: mcpUrl.href, clients: rows.map((r) => ({ clientId: r.clientId, name: (r.info as { client_name?: string }).client_name ?? r.clientId, createdAt: r.createdAt, lastToken: r.lastToken, connected: r.active > 0 })) })
  })
  admin.delete('/mcp/clients/:id', async (req, res) => { await provider.disconnectClient(String(req.params.id)); res.json({ ok: true }) })
  admin.get('/audit', async (_req, res) => { res.json(await ctx.db.select().from(schema.auditLog).orderBy(desc(schema.auditLog.id)).limit(200)) })

  api.use('/admin', admin)
  app.use('/api', api)

  /* ---------------- errors ---------------- */
  app.use((_req: Request, _res: Response, next: NextFunction) => next(new AppError(404, 'Not found', 'not_found')))
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) return res.status(400).json({ error: 'invalid_input', message: 'Some fields are not valid', issues: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) })
    if (err instanceof AppError) return res.status(err.status).json({ error: err.code, message: err.message })
    const status = (err as { status?: number; type?: string }).status
    if (status === 413) return res.status(413).json({ error: 'too_large', message: 'The upload is too large' })
    if (status === 400 && (err as { type?: string }).type === 'entity.parse.failed') return res.status(400).json({ error: 'bad_json', message: 'The request body is not valid JSON' })
    console.error(err)
    res.status(500).json({ error: 'server_error', message: 'Something went wrong on the server' })
  })
  return { app, provider }
}
