import { and, asc, desc, eq, gte, ilike, lte, or } from 'drizzle-orm'
import { z } from 'zod'
import { schema } from '../db/index.js'
import { DEFAULT_RATE, JOB_TEMPLATES, MATERIALS, SERVICE_FROM, carLabel, quoteTotal } from '../catalog.js'
import { badRequest, newId, notFound, todayLocal } from '../lib.js'
import { audit, type Actor, type Ctx } from './context.js'
import type { bookOrder, eventCreate, eventRange, orderCreate, orderFilter, quoteCalc } from './inputs.js'
import { getParts, mediaUrl } from './content.js'

type Shape<T extends z.ZodRawShape> = z.infer<z.ZodObject<T>>
type OrderRow = typeof schema.orders.$inferSelect

export function presentOrder(ctx: Ctx, o: OrderRow) {
  return { ...o, car: carLabel(o.carModel), photos: o.photoIds.map((id) => mediaUrl(ctx, id)) }
}

/* ---------------- orders ---------------- */

export async function listOrders(ctx: Ctx, f: Partial<Shape<typeof orderFilter>> = {}) {
  const q = f.query?.trim()
  const conds = [
    f.status ? eq(schema.orders.status, f.status) : undefined,
    q ? or(ilike(schema.orders.customerName, `%${q}%`), ilike(schema.orders.customerPhone, `%${q}%`), ilike(schema.orders.id, `%${q}%`), ilike(schema.orders.carModel, `%${q}%`)) : undefined,
  ].filter(Boolean)
  const rows = await ctx.db.select().from(schema.orders).where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(schema.orders.createdAt)).limit(f.limit ?? 100)
  return rows.map((o) => presentOrder(ctx, o))
}

export async function getOrder(ctx: Ctx, id: string) {
  const [o] = await ctx.db.select().from(schema.orders).where(eq(schema.orders.id, id))
  if (!o) throw notFound(`Order ${id}`)
  const parts = await getParts(ctx, o.partIds)
  const events = await ctx.db.select().from(schema.events).where(eq(schema.events.orderId, id)).orderBy(asc(schema.events.date))
  return { ...presentOrder(ctx, o), parts, events, estimate: estimateFor(o.services, parts.map((p) => p.price)) }
}

export const estimateFor = (services: string[], partPrices: number[]) =>
  services.reduce((s, x) => s + (SERVICE_FROM[x as keyof typeof SERVICE_FROM] ?? 0), 0) + partPrices.reduce((a, b) => a + b, 0)

/** A booking from the website (or created by staff on the phone). */
export async function createOrder(ctx: Ctx, actor: Actor, input: Shape<typeof orderCreate>) {
  if (input.wantedDate) {
    if (input.wantedDate < todayLocal(ctx.config.timezone)) throw badRequest('The wanted date is in the past')
    if (await isBlocked(ctx, input.wantedDate)) throw badRequest('The workshop is full on that day')
  }
  const parts = await getParts(ctx, input.partIds)
  const unavailable = parts.filter((p) => !p.published || p.stock < 1)
  if (unavailable.length || parts.length !== input.partIds.length) throw badRequest('One of the chosen parts is no longer available')
  const services = parts.length && !input.services.includes('part') ? [...input.services, 'part' as const] : input.services
  const id = newId('AI', 5)
  const [row] = await ctx.db.insert(schema.orders).values({ id, ...input, services, look: input.look ?? null, note: input.note ?? null, wantedDate: input.wantedDate ?? null }).returning()
  await audit(ctx, actor, 'order.create', id, { car: row.carModel, services })
  return presentOrder(ctx, row)
}

export async function setOrderStatus(ctx: Ctx, actor: Actor, id: string, status: OrderRow['status']) {
  const [row] = await ctx.db.update(schema.orders).set({ status, updatedAt: new Date() }).where(eq(schema.orders.id, id)).returning()
  if (!row) throw notFound(`Order ${id}`)
  await audit(ctx, actor, 'order.status', id, { status })
  return presentOrder(ctx, row)
}

export async function setOrderNote(ctx: Ctx, actor: Actor, id: string, note: string) {
  const [row] = await ctx.db.update(schema.orders).set({ note, updatedAt: new Date() }).where(eq(schema.orders.id, id)).returning()
  if (!row) throw notFound(`Order ${id}`)
  await audit(ctx, actor, 'order.note', id)
  return presentOrder(ctx, row)
}

/* ---------------- quotes ---------------- */

