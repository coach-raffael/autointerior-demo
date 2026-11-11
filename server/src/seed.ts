import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { sql } from 'drizzle-orm'
import { schema } from './db/index.js'
import { hashPassword, todayLocal } from './lib.js'
import type { Ctx } from './services/context.js'
import { orderCaptions } from './services/social.js'
import { carLabel } from './catalog.js'

const SEED_MEDIA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../seed/media')
const day = (n: number) => todayLocal('Asia/Tbilisi', n)
const t = (en: string, ka: string, ru: string) => ({ en, ka, ru })

/** Creates the owner account from ADMIN_EMAIL / ADMIN_PASSWORD if no user exists yet. */
export async function ensureAdmin(ctx: Ctx, fallback?: { email: string; password: string }) {
  const [{ n }] = await ctx.db.select({ n: sql<number>`count(*)::int` }).from(schema.users)
  if (n > 0) return null
  const email = ctx.config.adminEmail ?? fallback?.email
  const password = ctx.config.adminPassword ?? fallback?.password
  if (!email || !password) return null
  await ctx.db.insert(schema.users).values({ email: email.toLowerCase(), name: ctx.config.adminName, passwordHash: await hashPassword(password), role: 'owner' })
  return email
}

/** Loads the pitch data set into an empty database (idempotent: does nothing when orders exist). */
export async function seedDemo(ctx: Ctx) {
  const [{ n }] = await ctx.db.select({ n: sql<number>`count(*)::int` }).from(schema.orders)
  if (n > 0) return false

  // images → media store
  const files = (await fs.readdir(SEED_MEDIA).catch(() => [])).filter((f) => f.endsWith('.jpg'))
  const mediaId: Record<string, string> = {}
  for (const f of files) {
    const id = `IMG-SEED${f.replace(/\W/g, '').toUpperCase().slice(0, 12)}`
    const info = await ctx.store.put(id, await fs.readFile(path.join(SEED_MEDIA, f)))
    await ctx.db.insert(schema.media).values({ id, ...info, alt: f.replace('.jpg', '').replace(/-/g, ' '), source: 'seed' }).onConflictDoNothing()
    mediaId[f.replace('.jpg', '')] = id
  }
  const m = (k: string) => mediaId[k] ?? null

  const gallery: [string, string, ReturnType<typeof t>, ReturnType<typeof t>][] = [
    ['bentley', 'bentley', t('Bentley', 'Bentley', 'Bentley'), t('Dashboard, black nappa', 'ტორპედო, შავი ნაპა', 'Торпеда, чёрная наппа')],
    ['bmw-x6', 'bmw', t('BMW X6', 'BMW X6', 'BMW X6'), t('Dashboard upper, stitched', 'ტორპედოს ზედა ნაწილი, ნაკერით', 'Верх торпеды, прострочен')],
    ['audi-etron', 'audi', t('Audi e-tron', 'Audi e-tron', 'Audi e-tron'), t('Full dashboard', 'მთლიანი ტორპედო', 'Торпеда целиком')],
    ['porsche-cayenne', 'porsche', t('Porsche Cayenne', 'Porsche Cayenne', 'Porsche Cayenne'), t('Dashboard on the bench', 'ტორპედო სახელოსნოში', 'Торпеда на верстаке')],
    ['bmw-m5', 'bmw', t('BMW M5', 'BMW M5', 'BMW M5'), t('Stripped & prepped', 'გასუფთავებული და მომზადებული', 'Очищена и подготовлена')],
    ['bmw-m6-finish', 'bmw', t('BMW M6', 'BMW M6', 'BMW M6'), t('Finished hood', 'დასრულებული კოზირეკი', 'Готовый козырёк')],
    ['bmw-m6', 'bmw', t('BMW M6', 'BMW M6', 'BMW M6'), t('Instrument hood, grey stitch', 'ხელსაწყოების კოზირეკი, ნაცრისფერი ნაკერი', 'Козырёк приборов, серая строчка')],
    ['bmw-wheel', 'bmw', t('BMW M wheel', 'BMW M საჭე', 'Руль BMW M'), t('Steering wheel', 'საჭე', 'Руль')],
    ['mercedes-w140', 'mercedes', t('Mercedes W140', 'Mercedes W140', 'Mercedes W140'), t('Dashboard, nappa', 'ტორპედო, ნაპა', 'Торпеда, наппа')],
    ['bmw-x7', 'bmw', t('BMW X7', 'BMW X7', 'BMW X7'), t('Dashboard centre seam', 'ტორპედოს ცენტრალური ნაკერი', 'Центральный шов торпеды')],
    ['jaguar', 'jaguar', t('Jaguar', 'Jaguar', 'Jaguar'), t('Red contrast stitch', 'წითელი კონტრასტული ნაკერი', 'Красная контрастная строчка')],
    ['workshop-detail', 'bmw', t('Workshop', 'სახელოსნო', 'Мастерская'), t('Hood detail', 'კოზირეკის დეტალი', 'Деталь козырька')],
  ]
  let sort = 0
  for (const [img, brand, title, caption] of gallery) {
    if (!m(img)) continue
    await ctx.db.insert(schema.galleryItems).values({ id: `GAL-SEED${sort}`, mediaId: m(img)!, brand, title, caption, sort: sort++ })
  }

  await ctx.db.insert(schema.contacts).values([
    { id: 'S-01', name: 'Pelle Italia Trading', kind: 'supplier', category: 'Nappa & Alcantara', person: 'Marco R.', phone: '+39 02 555 0142', email: 'orders@example-pelle.it', city: 'Milan', leadDays: 9 },
    { id: 'S-02', name: 'Kartli Foam & Glue', kind: 'supplier', category: 'Foam, adhesives', person: 'Zura A.', phone: '+995 32 2 55 01 90', email: 'sales@example-kartli.ge', city: 'Tbilisi', leadDays: 1 },
    { id: 'S-03', name: 'Amann Thread (dealer)', kind: 'supplier', category: 'Thread', person: 'Office', phone: '+90 212 555 0110', email: 'tr@example-thread.com', city: 'Istanbul', leadDays: 6 },
    { id: 'D-01', name: 'Eliava Parts Row 14', kind: 'dealer', category: 'Used dashboards & cores', person: 'Beso', phone: '+995 599 44 10 10', email: '', city: 'Tbilisi', leadDays: 0 },
    { id: 'D-02', name: 'Autopapa Import', kind: 'dealer', category: 'German & Japanese parts', person: 'Mariam', phone: '+995 577 10 20 30', email: 'parts@example-autopapa.ge', city: 'Rustavi', leadDays: 3 },
    { id: 'P-01', name: 'Premium Detailing Saburtalo', kind: 'partner', category: 'Sends customers', person: 'Nika', phone: '+995 555 12 12 34', email: 'hello@example-detail.ge', city: 'Tbilisi', leadDays: 0 },
  ])

  await ctx.db.insert(schema.parts).values([
    { id: 'PT-01', model: 'bmw-x6', kind: 'dashboard', condition: 'exchange', title: t('Dashboard, black nappa, double stitch', 'ტორპედო, შავი ნაპა, ორმაგი ნაკერი', 'Торпеда, чёрная наппа, двойная строчка'), price: 2400, stock: 1, published: true, mediaId: m('bmw-x6') },
    { id: 'PT-02', model: 'bmw-m6', kind: 'dashboard', condition: 'exchange', title: t('Dashboard upper, black nappa, grey stitch', 'ტორპედოს ზედა ნაწილი, შავი ნაპა, ნაცრისფერი ნაკერი', 'Верх торпеды, чёрная наппа, серая строчка'), price: 2100, stock: 1, published: true, mediaId: m('bmw-m6-finish') },
    { id: 'PT-03', model: 'bmw-e39', kind: 'wheel', condition: 'exchange', title: t('M sport wheel, re-trimmed nappa', 'M Sport საჭე, გადაკრული ნაპით', 'Руль M Sport, перетянут наппой'), price: 480, stock: 2, published: true, mediaId: m('bmw-wheel') },
    { id: 'PT-04', model: 'mb-w140', kind: 'dashboard', condition: 'used', title: t('Dashboard core, no cracks', 'ტორპედოს ბაზა, ბზარების გარეშე', 'Основа торпеды, без трещин'), price: 650, stock: 1, published: true, mediaId: m('mercedes-w140') },
    { id: 'PT-05', model: 'p-cayenne', kind: 'dashboard', condition: 'exchange', title: t('Dashboard, black nappa, red stitch', 'ტორპედო, შავი ნაპა, წითელი ნაკერი', 'Торпеда, чёрная наппа, красная строчка'), price: 2900, stock: 1, published: true, mediaId: m('porsche-cayenne') },
    { id: 'PT-06', model: 'a-etron', kind: 'dashboard', condition: 'used', title: t('Dashboard core with airbag lid', 'ტორპედოს ბაზა ეარბეგის სახურავით', 'Основа торпеды с крышкой подушки'), price: 1100, stock: 1, published: true, mediaId: m('audi-etron') },
    { id: 'PT-07', model: 'j-fpace', kind: 'dashboard', condition: 'exchange', title: t('Dashboard, black, red contrast stitch', 'ტორპედო, შავი, წითელი კონტრასტული ნაკერი', 'Торпеда, чёрная, красная контрастная строчка'), price: 2300, stock: 0, published: true, mediaId: m('jaguar') },
    { id: 'PT-08', model: 'bmw-x7', kind: 'dashboard', condition: 'used', title: t('Dashboard core, centre seam intact', 'ტორპედოს ბაზა, ცენტრალური ნაკერი მთელია', 'Основа торпеды, центральный шов цел'), price: 1500, stock: 1, published: false, mediaId: m('bmw-x7') },
    { id: 'PT-09', model: 'mb-w463', kind: 'glovebox', condition: 'exchange', title: t('Glovebox lid, cognac nappa', 'ხელთათმანების ყუთის სახურავი, კონიაკისფერი ნაპა', 'Крышка бардачка, коньячная наппа'), price: 390, stock: 1, published: true },
    { id: 'PT-10', model: 'lr-rr', kind: 'console', condition: 'exchange', title: t('Centre armrest, black perforated', 'ცენტრალური საიდაყვე, შავი პერფორირებული', 'Центральный подлокотник, чёрный перфорированный'), price: 520, stock: 1, published: true },
  ])

  const at = (n: number) => new Date(`${day(n)}T09:00:00+04:00`)
  const q = (total: number) => ({ lines: [{ label: 'Nappa leather', qty: 3.2, unit: 'm²', price: 95 }, { label: 'Foam 3 mm', qty: 2.5, unit: 'm²', price: 22 }], labourHours: 18, rate: 45, margin: 25, vat: true, total })
  const orders = [
    { id: 'AI-1041', createdAt: at(-1), status: 'new', customerName: 'Giorgi M.', customerPhone: '+995 599 11 22 33', channel: 'whatsapp', carModel: 'bmw-x5', carYear: '2020', services: ['dashboard'], look: { leather: 'black', finish: 'nappa', thread: 'blue', seam: 'double' }, photoIds: [m('bmw-x6')], wantedDate: day(6), note: 'Cracked above the airbag after the sun.' },
    { id: 'AI-1040', createdAt: at(-2), status: 'new', customerName: 'Nino K.', customerPhone: '+995 577 40 18 90', channel: 'whatsapp', carModel: 'mb-w140', carYear: '1996', services: ['dashboard', 'wheel'], look: { leather: 'cream', finish: 'nappa', thread: 'tonal', seam: 'single' }, photoIds: [m('mercedes-w140')], wantedDate: day(9) },
    { id: 'AI-1038', createdAt: at(-4), status: 'quoted', customerName: 'Davit T.', customerPhone: '+995 555 70 03 41', channel: 'telegram', carModel: 'p-cayenne', carYear: '2021', services: ['dashboard'], look: { leather: 'black', finish: 'nappa', thread: 'red', seam: 'double' }, photoIds: [m('porsche-cayenne')], wantedDate: day(4), quote: q(1749) },
    { id: 'AI-1036', createdAt: at(-6), status: 'scheduled', customerName: 'Levan B.', customerPhone: '+995 591 22 87 15', channel: 'whatsapp', carModel: 'b-gt', carYear: '2019', services: ['dashboard', 'console'], look: { leather: 'oxblood', finish: 'nappa', thread: 'white', seam: 'double' }, photoIds: [m('bentley')], wantedDate: day(1) },
    { id: 'AI-1033', createdAt: at(-9), status: 'workshop', customerName: 'Sandro J.', customerPhone: '+995 568 33 90 12', channel: 'viber', carModel: 'bmw-m6', carYear: '2015', services: ['dashboard'], look: { leather: 'black', finish: 'nappa', thread: 'white', seam: 'double' }, photoIds: [m('bmw-m6')], wantedDate: day(-3) },
    { id: 'AI-1031', createdAt: at(-11), status: 'workshop', customerName: 'Ana G.', customerPhone: '+995 593 61 44 08', channel: 'whatsapp', carModel: 'a-etron', carYear: '2020', services: ['dashboard'], look: { leather: 'graphite', finish: 'alcantara', thread: 'tonal', seam: 'single' }, photoIds: [m('audi-etron')], wantedDate: day(-2) },
    { id: 'AI-1027', createdAt: at(-15), status: 'ready', customerName: 'Irakli S.', customerPhone: '+995 599 08 77 61', channel: 'call', carModel: 'j-fpace', carYear: '2018', services: ['dashboard'], look: { leather: 'black', finish: 'nappa', thread: 'red', seam: 'single' }, photoIds: [m('jaguar')], wantedDate: day(-7) },
    { id: 'AI-1022', createdAt: at(-21), status: 'delivered', customerName: 'Tornike P.', customerPhone: '+995 551 19 02 76', channel: 'whatsapp', carModel: 'bmw-m5', carYear: '2019', services: ['dashboard', 'wheel'], look: { leather: 'black', finish: 'nappa', thread: 'blue', seam: 'double' }, photoIds: [m('bmw-m5')], wantedDate: day(-14) },
  ] as const
  for (const o of orders) {
    await ctx.db.insert(schema.orders).values({ ...o, services: [...o.services], photoIds: o.photoIds.filter(Boolean) as string[], look: { ...o.look } as typeof schema.orders.$inferInsert.look, updatedAt: o.createdAt } as typeof schema.orders.$inferInsert)
  }

  await ctx.db.insert(schema.events).values([
    { id: 'EV-S1', date: day(0), start: '10:00', end: '11:00', title: 'Inspect Cayenne (Davit)', kind: 'appointment', orderId: 'AI-1038' },
    { id: 'EV-S2', date: day(0), start: '16:00', end: '16:30', title: 'Jaguar pickup (Irakli)', kind: 'pickup', orderId: 'AI-1027' },
    { id: 'EV-S3', date: day(1), start: '10:00', end: '11:00', title: 'Bentley GT drop-off (Levan)', kind: 'appointment', orderId: 'AI-1036' },
    { id: 'EV-S4', date: day(2), start: '12:00', end: '13:00', title: 'Leather delivery from Milan', kind: 'delivery' },
    { id: 'EV-S5', date: day(4), start: '11:00', end: '12:00', title: 'Cayenne drop-off (Davit)', kind: 'appointment', orderId: 'AI-1038' },
    { id: 'EV-S6', date: day(5), start: '09:00', end: '19:00', title: 'Workshop full', kind: 'block' },
    { id: 'EV-S7', date: day(8), start: '09:00', end: '19:00', title: 'Workshop full', kind: 'block' },
    { id: 'EV-S8', date: day(12), start: '15:00', end: '16:00', title: 'Range Rover viewing', kind: 'appointment' },
  ])

  await ctx.db.insert(schema.purchaseOrders).values([
    { id: 'PO-2207', contactId: 'S-01', status: 'sent', orderRef: 'AI-1036', sentAt: at(-3), sentVia: 'email', createdAt: at(-3), items: [{ name: 'Nappa, oxblood, 1.1 mm', qty: 4, unit: 'm²', price: 95 }, { name: 'Nappa, black, 1.1 mm', qty: 6, unit: 'm²', price: 92 }] },
    { id: 'PO-2208', contactId: 'S-02', status: 'draft', createdAt: at(-1), items: [{ name: 'Foam 3 mm', qty: 10, unit: 'm²', price: 22 }, { name: 'Contact adhesive', qty: 4, unit: 'can', price: 38 }] },
    { id: 'PO-2201', contactId: 'S-03', status: 'received', sentAt: at(-12), sentVia: 'email', createdAt: at(-12), items: [{ name: 'Bonded nylon, red', qty: 4, unit: 'spool', price: 18 }, { name: 'Bonded nylon, M blue', qty: 4, unit: 'spool', price: 18 }] },
  ])

  await ctx.db.insert(schema.posts).values([
    { id: 'POST-S1', source: 'order', refId: 'AI-1027', mediaId: m('jaguar'), captions: orderCaptions(carLabel('j-fpace'), { leather: 'black', finish: 'nappa', thread: 'red', seam: 'single' }), hashtags: '#ტორპედოსგადაკვრა #autointeriore #tbilisi #jaguar #carinterior', networks: ['instagram', 'facebook', 'tiktok', 'threads', 'gmb'], publishAt: `${day(1)}T19:30`, status: 'approved' },
    { id: 'POST-S2', source: 'order', refId: 'AI-1022', mediaId: m('bmw-m5'), captions: orderCaptions(carLabel('bmw-m5'), { leather: 'black', finish: 'nappa', thread: 'blue', seam: 'double' }), hashtags: '#ტორპედოსგადაკვრა #autointeriore #tbilisi #bmw #carinterior', networks: ['instagram', 'facebook', 'tiktok', 'threads', 'gmb'], publishAt: `${day(-5)}T19:30`, status: 'scheduled' },
  ])
  return true
}
