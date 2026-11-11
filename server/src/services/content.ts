import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { schema } from '../db/index.js'
import type { L10n } from '../db/schema.js'
import { badRequest, newId, notFound } from '../lib.js'
import { fetchImage } from '../storage.js'
import { audit, type Actor, type Ctx } from './context.js'
import type { galleryCreate, galleryUpdate, imageInput, partCreate, partUpdate } from './inputs.js'
import { l10n as l10nSchema } from './inputs.js'

type Shape<T extends z.ZodRawShape> = z.infer<z.ZodObject<T>>

export const fillL10n = (t: z.infer<typeof l10nSchema>): L10n => ({ en: t.en, ka: t.ka || t.en, ru: t.ru || t.en })
const mergeL10n = (old: L10n, t?: z.infer<typeof l10nSchema>): L10n => (t ? { en: t.en, ka: t.ka ?? old.ka, ru: t.ru ?? old.ru } : old)

/* ---------------- media ---------------- */

export async function saveImage(ctx: Ctx, actor: Actor, input: Partial<Shape<typeof imageInput>> & { buffer?: Buffer }, source = 'upload') {
  if (input.media_id) {
    const [m] = await ctx.db.select().from(schema.media).where(eq(schema.media.id, input.media_id))
    if (!m) throw notFound(`Image ${input.media_id}`)
    return { id: m.id, width: m.width, height: m.height, bytes: m.bytes, mime: m.mime }
  }
  let buf = input.buffer
  if (!buf && input.image_base64) {
    const b64 = input.image_base64.replace(/^data:[^;]+;base64,/, '')
    buf = Buffer.from(b64, 'base64')
    if (!buf.length) throw badRequest('image_base64 is empty or not base64')
  }
  if (!buf && input.image_url) { buf = await fetchImage(input.image_url); source = 'url' }
  if (!buf) throw badRequest('Send an image: media_id, image_url or image_base64')
  const id = newId('IMG')
  const info = await ctx.store.put(id, buf)
  await ctx.db.insert(schema.media).values({ id, ...info, alt: input.alt ?? '', source })
  await audit(ctx, actor, 'media.upload', id, { ...info, source })
  return { id, ...info }
}

export const mediaUrl = (ctx: Ctx, id: string | null | undefined, size = 800) => (id ? `${ctx.config.publicUrl}/media/${id}/${size}.webp` : null)

/* ---------------- gallery ---------------- */

export async function listGallery(ctx: Ctx, opts: { publishedOnly?: boolean } = {}) {
  const rows = await ctx.db.select().from(schema.galleryItems)
    .where(opts.publishedOnly ? eq(schema.galleryItems.published, true) : undefined)
    .orderBy(asc(schema.galleryItems.sort), desc(schema.galleryItems.createdAt))
  return rows.map((r) => ({ ...r, image: mediaUrl(ctx, r.mediaId), imageLarge: mediaUrl(ctx, r.mediaId, 1600) }))
}

export async function createGalleryItem(ctx: Ctx, actor: Actor, input: Shape<typeof galleryCreate> & { buffer?: Buffer }) {
  const img = await saveImage(ctx, actor, input)
  const [first] = await ctx.db.select({ sort: schema.galleryItems.sort }).from(schema.galleryItems).orderBy(asc(schema.galleryItems.sort)).limit(1)
  const id = newId('GAL')
  const [row] = await ctx.db.insert(schema.galleryItems).values({
    id, mediaId: img.id, brand: input.brand, title: fillL10n(input.title), caption: fillL10n(input.caption),
    focus: input.focus ?? '50% 50%', published: input.published ?? true, sort: (first?.sort ?? 0) - 1, // newest first
  }).returning()
  await audit(ctx, actor, 'gallery.create', id, { title: row.title.en })
  return { ...row, image: mediaUrl(ctx, row.mediaId) }
}

export async function updateGalleryItem(ctx: Ctx, actor: Actor, input: Shape<typeof galleryUpdate>) {
  const [old] = await ctx.db.select().from(schema.galleryItems).where(eq(schema.galleryItems.id, input.id))
  if (!old) throw notFound('Gallery item')
  const [row] = await ctx.db.update(schema.galleryItems).set({
    brand: input.brand ?? old.brand, title: mergeL10n(old.title, input.title), caption: mergeL10n(old.caption, input.caption),
    focus: input.focus ?? old.focus, published: input.published ?? old.published, sort: input.sort ?? old.sort, updatedAt: new Date(),
  }).where(eq(schema.galleryItems.id, input.id)).returning()
  await audit(ctx, actor, 'gallery.update', input.id, input)
  return row
}

export async function deleteGalleryItem(ctx: Ctx, actor: Actor, id: string) {
  const [row] = await ctx.db.delete(schema.galleryItems).where(eq(schema.galleryItems.id, id)).returning()
  if (!row) throw notFound('Gallery item')
  await audit(ctx, actor, 'gallery.delete', id, { title: row.title.en })
  return { deleted: id }
}

/* ---------------- parts ---------------- */

export async function listParts(ctx: Ctx, opts: { publishedOnly?: boolean; model?: string } = {}) {
  const conds = [opts.publishedOnly ? eq(schema.parts.published, true) : undefined, opts.model ? eq(schema.parts.model, opts.model) : undefined].filter(Boolean)
  const rows = await ctx.db.select().from(schema.parts).where(conds.length ? and(...conds) : undefined).orderBy(desc(schema.parts.updatedAt))
  return rows.map((r) => ({ ...r, image: mediaUrl(ctx, r.mediaId, 400) }))
}

export async function getParts(ctx: Ctx, ids: string[]) {
  if (!ids.length) return []
  return ctx.db.select().from(schema.parts).where(inArray(schema.parts.id, ids))
}

export async function createPart(ctx: Ctx, actor: Actor, input: Shape<typeof partCreate> & { buffer?: Buffer }) {
  const img = input.media_id || input.image_url || input.image_base64 || input.buffer ? await saveImage(ctx, actor, input) : null
  const id = newId('PT')
  const [row] = await ctx.db.insert(schema.parts).values({
    id, model: input.model, kind: input.kind, condition: input.condition, title: fillL10n(input.title),
    price: input.price, stock: input.stock, published: input.published ?? false, mediaId: img?.id ?? null,
  }).returning()
  await audit(ctx, actor, 'part.create', id, { title: row.title.en, price: row.price })
  return row
}

export async function updatePart(ctx: Ctx, actor: Actor, input: Shape<typeof partUpdate>) {
  const [old] = await ctx.db.select().from(schema.parts).where(eq(schema.parts.id, input.id))
  if (!old) throw notFound('Part')
  const [row] = await ctx.db.update(schema.parts).set({
    model: input.model ?? old.model, kind: input.kind ?? old.kind, condition: input.condition ?? old.condition,
    title: mergeL10n(old.title, input.title), price: input.price ?? old.price, stock: input.stock ?? old.stock,
    published: input.published ?? old.published, updatedAt: new Date(),
  }).where(eq(schema.parts.id, input.id)).returning()
  await audit(ctx, actor, 'part.update', input.id, input)
  return row
}

export async function deletePart(ctx: Ctx, actor: Actor, id: string) {
  const [row] = await ctx.db.delete(schema.parts).where(eq(schema.parts.id, id)).returning()
  if (!row) throw notFound('Part')
  await audit(ctx, actor, 'part.delete', id, { title: row.title.en })
  return { deleted: id }
}
