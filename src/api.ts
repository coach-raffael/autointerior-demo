/*
  Talks to the Auto Interiore backend (server/). Active when VITE_API_URL is set,
  e.g. "/api" behind the same domain or "http://localhost:8787/api" in development.
  Without it the app runs as the self-contained browser demo (localStorage).

  The mappers translate between the server's records and the shapes the
  components were written against, so the UI does not care where data lives.
*/
import type { CalEvent, Look, Network, Order, Part, Post, PurchaseOrder, Quote, Supplier } from './data'

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')
export const apiMode = !!API_URL

export class ApiError extends Error {
  status: number
  issues?: { path: string; message: string }[]
  constructor(status: number, message: string, issues?: { path: string; message: string }[]) { super(message); this.status = status; this.issues = issues }
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    ...rest,
    headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...rest.headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  })
  const body = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) {
    const issues = body?.issues as { path: string; message: string }[] | undefined
    const detail = issues?.length ? `: ${issues.map((i) => `${i.path} ${i.message}`).join(', ')}` : ''
    throw new ApiError(res.status, `${body?.message ?? `Request failed (${res.status})`}${detail}`, issues)
  }
  return body as T
}

/** Uploads an image file or data URL; returns the media id. */
export async function uploadImage(file: Blob, scope: 'public' | 'admin') {
  const r = await api<{ id: string; url: string }>(scope === 'public' ? '/public/photos' : '/admin/media', { method: 'POST', body: file, headers: { 'Content-Type': file.type || 'application/octet-stream' } })
  return r
}
export const dataUrlToBlob = async (dataUrl: string) => (await fetch(dataUrl)).blob()

/* ---------------- server record shapes ---------------- */

type L10n = { en: string; ka: string; ru: string }
export interface ServerOrder {
  id: string; status: Order['status'] | 'cancelled'; customerName: string; customerPhone: string; channel: Order['customer']['channel']
  carModel: string; carYear: string; services: string[]; look: Look | null; partIds: string[]; photos: string[]
  wantedDate: string | null; note: string | null; quote: Quote | null; createdAt: string
}
export interface ServerPart { id: string; model: string; kind: Part['kind']; condition: Part['condition']; title: L10n; price: number; stock: number; published: boolean; image: string | null }
export interface ServerContact { id: string; name: string; kind: Supplier['kind']; category: string; person: string; phone: string; email: string; city: string; leadDays: number }
export interface ServerPO { id: string; contactId: string; status: PurchaseOrder['status'] | 'cancelled'; items: PurchaseOrder['items']; orderRef: string | null; note: string | null; createdAt: string }
export interface ServerPost { id: string; source: Post['source']; refId: string | null; image: string | null; captions: L10n; hashtags: string; networks: Network[]; publishAt: string; status: Post['status'] }
export interface GalleryItem { id: string; brand: string; title: L10n; caption: L10n; focus: string; published: boolean; image: string; imageLarge?: string; sort?: number }

/* ---------------- server → UI ---------------- */

export const toOrder = (o: ServerOrder): Order => ({
  id: o.id, createdAt: o.createdAt.slice(0, 10), status: o.status as Order['status'],
  customer: { name: o.customerName, phone: o.customerPhone, channel: o.channel },
  car: { model: o.carModel, year: o.carYear }, services: o.services, look: o.look ?? undefined,
  parts: o.partIds, photos: o.photos, date: o.wantedDate ?? undefined, note: o.note ?? undefined, quote: o.quote ?? undefined,
})
export const toPart = (p: ServerPart): Part => ({
  id: p.id, model: p.model, kind: p.kind, condition: p.condition, title: p.title.en, titles: { ka: p.title.ka, ru: p.title.ru },
  price: p.price, stock: p.stock, published: p.published, img: p.image ?? undefined,
})
export const toSupplier = (c: ServerContact): Supplier => ({
  id: c.id, name: c.name, kind: c.kind, category: c.category, contact: c.person, phone: c.phone, email: c.email, city: c.city, leadDays: c.leadDays,
})
export const toPO = (p: ServerPO): PurchaseOrder => ({
  id: p.id, supplierId: p.contactId, createdAt: p.createdAt.slice(0, 10), status: p.status as PurchaseOrder['status'],
  items: p.items, orderRef: p.orderRef ?? undefined, note: p.note ?? undefined,
})
export const toPost = (p: ServerPost): Post => ({
  id: p.id, source: p.source, refId: p.refId ?? undefined, img: p.image ?? undefined, captions: p.captions, hashtags: p.hashtags,
  networks: p.networks, date: p.publishAt, status: p.status,
})

/* ---------------- UI → server ---------------- */

export const fromPart = (p: Part) => ({
  model: p.model, kind: p.kind, condition: p.condition, title: { en: p.title, ka: p.titles?.ka || undefined, ru: p.titles?.ru || undefined },
  price: p.price, stock: p.stock, published: p.published,
})
export const fromSupplier = (s: Supplier, isNew: boolean) => ({
  ...(isNew ? {} : { id: s.id }), name: s.name, kind: s.kind, category: s.category, person: s.contact, phone: s.phone, email: s.email, city: s.city, leadDays: s.leadDays,
})
export const fromEvent = (e: CalEvent) => ({ date: e.date, start: e.start, end: e.end, title: e.title, kind: e.kind, orderId: e.orderId })

/** Everything the admin shows, in one round of parallel requests. */
export async function loadAdminData() {
  const [orders, parts, contacts, pos, events, posts, gallery] = await Promise.all([
    api<ServerOrder[]>('/admin/orders?limit=200'), api<ServerPart[]>('/admin/parts'), api<ServerContact[]>('/admin/contacts'),
    api<ServerPO[]>('/admin/purchase-orders'), api<CalEvent[]>('/admin/events'), api<ServerPost[]>('/admin/posts'), api<GalleryItem[]>('/admin/gallery'),
  ])
  return {
    orders: orders.map(toOrder), parts: parts.map(toPart), suppliers: contacts.map(toSupplier), pos: pos.map(toPO),
    events: events.map((e) => ({ ...e, orderId: e.orderId ?? undefined })), posts: posts.map(toPost), gallery,
  }
}

export async function loadPublicData() {
  const [gallery, parts, blocked] = await Promise.all([api<GalleryItem[]>('/public/gallery'), api<ServerPart[]>('/public/parts'), api<string[]>('/public/blocked-days')])
  return {
    gallery, parts: parts.map(toPart),
    // the booking form only needs to know which days are full
    events: blocked.map((date): CalEvent => ({ id: `block-${date}`, date, start: '09:00', end: '19:00', title: '', kind: 'block' })),
  }
}
