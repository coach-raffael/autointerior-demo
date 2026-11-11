import { boolean, index, integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

/** Text in the three site languages. */
export type L10n = { en: string; ka: string; ru: string }

const created = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updated = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()

/* ---------------- people & access ---------------- */

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  role: text('role', { enum: ['owner', 'staff'] }).notNull().default('owner'),
  createdAt: created(),
})

export const sessions = pgTable('sessions', {
  tokenHash: text('token_hash').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: created(),
})

/* ---------------- media ---------------- */

export const media = pgTable('media', {
  id: text('id').primaryKey(),
  mime: text('mime').notNull(),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  bytes: integer('bytes').notNull(),
  alt: text('alt').notNull().default(''),
  /** where it came from: an upload, a URL, the seed, a customer booking */
  source: text('source').notNull().default('upload'),
  createdAt: created(),
})

/* ---------------- website content ---------------- */

export const galleryItems = pgTable('gallery_items', {
  id: text('id').primaryKey(),
  mediaId: text('media_id').notNull().references(() => media.id),
  brand: text('brand').notNull(),
  title: jsonb('title').$type<L10n>().notNull(),
  caption: jsonb('caption').$type<L10n>().notNull(),
  /** CSS object-position for the portrait tile, e.g. "45% 50%" */
  focus: text('focus').notNull().default('50% 50%'),
  published: boolean('published').notNull().default(true),
  sort: integer('sort').notNull().default(0),
  createdAt: created(),
  updatedAt: updated(),
})

export const parts = pgTable('parts', {
  id: text('id').primaryKey(),
  model: text('model').notNull(),
  kind: text('kind', { enum: ['dashboard', 'wheel', 'door', 'console', 'glovebox'] }).notNull(),
  condition: text('condition', { enum: ['exchange', 'used', 'new'] }).notNull(),
  title: jsonb('title').$type<L10n>().notNull(),
  price: integer('price').notNull(),
  stock: integer('stock').notNull().default(0),
  published: boolean('published').notNull().default(false),
  mediaId: text('media_id').references(() => media.id),
  createdAt: created(),
  updatedAt: updated(),
})

/* ---------------- workshop ---------------- */

export type Look = { leather: string; finish: 'nappa' | 'alcantara' | 'perforated'; thread: string; seam: 'single' | 'double' }
export type QuoteLine = { label: string; qty: number; unit: string; price: number }
export type Quote = { lines: QuoteLine[]; labourHours: number; rate: number; margin: number; vat: boolean; total: number }
export const ORDER_STATUSES = ['new', 'quoted', 'scheduled', 'workshop', 'ready', 'delivered', 'cancelled'] as const

export const orders = pgTable('orders', {
  id: text('id').primaryKey(),
  status: text('status', { enum: ORDER_STATUSES }).notNull().default('new'),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone').notNull(),
  channel: text('channel', { enum: ['whatsapp', 'viber', 'telegram', 'call'] }).notNull().default('whatsapp'),
  carModel: text('car_model').notNull(),
  carYear: text('car_year').notNull().default(''),
  services: jsonb('services').$type<string[]>().notNull(),
  look: jsonb('look').$type<Look | null>(),
  partIds: jsonb('part_ids').$type<string[]>().notNull().default([]),
  photoIds: jsonb('photo_ids').$type<string[]>().notNull().default([]),
  wantedDate: text('wanted_date'),
  note: text('note'),
  quote: jsonb('quote').$type<Quote | null>(),
  lang: text('lang').notNull().default('ka'),
  createdAt: created(),
  updatedAt: updated(),
}, (t) => [index('orders_status_idx').on(t.status)])

export const events = pgTable('events', {
  id: text('id').primaryKey(),
  date: text('date').notNull(), // YYYY-MM-DD, workshop local time
  start: text('start').notNull(),
  end: text('end').notNull(),
  title: text('title').notNull(),
  kind: text('kind', { enum: ['appointment', 'pickup', 'delivery', 'block'] }).notNull(),
  orderId: text('order_id').references(() => orders.id, { onDelete: 'set null' }),
  createdAt: created(),
}, (t) => [index('events_date_idx').on(t.date)])

