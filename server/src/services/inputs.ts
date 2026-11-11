import { z } from 'zod'
import { BRAND_IDS, LEATHERS, MODEL_IDS, SERVICES, THREADS } from '../catalog.js'
import { NETWORKS, ORDER_STATUSES } from '../db/schema.js'

/*
  Input shapes shared by the REST API and the MCP tools.
  Exported as raw shapes (what McpServer.registerTool wants); wrap with z.object() for REST.
*/

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
const time = z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM')
const gel = z.number().int().min(0).max(1_000_000)
export const l10n = z.object({
  en: z.string().min(1).max(200),
  ka: z.string().max(200).optional(),
  ru: z.string().max(200).optional(),
}).describe('Text in English, Georgian (ka) and Russian (ru). Missing languages fall back to English.')

export const look = z.object({
  leather: z.enum(LEATHERS),
  finish: z.enum(['nappa', 'alcantara', 'perforated']),
  thread: z.enum(THREADS),
  seam: z.enum(['single', 'double']),
})

/** An image either downloaded from an https URL or sent inline as base64. */
export const imageInput = {
  media_id: z.string().optional().describe('Id of an image uploaded earlier (upload_image)'),
  image_url: z.string().url().optional().describe('Public https URL of the image'),
  image_base64: z.string().optional().describe('The image file as base64 (no data: prefix needed)'),
  alt: z.string().max(200).optional().describe('Short description of the image for screen readers'),
}

/* ---------- gallery ---------- */
export const galleryCreate = {
  ...imageInput,
  brand: z.enum(BRAND_IDS).describe('Make shown in the gallery filter'),
  title: l10n.describe('Car name, e.g. {"en":"Mercedes C-Class W205"}'),
  caption: l10n.describe('What was done, e.g. {"en":"Dashboard in black nappa"}'),
  focus: z.string().regex(/^\d{1,3}% \d{1,3}%$/).optional().describe('Focal point for the portrait tile as "x% y%", default "50% 50%"'),
  published: z.boolean().optional().describe('Show on the website right away (default true)'),
}
export const galleryUpdate = {
  id: z.string(),
  brand: z.enum(BRAND_IDS).optional(),
  title: l10n.optional(),
  caption: l10n.optional(),
  focus: z.string().regex(/^\d{1,3}% \d{1,3}%$/).optional(),
  published: z.boolean().optional(),
  sort: z.number().int().optional().describe('Lower numbers come first'),
}

/* ---------- parts ---------- */
const partKind = z.enum(['dashboard', 'wheel', 'door', 'console', 'glovebox'])
const partCondition = z.enum(['exchange', 'used', 'new']).describe('exchange = re-trimmed part swapped for the customer\'s old one')
export const partCreate = {
  ...imageInput,
  model: z.enum(MODEL_IDS).describe('Car model id, see list_catalog'),
  kind: partKind,
  condition: partCondition,
  title: l10n,
  price: gel.describe('Price in GEL'),
  stock: z.number().int().min(0).default(1),
  published: z.boolean().optional().describe('Show in the website parts shop (default false)'),
}
export const partUpdate = {
  id: z.string(),
  model: z.enum(MODEL_IDS).optional(),
  kind: partKind.optional(),
  condition: partCondition.optional(),
  title: l10n.optional(),
  price: gel.optional(),
  stock: z.number().int().min(0).optional(),
  published: z.boolean().optional(),
}

/* ---------- orders ---------- */
export const orderCreate = {
  customerName: z.string().min(1).max(120),
  customerPhone: z.string().min(6).max(40),
  channel: z.enum(['whatsapp', 'viber', 'telegram', 'call']).default('whatsapp'),
  carModel: z.enum(MODEL_IDS),
  carYear: z.string().max(4).default(''),
  services: z.array(z.enum(SERVICES)).min(1),
  look: look.nullable().optional(),
  partIds: z.array(z.string()).max(10).default([]),
  photoIds: z.array(z.string()).max(4).default([]),
  wantedDate: date.optional(),
  note: z.string().max(2000).optional(),
  lang: z.enum(['ka', 'en', 'ru']).default('ka'),
}
export const orderFilter = {
  status: z.enum(ORDER_STATUSES).optional(),
  query: z.string().optional().describe('Search in customer name, phone, car and order id'),
  limit: z.number().int().min(1).max(200).default(50),
}
export const orderStatus = { id: z.string(), status: z.enum(ORDER_STATUSES) }
export const orderNote = { id: z.string(), note: z.string().max(2000) }

export const quoteLine = z.object({ label: z.string().min(1), qty: z.number().min(0), unit: z.string().default('pc'), price: z.number().min(0) })
export const quoteCalc = {
  template: z.enum(['dashboard', 'upper', 'wheel', 'doors']).optional().describe('Start from a job template'),
  lines: z.array(quoteLine).optional().describe('Material lines; replaces the template lines'),
  labourHours: z.number().min(0).optional(),
  rate: z.number().min(0).optional().describe('GEL per hour, default 45'),
  margin: z.number().min(0).max(300).optional().describe('Percent, default 25'),
  vat: z.boolean().optional().describe('Add 18 % VAT, default true'),
}
export const quoteSave = { orderId: z.string(), ...quoteCalc }

/* ---------- calendar ---------- */
export const eventCreate = {
  date,
  start: time,
  end: time,
  title: z.string().min(1).max(160),
  kind: z.enum(['appointment', 'pickup', 'delivery', 'block']),
  orderId: z.string().optional(),
}
export const eventRange = { from: date.optional(), to: date.optional() }
export const bookOrder = { orderId: z.string(), date, start: time.default('10:00'), durationMinutes: z.number().int().min(15).max(600).default(60) }

/* ---------- contacts & purchasing ---------- */
export const contactUpsert = {
  id: z.string().optional().describe('Leave out to create a new contact'),
  name: z.string().min(1).max(160),
  kind: z.enum(['supplier', 'dealer', 'partner']),
  category: z.string().max(160).default(''),
  person: z.string().max(120).default(''),
  phone: z.string().max(40).default(''),
  email: z.string().max(160).default(''),
  city: z.string().max(80).default(''),
  leadDays: z.number().int().min(0).max(180).default(1),
}
export const poItem = z.object({ name: z.string().min(1), qty: z.number().positive(), unit: z.string().default('pc'), price: z.number().min(0) })
export const poCreate = { contactId: z.string(), items: z.array(poItem).min(1), orderRef: z.string().optional(), note: z.string().max(2000).optional() }
export const poUpdate = { id: z.string(), items: z.array(poItem).min(1).optional(), orderRef: z.string().nullable().optional(), note: z.string().max(2000).nullable().optional() }
export const poSend = { id: z.string(), via: z.enum(['email', 'whatsapp']).default('email') }

/* ---------- social ---------- */
export const postUpdate = {
  id: z.string(),
  captions: l10n.optional(),
  hashtags: z.string().max(500).optional(),
  networks: z.array(z.enum(NETWORKS)).min(1).optional(),
  publishAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Use YYYY-MM-DDTHH:MM (Tbilisi time)').optional(),
}
export const postSchedule = { id: z.string(), lang: z.enum(['ka', 'en', 'ru']).default('ka').describe('Main caption language; English goes into the first comment') }

export const idOnly = { id: z.string() }
