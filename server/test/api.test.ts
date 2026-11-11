import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import sharp from 'sharp'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { openDb } from '../src/db/index.js'
import { MediaStore } from '../src/storage.js'
import { createApp } from '../src/app.js'
import { ensureAdmin, seedDemo } from '../src/seed.js'
import { config } from '../src/config.js'
import { todayLocal } from '../src/lib.js'
import type { Ctx } from '../src/services/context.js'

const OWNER = { email: 'owner@test.ge', password: 'correct horse battery' }
let ctx: Ctx
let app: ReturnType<typeof createApp>['app']
let close: () => Promise<void>
let tmp: string

beforeAll(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-test-'))
  const db = await openDb({ pgliteDir: ':memory:' })
  close = db.close
  ctx = { db: db.db, store: new MediaStore(tmp), config: { ...config, publicUrl: 'http://localhost:8787', webOrigins: ['http://localhost:5173'], adminUrl: 'http://localhost:5173/#/admin', smtpUrl: undefined, metricool: {} } as typeof config }
  await seedDemo(ctx)
  await ensureAdmin(ctx, OWNER)
  app = createApp(ctx).app
}, 60_000)
afterAll(async () => { await close(); fs.rmSync(tmp, { recursive: true, force: true }) })

const agent = () => request.agent(app)
async function signedIn() {
  const a = agent()
  await a.post('/api/auth/login').set('Origin', 'http://localhost:5173').send(OWNER).expect(200)
  return a
}
const png = () => sharp({ create: { width: 900, height: 600, channels: 3, background: '#7e4523' } }).png().toBuffer()

describe('public website', () => {
  it('serves the seeded gallery with working image URLs', async () => {
    const res = await request(app).get('/api/public/gallery').expect(200)
    expect(res.body.length).toBeGreaterThanOrEqual(10)
    const url = new URL(res.body[0].image)
    const img = await request(app).get(url.pathname).expect(200)
    expect(img.headers['content-type']).toBe('image/webp')
  })

  it('only lists published parts', async () => {
    const res = await request(app).get('/api/public/parts').expect(200)
    expect(res.body.every((p: { published: boolean }) => p.published)).toBe(true)
    expect(res.body.find((p: { id: string }) => p.id === 'PT-08')).toBeUndefined()
  })

  it('takes a booking, but not on a blocked day or with an unavailable part', async () => {
    const base = { customerName: 'Test', customerPhone: '+995 555 000 000', carModel: 'bmw-x5', services: ['dashboard'], lang: 'en' }
    const ok = await request(app).post('/api/public/orders').send({ ...base, wantedDate: todayLocal('Asia/Tbilisi', 3) }).expect(201)
    expect(ok.body.id).toMatch(/^AI-/)
    const blocked = await request(app).get('/api/public/blocked-days').expect(200)
    await request(app).post('/api/public/orders').send({ ...base, wantedDate: blocked.body[0] }).expect(400)
    await request(app).post('/api/public/orders').send({ ...base, partIds: ['PT-07'] }).expect(400) // out of stock
    await request(app).post('/api/public/orders').send({ ...base, carModel: 'nope' }).expect(400)
  })

  it('accepts a customer photo and strips it to webp', async () => {
    const res = await request(app).post('/api/public/photos').set('Content-Type', 'image/png').send(await png()).expect(201)
    expect(res.body.id).toMatch(/^IMG-/)
    await request(app).post('/api/public/photos').set('Content-Type', 'image/png').send(Buffer.from('not an image')).expect(400)
  })
})

describe('admin API', () => {
  it('requires a session', async () => {
    await request(app).get('/api/admin/orders').expect(401)
    await request(app).post('/api/auth/login').send({ ...OWNER, password: 'wrong' }).expect(401)
  })

  it('blocks cross-site writes', async () => {
    const a = await signedIn()
    await a.post('/api/admin/events').set('Origin', 'https://evil.example').send({}).expect(403)
  })

  it('quotes and books an order', async () => {
    const a = await signedIn()
    const q = await a.post('/api/admin/orders/AI-1041/quote').set('Origin', 'http://localhost:5173').send({ template: 'dashboard' }).expect(200)
    expect(q.body.quote.total).toBeGreaterThan(1000)
    expect(q.body.order.status).toBe('quoted')
    const date = todayLocal('Asia/Tbilisi', 10)
    const b = await a.post('/api/admin/orders/AI-1041/book').set('Origin', 'http://localhost:5173').send({ date, start: '11:00' }).expect(200)
    expect(b.body.order.status).toBe('scheduled')
    expect(b.body.event.end).toBe('12:00')
  })
})

