import { z } from 'zod'
import { count, eq } from 'drizzle-orm'
import { schema } from '../db/index.js'
import { BRANDS, JOB_TEMPLATES, MATERIALS, SERVICE_FROM } from '../catalog.js'
import { todayLocal } from '../lib.js'
import type { Actor, Ctx } from '../services/context.js'
import * as I from '../services/inputs.js'
import * as content from '../services/content.js'
import * as workshop from '../services/workshop.js'
import * as purchasing from '../services/purchasing.js'
import * as social from '../services/social.js'

export type Mode = 'ALLOW' | 'APPROVAL' | 'DENY'
type Args = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export interface ToolDef {
  name: string
  title: string
  description: string
  area: 'website' | 'workshop' | 'purchasing' | 'social' | 'system'
  input: z.ZodRawShape
  /** default policy; the owner can change it per tool in the admin */
  mode: Mode
  readOnly: boolean
  /** one line for the approval list, e.g. "Publish gallery item Mercedes C-Class" */
  summary?: (a: Args) => string
  /** runs before an approval is stored, e.g. to save an inline image so the queue holds a reference, not 10 MB of base64 */
  prepare?: (ctx: Ctx, actor: Actor, a: Args) => Promise<Args>
  run: (ctx: Ctx, actor: Actor, a: Args) => Promise<unknown>
}

/** Saves an inline/URL image up front and swaps it for media_id. */
const stashImage = async (ctx: Ctx, actor: Actor, a: Args) => {
  if (!a.image_base64 && !a.image_url) return a
  const img = await content.saveImage(ctx, actor, a)
  const { image_base64: _b, image_url: _u, ...rest } = a
  return { ...rest, media_id: img.id }
}

const { published: _p1, ...partCreateNoPublish } = I.partCreate
const { published: _p2, ...partUpdateNoPublish } = I.partUpdate

