import { desc, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import { schema } from '../db/index.js'
import type { Look, NETWORKS } from '../db/schema.js'
import { carLabel, modelOf } from '../catalog.js'
import { AppError, badRequest, newId, notFound, todayLocal } from '../lib.js'
import { audit, type Actor, type Ctx } from './context.js'
import type { postUpdate } from './inputs.js'
import { mediaUrl } from './content.js'

type Shape<T extends z.ZodRawShape> = z.infer<z.ZodObject<T>>
type Post = typeof schema.posts.$inferSelect
type Network = (typeof NETWORKS)[number]

/* ---------------- caption generation ---------------- */

const LEATHER = {
  ka: { black: 'შავი', graphite: 'გრაფიტისფერი', cognac: 'კონიაკისფერი', oxblood: 'ბორდოსფერი', navy: 'მუქი ლურჯი', cream: 'კრემისფერი' },
  ru: { black: 'чёрная', graphite: 'графитовая', cognac: 'коньячная', oxblood: 'бордовая', navy: 'тёмно-синяя', cream: 'кремовая' },
  en: { black: 'black', graphite: 'graphite', cognac: 'cognac', oxblood: 'oxblood', navy: 'midnight blue', cream: 'cream' },
} as const
const FINISH = { ka: { nappa: 'ნაპა', alcantara: 'ალკანტარა', perforated: 'პერფორირებული ტყავი' }, ru: { nappa: 'наппа', alcantara: 'алькантара', perforated: 'перфорированная кожа' }, en: { nappa: 'nappa', alcantara: 'alcantara', perforated: 'perforated leather' } } as const
const THREAD = { ka: { yellow: 'ყვითელი', red: 'წითელი', white: 'თეთრი', blue: 'ლურჯი', tonal: 'ტყავის ფერის' }, ru: { yellow: 'жёлтой', red: 'красной', white: 'белой', blue: 'синей', tonal: 'тон-в-тон' }, en: { yellow: 'yellow', red: 'red', white: 'white', blue: 'blue', tonal: 'tonal' } } as const
const pick = <T extends Record<string, string>>(m: T, k: string) => (m as Record<string, string>)[k] ?? k

export function orderCaptions(car: string, look: Look | null) {
  const l = look
  const en = l ? `${pick(LEATHER.en, l.leather)} ${pick(FINISH.en, l.finish)} with ${pick(THREAD.en, l.thread)} ${l.seam} stitching` : 'new nappa leather'
  const ka = l ? `${pick(LEATHER.ka, l.leather)} ${pick(FINISH.ka, l.finish)}, ${pick(THREAD.ka, l.thread)} ${l.seam === 'double' ? 'ორმაგი' : 'ერთმაგი'} ნაკერი` : 'ახალი ნაპა ტყავი'
  const ru = l ? `${pick(LEATHER.ru, l.leather)} ${pick(FINISH.ru, l.finish)}, ${l.seam === 'double' ? 'двойная' : 'одинарная'} строчка ${pick(THREAD.ru, l.thread)} нитью` : 'новая кожа наппа'
  return {
    ka: `${car} — ტორპედო გადაკრულია: ${ka}. ხელით ნაკერი, თბილისში. 📍 ჩაწერა: 558 65 72 97`,
    en: `${car} — dashboard re-trimmed in ${en}. Hand-sewn in Tbilisi. Book: +995 558 65 72 97`,
    ru: `${car} — торпеда перетянута: ${ru}. Ручная работа, Тбилиси. Запись: +995 558 65 72 97`,
  }
}
const tagsFor = (brand: string) => `#ტორპედოსგადაკვრა #autointeriore #tbilisi #${brand.replace(/[^a-z]/gi, '').toLowerCase()} #carinterior #leatherdashboard #перетяжкаторпедо`

/** Next free evening slot (19:30) a few days out, Tbilisi time. */
function nextSlot(existing: string[], startInDays = 1) {
  for (let d = startInDays; d < 60; d++) {
    const iso = `${todayLocal('Asia/Tbilisi', d)}T19:30`
    if (!existing.includes(iso)) return iso
  }
  return `${todayLocal('Asia/Tbilisi', startInDays)}T19:30`
}

/* ---------------- posts ---------------- */

export async function listPosts(ctx: Ctx, status?: Post['status']) {
  const rows = await ctx.db.select().from(schema.posts).where(status ? eq(schema.posts.status, status) : undefined).orderBy(desc(schema.posts.publishAt))
  return rows.map((p) => ({ ...p, image: mediaUrl(ctx, p.mediaId) }))
}

/** Creates drafts for every ready/delivered job and every gallery item that has no post yet. */
export async function generateDrafts(ctx: Ctx, actor: Actor) {
  const existing = await ctx.db.select({ refId: schema.posts.refId, publishAt: schema.posts.publishAt }).from(schema.posts)
  const done = new Set(existing.map((p) => p.refId))
  const slots = existing.map((p) => p.publishAt)
  const jobs = await ctx.db.select().from(schema.orders).where(inArray(schema.orders.status, ['ready', 'delivered']))
  const gallery = await ctx.db.select().from(schema.galleryItems).where(eq(schema.galleryItems.published, true))
  const created: Post[] = []
  for (const o of jobs.filter((j) => !done.has(j.id))) {
    const publishAt = nextSlot(slots, 1); slots.push(publishAt)
    const [row] = await ctx.db.insert(schema.posts).values({
      id: newId('POST'), source: 'order', refId: o.id, mediaId: o.photoIds[0] ?? null,
      captions: orderCaptions(carLabel(o.carModel), o.look), hashtags: tagsFor(modelOf(o.carModel)?.brand.name ?? ''),
      networks: ['instagram', 'facebook', 'tiktok', 'threads', 'gmb'], publishAt,
    }).returning()
    created.push(row)
  }
  for (const g of gallery.filter((x) => !done.has(x.id))) {
    const publishAt = nextSlot(slots, 1); slots.push(publishAt)
    const [row] = await ctx.db.insert(schema.posts).values({
      id: newId('POST'), source: 'gallery', refId: g.id, mediaId: g.mediaId,
      captions: { en: `${g.title.en} — ${g.caption.en}. Auto Interiore, Tbilisi.`, ka: `${g.title.ka} — ${g.caption.ka}. Auto Interiore, თბილისი.`, ru: `${g.title.ru} — ${g.caption.ru}. Auto Interiore, Тбилиси.` },
      hashtags: tagsFor(g.brand), networks: ['instagram', 'facebook', 'threads'], publishAt,
    }).returning()
    created.push(row)
  }
  if (created.length) await audit(ctx, actor, 'post.generate', undefined, { count: created.length })
  return created.map((p) => ({ ...p, image: mediaUrl(ctx, p.mediaId) }))
}

async function getPost(ctx: Ctx, id: string) {
  const [p] = await ctx.db.select().from(schema.posts).where(eq(schema.posts.id, id))
  if (!p) throw notFound(`Post ${id}`)
  return p
}

export async function updatePost(ctx: Ctx, actor: Actor, input: Shape<typeof postUpdate>) {
  const p = await getPost(ctx, input.id)
  if (p.status === 'scheduled') throw badRequest('This post is already scheduled in Metricool; change it there')
  const [row] = await ctx.db.update(schema.posts).set({
    captions: input.captions ? { en: input.captions.en, ka: input.captions.ka ?? p.captions.ka, ru: input.captions.ru ?? p.captions.ru } : p.captions,
    hashtags: input.hashtags ?? p.hashtags, networks: input.networks ?? p.networks, publishAt: input.publishAt ?? p.publishAt,
    status: 'draft', updatedAt: new Date(), // any edit needs a fresh approval
  }).where(eq(schema.posts.id, input.id)).returning()
  await audit(ctx, actor, 'post.update', input.id)
  return row
}

export async function approvePost(ctx: Ctx, actor: Actor, id: string) {
  const p = await getPost(ctx, id)
  if (p.status !== 'draft') throw badRequest(`Post is ${p.status}, not a draft`)
  const [row] = await ctx.db.update(schema.posts).set({ status: 'approved', updatedAt: new Date() }).where(eq(schema.posts.id, id)).returning()
  await audit(ctx, actor, 'post.approve', id)
  return row
}

export async function deletePost(ctx: Ctx, actor: Actor, id: string) {
  const p = await getPost(ctx, id)
  if (p.status === 'scheduled') throw badRequest('Scheduled posts must be removed in Metricool')
  await ctx.db.delete(schema.posts).where(eq(schema.posts.id, id))
  await audit(ctx, actor, 'post.delete', id)
  return { deleted: id }
}

/** The `info` object Metricool's scheduler expects (same shape as their createScheduledPost). */
export function metricoolInfo(ctx: Ctx, p: Post, lang: 'ka' | 'en' | 'ru') {
  const [d, t] = p.publishAt.split('T')
  const data: Record<string, unknown> = {}
  const nets = p.networks as Network[]
  if (nets.includes('instagram')) data.instagramData = { type: 'POST' }
  if (nets.includes('facebook')) data.facebookData = { type: 'POST' }
  if (nets.includes('tiktok')) data.tiktokData = { privacyOption: 'PUBLIC_TO_EVERYONE' }
  if (nets.includes('threads')) data.threadsData = {}
  if (nets.includes('gmb')) data.gmbData = { type: 'publication' }
  if (nets.includes('youtube')) data.youtubeData = { type: 'short', title: p.captions.en.slice(0, 90), madeForKids: false }
  return {
    autoPublish: true, draft: false,
    text: `${p.captions[lang]}\n\n${p.hashtags}`,
    firstCommentText: lang === 'en' ? '' : p.captions.en,
    media: p.mediaId ? [mediaUrl(ctx, p.mediaId, 1600)] : [],
    providers: nets.map((network) => ({ network })),
    publicationDate: { dateTime: `${d}T${t}:00`, timezone: ctx.config.timezone },
    ...data,
  }
}

/** Hands an approved post to Metricool. Without credentials it returns the request instead of sending it. */
export async function schedulePost(ctx: Ctx, actor: Actor, id: string, lang: 'ka' | 'en' | 'ru') {
  const p = await getPost(ctx, id)
  if (p.status !== 'approved') throw badRequest('Approve the post before scheduling it')
  if (p.networks.includes('instagram') && !p.mediaId) throw badRequest('Instagram needs an image')
  if (p.networks.includes('youtube')) throw badRequest('YouTube Shorts needs a video; remove YouTube or attach a reel first')
  if (`${p.publishAt}` <= `${todayLocal(ctx.config.timezone)}T00:00`) throw badRequest('The publish date is in the past')
  const info = metricoolInfo(ctx, p, lang)
  const { token, userId, blogId } = ctx.config.metricool
  if (!token || !userId || !blogId) {
    return { scheduled: false, reason: 'Metricool is not connected on the server (METRICOOL_TOKEN, METRICOOL_USER_ID, METRICOOL_BLOG_ID).', request: info }
  }
  const url = `https://app.metricool.com/api/v2/scheduler/posts?userId=${encodeURIComponent(userId)}&blogId=${encodeURIComponent(blogId)}`
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Mc-Auth': token }, body: JSON.stringify(info), signal: AbortSignal.timeout(20_000) })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    await ctx.db.update(schema.posts).set({ status: 'failed', updatedAt: new Date() }).where(eq(schema.posts.id, id))
    throw new AppError(502, `Metricool refused the post (HTTP ${res.status})`, 'metricool_error')
  }
  const externalId = String((body as { data?: { id?: unknown } }).data?.id ?? (body as { id?: unknown }).id ?? '')
  const [row] = await ctx.db.update(schema.posts).set({ status: 'scheduled', externalId, updatedAt: new Date() }).where(eq(schema.posts.id, id)).returning()
  await audit(ctx, actor, 'post.schedule', id, { externalId })
  return { scheduled: true, post: row }
}