/* ---------------- the connector flow claude.ai goes through ---------------- */

const b64url = (b: Buffer) => b.toString('base64url')
let accessToken = ''

async function connect() {
  const reg = await request(app).post('/register').send({ client_name: 'Claude', redirect_uris: ['https://claude.ai/api/mcp/auth_callback'], token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] }).expect(201)
  const clientId = reg.body.client_id
  const verifier = b64url(crypto.randomBytes(32))
  const challenge = b64url(crypto.createHash('sha256').update(verifier).digest())
  const auth = await request(app).get('/authorize').query({ client_id: clientId, response_type: 'code', redirect_uri: 'https://claude.ai/api/mcp/auth_callback', code_challenge: challenge, code_challenge_method: 'S256', state: 'xyz', resource: 'http://localhost:8787/mcp', scope: 'workshop' }).expect(302)
  const consentUrl = auth.headers.location as string
  expect(consentUrl).toMatch(/^\/oauth\/consent\?req=/)
  const page = await request(app).get(consentUrl).expect(200)
  expect(page.text).toContain('Claude')
  const csrf = /name="csrf" value="([^"]+)"/.exec(page.text)![1]
  const req = new URL(consentUrl, 'http://x').searchParams.get('req')!
  // wrong password stays on the page, no code
  const bad = await request(app).post('/oauth/consent').type('form').send({ req, csrf, email: OWNER.email, password: 'nope', decision: 'allow' }).expect(200)
  expect(bad.text).toContain('wrong')
  const ok = await request(app).post('/oauth/consent').type('form').send({ req, csrf, ...OWNER, decision: 'allow' }).expect(302)
  const cb = new URL(ok.headers.location)
  expect(cb.origin + cb.pathname).toBe('https://claude.ai/api/mcp/auth_callback')
  expect(cb.searchParams.get('state')).toBe('xyz')
  const code = cb.searchParams.get('code')!
  // wrong verifier fails, right one works, code is single-use
  await request(app).post('/token').type('form').send({ grant_type: 'authorization_code', client_id: clientId, code, code_verifier: 'x'.repeat(43), redirect_uri: 'https://claude.ai/api/mcp/auth_callback' }).expect(400)
  const tok = await request(app).post('/token').type('form').send({ grant_type: 'authorization_code', client_id: clientId, code, code_verifier: verifier, redirect_uri: 'https://claude.ai/api/mcp/auth_callback', resource: 'http://localhost:8787/mcp' }).expect(200)
  expect(tok.body.access_token).toBeTruthy()
  return { clientId, ...tok.body as { access_token: string; refresh_token: string } }
}

async function rpc(method: string, params: unknown = {}, token = accessToken) {
  const res = await request(app).post('/mcp').set('Authorization', `Bearer ${token}`).set('Accept', 'application/json, text/event-stream')
    .send({ jsonrpc: '2.0', id: Math.floor(Math.random() * 1e6), method, params })
  return res
}
async function call(name: string, args: Record<string, unknown> = {}) {
  const res = await rpc('tools/call', { name, arguments: args })
  expect(res.status).toBe(200)
  const result = res.body.result
  const text = result.content[0].text as string
  return { isError: !!result.isError, text, json: (() => { try { return JSON.parse(text) } catch { return undefined } })() }
}