export const contacts = pgTable('contacts', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind', { enum: ['supplier', 'dealer', 'partner'] }).notNull(),
  category: text('category').notNull().default(''),
  person: text('person').notNull().default(''),
  phone: text('phone').notNull().default(''),
  email: text('email').notNull().default(''),
  city: text('city').notNull().default(''),
  leadDays: integer('lead_days').notNull().default(1),
  createdAt: created(),
})

export type POItem = { name: string; qty: number; unit: string; price: number }
export const purchaseOrders = pgTable('purchase_orders', {
  id: text('id').primaryKey(),
  contactId: text('contact_id').notNull().references(() => contacts.id),
  status: text('status', { enum: ['draft', 'sent', 'received', 'cancelled'] }).notNull().default('draft'),
  items: jsonb('items').$type<POItem[]>().notNull(),
  orderRef: text('order_ref'),
  note: text('note'),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  sentVia: text('sent_via'),
  createdAt: created(),
  updatedAt: updated(),
})

/* ---------------- marketing ---------------- */

export const NETWORKS = ['instagram', 'facebook', 'tiktok', 'youtube', 'threads', 'gmb'] as const
export const posts = pgTable('posts', {
  id: text('id').primaryKey(),
  source: text('source', { enum: ['order', 'part', 'gallery', 'manual'] }).notNull(),
  refId: text('ref_id'),
  mediaId: text('media_id').references(() => media.id),
  captions: jsonb('captions').$type<L10n>().notNull(),
  hashtags: text('hashtags').notNull().default(''),
  networks: jsonb('networks').$type<(typeof NETWORKS)[number][]>().notNull(),
  publishAt: text('publish_at').notNull(), // local ISO without offset, Asia/Tbilisi
  status: text('status', { enum: ['draft', 'approved', 'scheduled', 'failed'] }).notNull().default('draft'),
  externalId: text('external_id'),
  createdAt: created(),
  updatedAt: updated(),
})

/* ---------------- MCP governance ---------------- */

export const mcpPolicies = pgTable('mcp_policies', {
  tool: text('tool').primaryKey(),
  mode: text('mode', { enum: ['ALLOW', 'APPROVAL', 'DENY'] }).notNull(),
  updatedAt: updated(),
})

export const approvals = pgTable('approvals', {
  id: text('id').primaryKey(),
  tool: text('tool').notNull(),
  args: jsonb('args').$type<Record<string, unknown>>().notNull(),
  summary: text('summary').notNull(),
  status: text('status', { enum: ['pending', 'approved', 'rejected', 'failed'] }).notNull().default('pending'),
  requestedBy: text('requested_by').notNull(),
  decidedBy: text('decided_by'),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  result: jsonb('result').$type<unknown>(),
  error: text('error'),
  createdAt: created(),
}, (t) => [index('approvals_status_idx').on(t.status)])

export const auditLog = pgTable('audit_log', {
  id: serial('id').primaryKey(),
  actor: text('actor').notNull(), // "user:1" | "mcp:<client>" | "public"
  action: text('action').notNull(),
  target: text('target'),
  details: jsonb('details').$type<unknown>(),
  createdAt: created(),
})

/* ---------------- OAuth 2.1 (MCP connector) ---------------- */

export const oauthClients = pgTable('oauth_clients', {
  clientId: text('client_id').primaryKey(),
  info: jsonb('info').$type<Record<string, unknown>>().notNull(),
  createdAt: created(),
})

export const oauthCodes = pgTable('oauth_codes', {
  codeHash: text('code_hash').primaryKey(),
  clientId: text('client_id').notNull().references(() => oauthClients.clientId, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  codeChallenge: text('code_challenge').notNull(),
  redirectUri: text('redirect_uri').notNull(),
  scopes: jsonb('scopes').$type<string[]>().notNull(),
  resource: text('resource'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
})

export const oauthTokens = pgTable('oauth_tokens', {
  tokenHash: text('token_hash').primaryKey(),
  kind: text('kind', { enum: ['access', 'refresh'] }).notNull(),
  clientId: text('client_id').notNull().references(() => oauthClients.clientId, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  scopes: jsonb('scopes').$type<string[]>().notNull(),
  resource: text('resource'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revoked: boolean('revoked').notNull().default(false),
  createdAt: created(),
})