export function calculateQuote(input: Shape<typeof quoteCalc>) {
  const tpl = JOB_TEMPLATES[input.template ?? 'dashboard']
  const lines = input.lines ?? tpl.lines.map((l) => {
    const m = MATERIALS.find((x) => x.id === l.mat)!
    return { label: m.label, qty: l.qty, unit: m.unit, price: m.price }
  })
  const q = {
    lines: lines.map((l) => ({ ...l, unit: l.unit ?? 'pc' })),
    labourHours: input.labourHours ?? tpl.hours,
    rate: input.rate ?? DEFAULT_RATE,
    margin: input.margin ?? 25,
    vat: input.vat ?? true,
  }
  const materials = q.lines.reduce((s, l) => s + l.qty * l.price, 0)
  const labour = q.labourHours * q.rate
  const net = (materials + labour) * (1 + q.margin / 100)
  return { ...q, total: quoteTotal(q), breakdown: { materials: Math.round(materials), labour: Math.round(labour), margin: Math.round(net - materials - labour), vat: Math.round(q.vat ? net * 0.18 : 0) } }
}

export async function saveQuote(ctx: Ctx, actor: Actor, orderId: string, input: Shape<typeof quoteCalc>) {
  const [o] = await ctx.db.select().from(schema.orders).where(eq(schema.orders.id, orderId))
  if (!o) throw notFound(`Order ${orderId}`)
  const { breakdown, ...quote } = calculateQuote(input)
  const [row] = await ctx.db.update(schema.orders).set({ quote, status: o.status === 'new' ? 'quoted' : o.status, updatedAt: new Date() })
    .where(eq(schema.orders.id, orderId)).returning()
  await audit(ctx, actor, 'order.quote', orderId, { total: quote.total })
  return { order: presentOrder(ctx, row), quote, breakdown }
}

/* ---------------- calendar ---------------- */

export async function listEvents(ctx: Ctx, r: Partial<Shape<typeof eventRange>> = {}) {
  const from = r.from ?? todayLocal(ctx.config.timezone, -31)
  const to = r.to ?? todayLocal(ctx.config.timezone, 92)
  return ctx.db.select().from(schema.events).where(and(gte(schema.events.date, from), lte(schema.events.date, to))).orderBy(asc(schema.events.date), asc(schema.events.start))
}

export async function isBlocked(ctx: Ctx, date: string) {
  const rows = await ctx.db.select({ id: schema.events.id }).from(schema.events).where(and(eq(schema.events.date, date), eq(schema.events.kind, 'block'))).limit(1)
  return rows.length > 0
}

/** Days the website booking form must show as full (no times, no names: public). */
export async function blockedDays(ctx: Ctx) {
  const rows = await ctx.db.selectDistinct({ date: schema.events.date }).from(schema.events)
    .where(and(eq(schema.events.kind, 'block'), gte(schema.events.date, todayLocal(ctx.config.timezone))))
  return rows.map((r) => r.date)
}

export async function createEvent(ctx: Ctx, actor: Actor, input: Shape<typeof eventCreate>) {
  if (input.end <= input.start) throw badRequest('The end time must be after the start time')
  if (input.orderId) await getOrder(ctx, input.orderId)
  const id = newId('EV')
  const [row] = await ctx.db.insert(schema.events).values({ id, ...input, orderId: input.orderId ?? null }).returning()
  await audit(ctx, actor, 'event.create', id, { date: row.date, title: row.title })
  return row
}

export async function deleteEvent(ctx: Ctx, actor: Actor, id: string) {
  const [row] = await ctx.db.delete(schema.events).where(eq(schema.events.id, id)).returning()
  if (!row) throw notFound('Calendar entry')
  await audit(ctx, actor, 'event.delete', id, { date: row.date, title: row.title })
  return { deleted: id }
}

/** Puts the car's drop-off in the calendar and moves the order to "booked in". */
export async function bookOrderIn(ctx: Ctx, actor: Actor, input: Shape<typeof bookOrder>) {
  const o = await getOrder(ctx, input.orderId)
  if (await isBlocked(ctx, input.date)) throw badRequest(`The workshop is blocked on ${input.date}`)
  const [h, m] = input.start.split(':').map(Number)
  const endMin = h * 60 + m + input.durationMinutes
  const end = `${String(Math.min(23, Math.floor(endMin / 60))).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`
  const event = await createEvent(ctx, actor, { date: input.date, start: input.start, end, title: `${o.car} drop-off (${o.customerName})`, kind: 'appointment', orderId: o.id })
  const order = await setOrderStatus(ctx, actor, o.id, o.status === 'new' || o.status === 'quoted' ? 'scheduled' : o.status)
  await ctx.db.update(schema.orders).set({ wantedDate: input.date }).where(eq(schema.orders.id, o.id))
  return { order: { ...order, wantedDate: input.date }, event }
}