describe('MCP connector', () => {
  it('advertises OAuth metadata and rejects calls without a token', async () => {
    const meta = await request(app).get('/.well-known/oauth-authorization-server').expect(200)
    expect(meta.body.registration_endpoint).toContain('/register')
    expect(meta.body.code_challenge_methods_supported).toContain('S256')
    const prm = await request(app).get('/.well-known/oauth-protected-resource/mcp').expect(200)
    expect(prm.body.resource).toBe('http://localhost:8787/mcp')
    const res = await request(app).post('/mcp').send({ jsonrpc: '2.0', id: 1, method: 'tools/list' }).expect(401)
    expect(res.headers['www-authenticate']).toContain('resource_metadata')
  })

  it('connects through register → authorize → consent → token', async () => {
    const t = await connect()
    accessToken = t.access_token
    const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } })
    expect(init.body.result.serverInfo.name).toBe('auto-interiore')
    const list = await rpc('tools/list')
    const names = list.body.result.tools.map((t: { name: string }) => t.name)
    expect(names).toEqual(expect.arrayContaining(['create_gallery_item', 'list_orders', 'save_quote', 'send_purchase_order', 'schedule_post', 'get_approval']))
    // refresh rotates
    const r = await request(app).post('/token').type('form').send({ grant_type: 'refresh_token', client_id: t.clientId, refresh_token: t.refresh_token }).expect(200)
    await request(app).post('/token').type('form').send({ grant_type: 'refresh_token', client_id: t.clientId, refresh_token: t.refresh_token }).expect(400)
    accessToken = r.body.access_token
  })

  it('runs ALLOW tools directly', async () => {
    const o = await call('list_orders', { status: 'new' })
    expect(o.json.length).toBeGreaterThan(0)
    const q = await call('calculate_quote', { template: 'wheel', vat: false })
    expect(q.json.total).toBeGreaterThan(0)
    const p = await call('create_part', { model: 'mb-w205', kind: 'wheel', condition: 'exchange', title: { en: 'AMG wheel, nappa' }, price: 520, stock: 1 })
    expect(p.json.published).toBe(false) // parts from AI start hidden
  })

  it('puts a gallery upload into the approval queue, then publishes it after approval', async () => {
    const image = (await png()).toString('base64')
    const r = await call('create_gallery_item', { image_base64: image, brand: 'mercedes', title: { en: 'Mercedes-Benz C-Class W205', ka: 'Mercedes-Benz C-კლასი W205' }, caption: { en: 'In the studio' } })
    expect(r.json.status).toBe('pending_approval')
    expect(r.json.link).toContain('/#/admin/approvals?id=')
    const before = await request(app).get('/api/public/gallery')
    expect(before.body.some((g: { title: { en: string } }) => g.title.en.includes('W205'))).toBe(false)

    const a = await signedIn()
    const list = await a.get('/api/admin/approvals?status=pending').expect(200)
    const item = list.body.find((x: { id: string }) => x.id === r.json.approval_id)
    expect(item.preview).toMatch(/\/media\/IMG-/) // image stored once, queue holds only a reference
    expect(JSON.stringify(item.args)).not.toContain(image.slice(0, 50))
    await a.post(`/api/admin/approvals/${item.id}/approve`).set('Origin', 'http://localhost:5173').expect(200)

    const after = await request(app).get('/api/public/gallery')
    expect(after.body[0].title.en).toBe('Mercedes-Benz C-Class W205')
    expect(after.body[0].caption.ka).toBe('In the studio') // missing language falls back to English
    const status = await call('get_approval', { id: r.json.approval_id })
    expect(status.json.status).toBe('approved')
  })

  it('refuses DENY tools and explains invalid input', async () => {
    const a = await signedIn()
    await a.put('/api/admin/mcp/policies/delete_post').set('Origin', 'http://localhost:5173').send({ mode: 'DENY' }).expect(200)
    const d = await call('delete_post', { id: 'POST-S1' })
    expect(d.isError).toBe(true)
    expect(d.text).toContain('switched off')
    const bad = await call('book_order', { orderId: 'AI-1040', date: 'tomorrow' })
    expect(bad.isError).toBe(true)
    expect(bad.text).toContain('YYYY-MM-DD')
  })

  it('stops working once the owner disconnects the client', async () => {
    const a = await signedIn()
    const clients = await a.get('/api/admin/mcp/clients').expect(200)
    for (const c of clients.body.clients) await a.delete(`/api/admin/mcp/clients/${c.clientId}`).set('Origin', 'http://localhost:5173').expect(200)
    const res = await rpc('tools/list')
    expect(res.status).toBe(401)
  })
})