export const TOOLS: ToolDef[] = [
  /* ---------------- overview ---------------- */
  {
    name: 'get_overview', title: 'Workshop overview', area: 'system', mode: 'ALLOW', readOnly: true, input: {},
    description: 'Today at a glance: new requests, cars in the workshop, today\'s calendar, open purchase orders, posts waiting and pending approvals.',
    run: async (ctx) => {
      const today = todayLocal(ctx.config.timezone)
      const byStatus = await ctx.db.select({ status: schema.orders.status, n: count() }).from(schema.orders).groupBy(schema.orders.status)
      const events = await workshop.listEvents(ctx, { from: today, to: today })
      const openPOs = (await purchasing.listPurchaseOrders(ctx)).filter((p) => p.status === 'draft' || p.status === 'sent')
      const drafts = await social.listPosts(ctx, 'draft')
      const pending = await ctx.db.select({ n: count() }).from(schema.approvals).where(eq(schema.approvals.status, 'pending'))
      return { today, ordersByStatus: Object.fromEntries(byStatus.map((r) => [r.status, r.n])), todaysCalendar: events, openPurchaseOrders: openPOs.map((p) => ({ id: p.id, status: p.status, total: p.total })), postDrafts: drafts.length, pendingApprovals: pending[0].n }
    },
  },
  {
    name: 'list_catalog', title: 'Car models & price list', area: 'system', mode: 'ALLOW', readOnly: true, input: {},
    description: 'Makes and model ids (needed for parts, orders and gallery), service starting prices, materials and quote templates.',
    run: async () => ({ brands: BRANDS, services: SERVICE_FROM, materials: MATERIALS, quoteTemplates: JOB_TEMPLATES, currency: 'GEL' }),
  },

  /* ---------------- website: images, gallery, parts ---------------- */
  {
    name: 'upload_image', title: 'Upload an image', area: 'website', mode: 'ALLOW', readOnly: false, input: I.imageInput,
    description: 'Stores an image (https URL or base64) and returns its media_id for use in gallery items and parts. Not visible on the website by itself. Images are resized to WebP and stripped of GPS/EXIF data.',
    run: async (ctx, actor, a) => { const m = await content.saveImage(ctx, actor, a); return { media_id: m.id, width: m.width, height: m.height, preview: content.mediaUrl(ctx, m.id) } },
  },
  {
    name: 'list_gallery', title: 'List gallery', area: 'website', mode: 'ALLOW', readOnly: true, input: {},
    description: 'All "Recent work" gallery items on the website, newest first, including unpublished ones.',
    run: (ctx) => content.listGallery(ctx),
  },
  {
    name: 'create_gallery_item', title: 'Add to the gallery', area: 'website', mode: 'APPROVAL', readOnly: false, input: I.galleryCreate,
    description: 'Adds a photo to the "Recent work" gallery on the public website. Pass the image as image_url, image_base64 or media_id. Titles and captions in en/ka/ru.',
    summary: (a) => `Add "${a.title?.en}" to the website gallery`,
    prepare: stashImage,
    run: (ctx, actor, a) => content.createGalleryItem(ctx, actor, a as never),
  },
  {
    name: 'update_gallery_item', title: 'Edit a gallery item', area: 'website', mode: 'APPROVAL', readOnly: false, input: I.galleryUpdate,
    description: 'Changes title, caption, make, focal point, order or visibility of a gallery item.',
    summary: (a) => `Change gallery item ${a.id}${a.published === false ? ' (hide it)' : ''}`,
    run: (ctx, actor, a) => content.updateGalleryItem(ctx, actor, a as never),
  },
  {
    name: 'delete_gallery_item', title: 'Remove from the gallery', area: 'website', mode: 'APPROVAL', readOnly: false, input: I.idOnly,
    description: 'Removes a gallery item from the website.', summary: (a) => `Delete gallery item ${a.id}`,
    run: (ctx, actor, a) => content.deleteGalleryItem(ctx, actor, a.id),
  },
  {
    name: 'list_parts', title: 'List parts', area: 'website', mode: 'ALLOW', readOnly: true,
    input: { model: z.string().optional().describe('Filter by model id') },
    description: 'Parts in the shop with price (GEL), stock and whether they are shown on the website.',
    run: (ctx, _a, a) => content.listParts(ctx, { model: a.model }),
  },
  {
    name: 'create_part', title: 'Add a part', area: 'website', mode: 'ALLOW', readOnly: false, input: partCreateNoPublish,
    description: 'Adds a part to the shop as an unpublished draft (use publish_part to show it on the website). Optional photo via image_url, image_base64 or media_id.',
    prepare: stashImage,
    run: (ctx, actor, a) => content.createPart(ctx, actor, { ...a, published: false } as never),
  },
  {
    name: 'update_part', title: 'Edit a part', area: 'website', mode: 'ALLOW', readOnly: false, input: partUpdateNoPublish,
    description: 'Changes title, price, stock, condition or model of a part. Visibility is changed with publish_part.',
    run: (ctx, actor, a) => content.updatePart(ctx, actor, a as never),
  },
  {
    name: 'publish_part', title: 'Show/hide a part', area: 'website', mode: 'APPROVAL', readOnly: false,
    input: { id: z.string(), published: z.boolean() },
    description: 'Shows a part in the public parts shop, or hides it.', summary: (a) => `${a.published ? 'Publish' : 'Hide'} part ${a.id} on the website`,
    run: (ctx, actor, a) => content.updatePart(ctx, actor, { id: a.id, published: a.published }),
  },
  {
    name: 'delete_part', title: 'Delete a part', area: 'website', mode: 'APPROVAL', readOnly: false, input: I.idOnly,
    description: 'Deletes a part from the shop.', summary: (a) => `Delete part ${a.id}`,
    run: (ctx, actor, a) => content.deletePart(ctx, actor, a.id),
  },

  /* ---------------- workshop ---------------- */
  {
    name: 'list_orders', title: 'List orders', area: 'workshop', mode: 'ALLOW', readOnly: true, input: I.orderFilter,
    description: 'Customer requests and jobs. Status flow: new → quoted → scheduled → workshop → ready → delivered (or cancelled).',
    run: (ctx, _a, a) => workshop.listOrders(ctx, a),
  },
  {
    name: 'get_order', title: 'Order details', area: 'workshop', mode: 'ALLOW', readOnly: true, input: I.idOnly,
    description: 'One order with customer, car, chosen leather look, photos, requested parts, quote, calendar entries and a rough estimate.',
    run: (ctx, _a, a) => workshop.getOrder(ctx, a.id),
  },
  {
    name: 'create_order', title: 'Create an order', area: 'workshop', mode: 'ALLOW', readOnly: false, input: I.orderCreate,
    description: 'Records a request taken by phone or in person (website bookings arrive by themselves).',
    run: (ctx, actor, a) => workshop.createOrder(ctx, actor, a as never),
  },
  {
    name: 'set_order_status', title: 'Move an order', area: 'workshop', mode: 'ALLOW', readOnly: false, input: I.orderStatus,
    description: 'Moves an order to another stage of the workshop pipeline.',
    run: (ctx, actor, a) => workshop.setOrderStatus(ctx, actor, a.id, a.status),
  },
  {
    name: 'set_order_note', title: 'Order note', area: 'workshop', mode: 'ALLOW', readOnly: false, input: I.orderNote,
    description: 'Replaces the internal note on an order.', run: (ctx, actor, a) => workshop.setOrderNote(ctx, actor, a.id, a.note),
  },
  {
    name: 'calculate_quote', title: 'Calculate a quote', area: 'workshop', mode: 'ALLOW', readOnly: true, input: I.quoteCalc,
    description: 'Price for a job: materials + labour hours × rate + margin, optional 18 % VAT. Does not save anything.',
    run: async (_c, _a, a) => workshop.calculateQuote(a),
  },
  {
    name: 'save_quote', title: 'Save a quote to an order', area: 'workshop', mode: 'ALLOW', readOnly: false, input: I.quoteSave,
    description: 'Calculates and stores the quote on the order; a new order moves to "quoted".',
    run: (ctx, actor, a) => { const { orderId, ...q } = a; return workshop.saveQuote(ctx, actor, orderId, q) },
  },
  {
    name: 'list_calendar', title: 'Calendar', area: 'workshop', mode: 'ALLOW', readOnly: true, input: I.eventRange,
    description: 'Drop-offs, pickups, material deliveries and blocked days (kind "block" makes the website show the day as full).',
    run: (ctx, _a, a) => workshop.listEvents(ctx, a),
  },
  {
    name: 'create_calendar_entry', title: 'Add to the calendar', area: 'workshop', mode: 'ALLOW', readOnly: false, input: I.eventCreate,
    description: 'Adds an appointment, pickup, delivery or a blocked day.', run: (ctx, actor, a) => workshop.createEvent(ctx, actor, a as never),
  },
  {
    name: 'delete_calendar_entry', title: 'Remove a calendar entry', area: 'workshop', mode: 'APPROVAL', readOnly: false, input: I.idOnly,
    description: 'Deletes a calendar entry.', summary: (a) => `Delete calendar entry ${a.id}`,
    run: (ctx, actor, a) => workshop.deleteEvent(ctx, actor, a.id),
  },
  {
    name: 'book_order', title: 'Book a car in', area: 'workshop', mode: 'ALLOW', readOnly: false, input: I.bookOrder,
    description: 'Puts the drop-off in the calendar and moves the order to "scheduled". Refuses blocked days.',
    run: (ctx, actor, a) => workshop.bookOrderIn(ctx, actor, a as never),
  },

  /* ---------------- purchasing ---------------- */
  {
    name: 'list_contacts', title: 'Suppliers, dealers & partners', area: 'purchasing', mode: 'ALLOW', readOnly: true,
    input: { kind: z.enum(['supplier', 'dealer', 'partner']).optional() },
    description: 'Leather/foam/thread suppliers, parts dealers and partner garages.', run: (ctx, _a, a) => purchasing.listContacts(ctx, a.kind),
  },
  {
    name: 'save_contact', title: 'Add or edit a contact', area: 'purchasing', mode: 'ALLOW', readOnly: false, input: I.contactUpsert,
    description: 'Creates a contact, or updates it when id is given.', run: (ctx, actor, a) => purchasing.upsertContact(ctx, actor, a as never),
  },
  {
    name: 'delete_contact', title: 'Delete a contact', area: 'purchasing', mode: 'APPROVAL', readOnly: false, input: I.idOnly,
    description: 'Deletes a contact that has no purchase orders.', summary: (a) => `Delete contact ${a.id}`,
    run: (ctx, actor, a) => purchasing.deleteContact(ctx, actor, a.id),
  },
  {
    name: 'list_purchase_orders', title: 'Purchase orders', area: 'purchasing', mode: 'ALLOW', readOnly: true,
    input: { status: z.enum(['draft', 'sent', 'received', 'cancelled']).optional() },
    description: 'Orders to suppliers with items and totals (GEL).', run: (ctx, _a, a) => purchasing.listPurchaseOrders(ctx, a.status),
  },
  {
    name: 'create_purchase_order', title: 'Draft a purchase order', area: 'purchasing', mode: 'ALLOW', readOnly: false, input: I.poCreate,
    description: 'Creates a draft order to a supplier or dealer. Nothing is sent yet.', run: (ctx, actor, a) => purchasing.createPurchaseOrder(ctx, actor, a as never),
  },
  {
    name: 'update_purchase_order', title: 'Edit a draft purchase order', area: 'purchasing', mode: 'ALLOW', readOnly: false, input: I.poUpdate,
    description: 'Changes items, order reference or note of a draft.', run: (ctx, actor, a) => purchasing.updatePurchaseOrder(ctx, actor, a as never),
  },
  {
    name: 'send_purchase_order', title: 'Send a purchase order', area: 'purchasing', mode: 'APPROVAL', readOnly: false, input: I.poSend,
    description: 'Emails the draft to the supplier (needs SMTP on the server) or returns a WhatsApp link for a person to send.',
    summary: (a) => `Send purchase order ${a.id} by ${a.via ?? 'email'}`,
    run: (ctx, actor, a) => purchasing.sendPurchaseOrder(ctx, actor, a.id, a.via ?? 'email'),
  },
  {
    name: 'mark_purchase_order', title: 'Update purchase order status', area: 'purchasing', mode: 'ALLOW', readOnly: false,
    input: { id: z.string(), status: z.enum(['sent', 'received', 'cancelled']) },
    description: 'Marks an order as sent by hand, received (goods arrived) or cancelled.', run: (ctx, actor, a) => purchasing.markPurchaseOrder(ctx, actor, a.id, a.status),
  },
  {
    name: 'delete_purchase_order', title: 'Delete a draft purchase order', area: 'purchasing', mode: 'APPROVAL', readOnly: false, input: I.idOnly,
    description: 'Deletes a draft that was never sent.', summary: (a) => `Delete draft purchase order ${a.id}`,
    run: (ctx, actor, a) => purchasing.deletePurchaseOrder(ctx, actor, a.id),
  },

  /* ---------------- social ---------------- */
  {
    name: 'list_posts', title: 'Social posts', area: 'social', mode: 'ALLOW', readOnly: true,
    input: { status: z.enum(['draft', 'approved', 'scheduled', 'failed']).optional() },
    description: 'Post drafts and scheduled posts with captions in ka/en/ru, networks and time (Tbilisi).', run: (ctx, _a, a) => social.listPosts(ctx, a.status),
  },
  {
    name: 'generate_post_drafts', title: 'Draft posts from finished work', area: 'social', mode: 'ALLOW', readOnly: false, input: {},
    description: 'Creates a draft for every ready/delivered job and every published gallery item that has no post yet, on the next free evening slots.',
    run: (ctx, actor) => social.generateDrafts(ctx, actor),
  },
  {
    name: 'create_post', title: 'Draft a post', area: 'social', mode: 'ALLOW', readOnly: false,
    input: { source: z.enum(['order', 'part', 'gallery']), refId: z.string().describe('Order, part or gallery item id') },
    description: 'Drafts one post (ka/en/ru captions, photo, next free slot) for a specific job, part or gallery photo.',
    run: (ctx, actor, a) => social.createPostFor(ctx, actor, a.source, a.refId),
  },
  {
    name: 'update_post', title: 'Edit a post', area: 'social', mode: 'ALLOW', readOnly: false, input: I.postUpdate,
    description: 'Changes captions, hashtags, networks or time. An edited post goes back to draft and needs approval again.',
    run: (ctx, actor, a) => social.updatePost(ctx, actor, a as never),
  },
  {
    name: 'approve_post', title: 'Approve a post', area: 'social', mode: 'APPROVAL', readOnly: false, input: I.idOnly,
    description: 'Marks a draft as approved for publishing.', summary: (a) => `Approve post ${a.id}`,
    run: (ctx, actor, a) => social.approvePost(ctx, actor, a.id),
  },
  {
    name: 'schedule_post', title: 'Schedule in Metricool', area: 'social', mode: 'APPROVAL', readOnly: false, input: I.postSchedule,
    description: 'Hands an approved post to Metricool, which publishes it on all chosen networks at its time.',
    summary: (a) => `Schedule post ${a.id} in Metricool`,
    run: (ctx, actor, a) => social.schedulePost(ctx, actor, a.id, a.lang ?? 'ka'),
  },
  {
    name: 'delete_post', title: 'Discard a post', area: 'social', mode: 'ALLOW', readOnly: false, input: I.idOnly,
    description: 'Deletes a draft or approved post (scheduled ones are removed in Metricool).', run: (ctx, actor, a) => social.deletePost(ctx, actor, a.id),
  },
]

export const TOOL_MAP = new Map(TOOLS.map((t) => [t.name, t]))
