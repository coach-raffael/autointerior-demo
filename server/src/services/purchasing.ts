import { asc, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { schema } from '../db/index.js'
import { AppError, badRequest, newId, notFound } from '../lib.js'
import { audit, type Actor, type Ctx } from './context.js'
import type { contactUpsert, poCreate, poUpdate } from './inputs.js'

type Shape<T extends z.ZodRawShape> = z.infer<z.ZodObject<T>>
type PO = typeof schema.purchaseOrders.$inferSelect

/* ---------------- contacts ---------------- */

export async function listContacts(ctx: Ctx, kind?: 'supplier' | 'dealer' | 'partner') {
  return ctx.db.select().from(schema.contacts).where(kind ? eq(schema.contacts.kind, kind) : undefined).orderBy(asc(schema.contacts.name))
}

export async function upsertContact(ctx: Ctx, actor: Actor, input: Shape<typeof contactUpsert>) {
  const { id, ...data } = input
  if (id) {
    const [row] = await ctx.db.update(schema.contacts).set(data).where(eq(schema.contacts.id, id)).returning()
    if (!row) throw notFound('Contact')
    await audit(ctx, actor, 'contact.update', id, { name: row.name })
    return row
  }
  const newIdValue = newId(data.kind === 'supplier' ? 'S' : data.kind === 'dealer' ? 'D' : 'P', 5)
  const [row] = await ctx.db.insert(schema.contacts).values({ id: newIdValue, ...data }).returning()
  await audit(ctx, actor, 'contact.create', row.id, { name: row.name })
  return row
}

export async function deleteContact(ctx: Ctx, actor: Actor, id: string) {
  const used = await ctx.db.select({ id: schema.purchaseOrders.id }).from(schema.purchaseOrders).where(eq(schema.purchaseOrders.contactId, id)).limit(1)
  if (used.length) throw badRequest('This contact has purchase orders; keep it for the record')
  const [row] = await ctx.db.delete(schema.contacts).where(eq(schema.contacts.id, id)).returning()
  if (!row) throw notFound('Contact')
  await audit(ctx, actor, 'contact.delete', id, { name: row.name })
  return { deleted: id }
}

/* ---------------- purchase orders ---------------- */

export const poTotal = (p: Pick<PO, 'items'>) => Math.round(p.items.reduce((s, i) => s + i.qty * i.price, 0))

export async function listPurchaseOrders(ctx: Ctx, status?: PO['status']) {
  const rows = await ctx.db.select().from(schema.purchaseOrders).where(status ? eq(schema.purchaseOrders.status, status) : undefined).orderBy(desc(schema.purchaseOrders.createdAt))
  return rows.map((p) => ({ ...p, total: poTotal(p) }))
}

async function getPo(ctx: Ctx, id: string) {
  const [po] = await ctx.db.select().from(schema.purchaseOrders).where(eq(schema.purchaseOrders.id, id))
  if (!po) throw notFound(`Purchase order ${id}`)
  return po
}

export async function createPurchaseOrder(ctx: Ctx, actor: Actor, input: Shape<typeof poCreate>) {
  const [c] = await ctx.db.select().from(schema.contacts).where(eq(schema.contacts.id, input.contactId))
  if (!c) throw notFound('Supplier')
  if (c.kind === 'partner') throw badRequest('Partners do not supply goods; pick a supplier or dealer')
  const id = newId('PO', 5)
  const [row] = await ctx.db.insert(schema.purchaseOrders).values({ id, contactId: c.id, items: input.items, orderRef: input.orderRef ?? null, note: input.note ?? null }).returning()
  await audit(ctx, actor, 'po.create', id, { supplier: c.name, total: poTotal(row) })
  return { ...row, total: poTotal(row) }
}

export async function updatePurchaseOrder(ctx: Ctx, actor: Actor, input: Shape<typeof poUpdate>) {
  const po = await getPo(ctx, input.id)
  if (po.status !== 'draft') throw badRequest('Only drafts can be changed; this order was already sent')
  const [row] = await ctx.db.update(schema.purchaseOrders).set({
    items: input.items ?? po.items,
    orderRef: input.orderRef === undefined ? po.orderRef : input.orderRef,
    note: input.note === undefined ? po.note : input.note,
    updatedAt: new Date(),
  }).where(eq(schema.purchaseOrders.id, input.id)).returning()
  await audit(ctx, actor, 'po.update', input.id)
  return { ...row, total: poTotal(row) }
}

export function poMessage(po: PO, contact: typeof schema.contacts.$inferSelect) {
  return [
    `Hello ${contact.person || contact.name},`,
    `please send the following (our ref. ${po.id}${po.orderRef ? ' / ' + po.orderRef : ''}):`,
    ...po.items.map((i) => `• ${i.qty} ${i.unit} — ${i.name}`),
    ...(po.note ? ['', po.note] : []),
    '',
    'Delivery to: Auto Interiore, Tbilisi. Thank you!',
  ].join('\n')
}

/**
 * Sends a draft to the supplier.
 * email → via SMTP (SMTP_URL); whatsapp → returns a ready wa.me link, the human sends it.
 */
export async function sendPurchaseOrder(ctx: Ctx, actor: Actor, id: string, via: 'email' | 'whatsapp') {
  const po = await getPo(ctx, id)
  if (po.status !== 'draft') throw badRequest(`Purchase order ${id} is already ${po.status}`)
  const [contact] = await ctx.db.select().from(schema.contacts).where(eq(schema.contacts.id, po.contactId))
  const text = poMessage(po, contact)
  if (via === 'whatsapp') {
    const phone = contact.phone.replace(/\D/g, '')
    if (!phone) throw badRequest(`${contact.name} has no phone number`)
    return { sent: false, link: `https://wa.me/${phone}?text=${encodeURIComponent(text)}`, message: text, next: 'Open the link to send it, then call mark_purchase_order_sent.' }
  }
  if (!contact.email.includes('@')) throw badRequest(`${contact.name} has no email address`)
  if (!ctx.config.smtpUrl) throw new AppError(503, 'Email is not set up on the server (SMTP_URL). Send it on WhatsApp or by hand, then mark it as sent.', 'smtp_missing')
  const nodemailer = (await import('nodemailer')).default
  const transport = nodemailer.createTransport(ctx.config.smtpUrl)
  await transport.sendMail({ from: ctx.config.mailFrom, to: contact.email, subject: `Order ${po.id} — Auto Interiore`, text })
  const [row] = await ctx.db.update(schema.purchaseOrders).set({ status: 'sent', sentAt: new Date(), sentVia: 'email', updatedAt: new Date() }).where(eq(schema.purchaseOrders.id, id)).returning()
  await audit(ctx, actor, 'po.send', id, { via: 'email', to: contact.email })
  return { sent: true, order: { ...row, total: poTotal(row) } }
}

export async function markPurchaseOrder(ctx: Ctx, actor: Actor, id: string, status: 'sent' | 'received' | 'cancelled', via?: string) {
  const po = await getPo(ctx, id)
  const allowed: Record<string, string[]> = { sent: ['draft'], received: ['sent'], cancelled: ['draft', 'sent'] }
  if (!allowed[status].includes(po.status)) throw badRequest(`A ${po.status} order cannot become ${status}`)
  const [row] = await ctx.db.update(schema.purchaseOrders).set({
    status, updatedAt: new Date(), ...(status === 'sent' ? { sentAt: new Date(), sentVia: via ?? 'manual' } : {}),
  }).where(eq(schema.purchaseOrders.id, id)).returning()
  await audit(ctx, actor, `po.${status}`, id)
  return { ...row, total: poTotal(row) }
}

export async function deletePurchaseOrder(ctx: Ctx, actor: Actor, id: string) {
  const po = await getPo(ctx, id)
  if (po.status !== 'draft') throw badRequest('Only drafts can be deleted; cancel a sent order instead')
  await ctx.db.delete(schema.purchaseOrders).where(eq(schema.purchaseOrders.id, id))
  await audit(ctx, actor, 'po.delete', id)
  return { deleted: id }
}
