import type { Key, Lang } from './i18n'

type L10n = Record<Lang, string>

/* ---------- Look / configurator ---------- */
export type Finish = 'nappa' | 'alcantara' | 'perforated'
export type SeamStyle = 'single' | 'double'
export interface Look {
  leather: string // id
  finish: Finish
  thread: string // id
  seam: SeamStyle
}

export const LEATHERS = [
  { id: 'black', name: 'Black', l10n: { ka: 'შავი', en: 'Black', ru: 'Чёрная' }, hex: '#1b1c1e', hi: '#3a3c40' },
  { id: 'graphite', name: 'Graphite', l10n: { ka: 'გრაფიტი', en: 'Graphite', ru: 'Графит' }, hex: '#45484d', hi: '#6c7076' },
  { id: 'cognac', name: 'Cognac', l10n: { ka: 'კონიაკი', en: 'Cognac', ru: 'Коньяк' }, hex: '#7e4523', hi: '#b36c3e' },
  { id: 'oxblood', name: 'Oxblood', l10n: { ka: 'ბორდო', en: 'Oxblood', ru: 'Бордо' }, hex: '#4e1a1e', hi: '#7f3036' },
  { id: 'navy', name: 'Midnight', l10n: { ka: 'მუქი ლურჯი', en: 'Midnight', ru: 'Тёмно-синяя' }, hex: '#1c2638', hi: '#34445f' },
  { id: 'cream', name: 'Cream', l10n: { ka: 'კრემისფერი', en: 'Cream', ru: 'Кремовая' }, hex: '#cfc3ad', hi: '#ece2cf' },
]
export const THREADS = [
  { id: 'yellow', name: 'Yellow', l10n: { ka: 'ყვითელი', en: 'Yellow', ru: 'Жёлтая' }, hex: '#f2c230' },
  { id: 'red', name: 'Red', l10n: { ka: 'წითელი', en: 'Red', ru: 'Красная' }, hex: '#c8322f' },
  { id: 'white', name: 'White', l10n: { ka: 'თეთრი', en: 'White', ru: 'Белая' }, hex: '#e9e5dc' },
  { id: 'blue', name: 'M blue', l10n: { ka: 'M ლურჯი', en: 'M blue', ru: 'Синяя M' }, hex: '#3b74d8' },
  { id: 'tonal', name: 'Tonal', l10n: { ka: 'ტყავის ტონში', en: 'Tonal', ru: 'В тон коже' }, hex: '' },
]
const FINISH_L10N: Record<Finish, L10n> = {
  nappa: { ka: 'ნაპა', en: 'nappa', ru: 'наппа' },
  alcantara: { ka: 'ალკანტარა', en: 'alcantara', ru: 'алькантара' },
  perforated: { ka: 'პერფორირებული', en: 'perforated', ru: 'перфорированная' },
}
export const FINISHES: Finish[] = ['nappa', 'alcantara', 'perforated']
export const DEFAULT_LOOK: Look = { leather: 'black', finish: 'nappa', thread: 'yellow', seam: 'double' }

export const leatherOf = (id: string) => LEATHERS.find((l) => l.id === id) ?? LEATHERS[0]
export const threadOf = (id: string, leather: string) => {
  const t = THREADS.find((x) => x.id === id) ?? THREADS[0]
  return t.hex || leatherOf(leather).hi
}
export const lookLabel = (l: Look, lang: Lang = 'en') => {
  const leather = leatherOf(l.leather)
  const thread = THREADS.find((t) => t.id === l.thread) ?? THREADS[0]
  if (lang === 'ka') return `${leather.l10n.ka} ${FINISH_L10N[l.finish].ka}, ${thread.l10n.ka} ${l.seam === 'double' ? 'ორმაგი' : 'ერთმაგი'} ნაკერი`
  if (lang === 'ru') return `${leather.l10n.ru} ${FINISH_L10N[l.finish].ru}, ${l.seam === 'double' ? 'двойная' : 'одинарная'} строчка, нить: ${thread.l10n.ru.toLowerCase()}`
  return `${leather.name} ${l.finish}, ${thread.name.toLowerCase()} ${l.seam} stitch`
}

/* ---------- Vehicles ---------- */
export interface Model { id: string; name: string; code: string; years: string }
export interface Brand { id: string; name: string; models: Model[] }

export const BRANDS: Brand[] = [
  { id: 'bmw', name: 'BMW', models: [
    { id: 'bmw-x5', name: 'X5', code: 'G05', years: '2018–' },
    { id: 'bmw-x6', name: 'X6', code: 'G06', years: '2019–' },
    { id: 'bmw-x7', name: 'X7', code: 'G07', years: '2019–' },
    { id: 'bmw-m5', name: 'M5', code: 'F90', years: '2017–2024' },
    { id: 'bmw-m6', name: 'M6', code: 'F13', years: '2012–2018' },
    { id: 'bmw-e39', name: '5 Series', code: 'E39', years: '1995–2004' },
  ]},
  { id: 'mercedes', name: 'Mercedes-Benz', models: [
    { id: 'mb-w140', name: 'S-Class', code: 'W140', years: '1991–1998' },
    { id: 'mb-w222', name: 'S-Class', code: 'W222', years: '2013–2020' },
    { id: 'mb-w463', name: 'G-Class', code: 'W463', years: '1990–2018' },
    { id: 'mb-w213', name: 'E-Class', code: 'W213', years: '2016–2023' },
  ]},
  { id: 'porsche', name: 'Porsche', models: [
    { id: 'p-cayenne', name: 'Cayenne', code: '9Y0', years: '2017–' },
    { id: 'p-panamera', name: 'Panamera', code: '971', years: '2016–' },
    { id: 'p-911', name: '911', code: '992', years: '2019–' },
  ]},
  { id: 'audi', name: 'Audi', models: [
    { id: 'a-etron', name: 'e-tron', code: 'GE', years: '2018–2023' },
    { id: 'a-q7', name: 'Q7', code: '4M', years: '2015–' },
    { id: 'a-a6', name: 'A6', code: 'C8', years: '2018–' },
  ]},
  { id: 'bentley', name: 'Bentley', models: [
    { id: 'b-gt', name: 'Continental GT', code: '3S', years: '2018–' },
    { id: 'b-bentayga', name: 'Bentayga', code: '4V', years: '2015–' },
  ]},
  { id: 'jaguar', name: 'Jaguar', models: [
    { id: 'j-fpace', name: 'F-Pace', code: 'X761', years: '2016–' },
    { id: 'j-xf', name: 'XF', code: 'X260', years: '2015–' },
  ]},
  { id: 'landrover', name: 'Land Rover', models: [
    { id: 'lr-rr', name: 'Range Rover', code: 'L405', years: '2012–2021' },
    { id: 'lr-def', name: 'Defender', code: 'L663', years: '2020–' },
  ]},
  { id: 'toyota', name: 'Toyota', models: [
    { id: 't-lc300', name: 'Land Cruiser', code: 'J300', years: '2021–' },
    { id: 't-lc200', name: 'Land Cruiser', code: 'J200', years: '2007–2021' },
  ]},
]
export const modelOf = (id: string) => {
  for (const b of BRANDS) {
    const m = b.models.find((x) => x.id === id)
    if (m) return { brand: b, model: m }
  }
  return undefined
}
export const carLabel = (modelId: string) => {
  const r = modelOf(modelId)
  return r ? `${r.brand.name} ${r.model.name} ${r.model.code}` : modelId
}

/* ---------- Services ---------- */
export const SERVICES: { id: string; key: Key; from: number }[] = [
  { id: 'dashboard', key: 'svc_dashboard', from: 1400 },
  { id: 'wheel', key: 'svc_wheel', from: 350 },
  { id: 'doors', key: 'svc_doors', from: 900 },
  { id: 'console', key: 'svc_console', from: 450 },
  { id: 'airbag', key: 'svc_airbag', from: 250 },
  { id: 'part', key: 'svc_part', from: 0 },
]

/* ---------- Gallery (cropped from his Instagram grid; swap for originals) ---------- */
export const WORK = [
  { img: 'work/bentley.jpg', brand: 'bentley', title: 'Bentley', what: 'Dashboard, black nappa', l10n: { ka: 'ტორპედო, შავი ნაპა', ru: 'Торпеда, чёрная наппа' } },
  { img: 'work/bmw-x6.jpg', brand: 'bmw', title: 'BMW X6', what: 'Dashboard upper, stitched', l10n: { ka: 'ტორპედოს ზედა ნაწილი, ნაკერით', ru: 'Верх торпеды, прострочен' } },
  { img: 'work/audi-etron.jpg', brand: 'audi', title: 'Audi e-tron', what: 'Full dashboard', l10n: { ka: 'მთლიანი ტორპედო', ru: 'Торпеда целиком' } },
  { img: 'work/porsche-cayenne.jpg', brand: 'porsche', title: 'Porsche Cayenne', what: 'Dashboard on the bench', l10n: { ka: 'ტორპედო სახელოსნოში', ru: 'Торпеда на верстаке' } },
  { img: 'work/bmw-m5.jpg', brand: 'bmw', title: 'BMW M5', what: 'Stripped & prepped', l10n: { ka: 'გასუფთავებული და მომზადებული', ru: 'Очищена и подготовлена' } },
  { img: 'work/bmw-m6-finish.jpg', brand: 'bmw', title: 'BMW M6', what: 'Finished hood', l10n: { ka: 'დასრულებული კოზირეკი', ru: 'Готовый козырёк' } },
  { img: 'work/bmw-m6.jpg', brand: 'bmw', title: 'BMW M6', what: 'Instrument hood, grey stitch', l10n: { ka: 'ხელსაწყოების კოზირეკი, ნაცრისფერი ნაკერი', ru: 'Козырёк приборов, серая строчка' } },
  { img: 'work/bmw-wheel.jpg', brand: 'bmw', title: 'BMW M wheel', titleL10n: { ka: 'BMW M საჭე', ru: 'Руль BMW M' }, what: 'Steering wheel', l10n: { ka: 'საჭე', ru: 'Руль' } },
  { img: 'work/mercedes-w140.jpg', brand: 'mercedes', title: 'Mercedes W140', what: 'Dashboard, nappa', l10n: { ka: 'ტორპედო, ნაპა', ru: 'Торпеда, наппа' } },
  { img: 'work/bmw-x7.jpg', brand: 'bmw', title: 'BMW X7', what: 'Dashboard centre seam', l10n: { ka: 'ტორპედოს ცენტრალური ნაკერი', ru: 'Центральный шов торпеды' } },
  { img: 'work/jaguar.jpg', brand: 'jaguar', title: 'Jaguar', what: 'Red contrast stitch', l10n: { ka: 'წითელი კონტრასტული ნაკერი', ru: 'Красная контрастная строчка' } },
  { img: 'work/workshop-detail.jpg', brand: 'bmw', title: 'Workshop', titleL10n: { ka: 'სახელოსნო', ru: 'Мастерская' }, what: 'Hood detail', l10n: { ka: 'კოზირეკის დეტალი', ru: 'Деталь козырька' } },
]

export const INSTAGRAM = 'https://www.instagram.com/autointeriore/'
export const PHONE_DISPLAY = '558 65 72 97'
export const WHATSAPP = '995558657297'

/* ---------- Admin entities ---------- */
export type OrderStatus = 'new' | 'quoted' | 'scheduled' | 'workshop' | 'ready' | 'delivered'
export const ORDER_FLOW: { id: OrderStatus; label: string }[] = [
  { id: 'new', label: 'New request' },
  { id: 'quoted', label: 'Quoted' },
  { id: 'scheduled', label: 'Booked in' },
  { id: 'workshop', label: 'In workshop' },
  { id: 'ready', label: 'Ready' },
  { id: 'delivered', label: 'Delivered' },
]

export interface QuoteLine { label: string; qty: number; unit: string; price: number }
export interface Quote { lines: QuoteLine[]; labourHours: number; rate: number; margin: number; vat: boolean; total: number }

export interface Order {
  id: string
  createdAt: string
  status: OrderStatus
  customer: { name: string; phone: string; channel: 'whatsapp' | 'viber' | 'telegram' | 'call' }
  car: { model: string; year: string }
  services: string[]
  look?: Look
  parts: string[]
  photos: string[]
  date?: string
  note?: string
  quote?: Quote
}

export type SupplierKind = 'supplier' | 'dealer' | 'partner'
export interface Supplier {
  id: string; name: string; kind: SupplierKind; category: string
  contact: string; phone: string; email: string; city: string; leadDays: number
}

export interface POItem { name: string; qty: number; unit: string; price: number }
export interface PurchaseOrder {
  id: string; supplierId: string; createdAt: string; status: 'draft' | 'sent' | 'received'
  items: POItem[]; orderRef?: string; note?: string
}

export interface CalEvent {
  id: string; date: string; start: string; end: string; title: string
  kind: 'appointment' | 'pickup' | 'delivery' | 'block'; orderId?: string
}

export type PartKind = 'dashboard' | 'wheel' | 'door' | 'console' | 'glovebox'
export const PART_KIND_LABEL: Record<PartKind, string> = {
  dashboard: 'Dashboard', wheel: 'Steering wheel', door: 'Door card', console: 'Centre console', glovebox: 'Glovebox lid',
}
export const PART_KIND_L10N: Record<PartKind, L10n> = {
  dashboard: { ka: 'ტორპედო', en: 'Dashboard', ru: 'Торпеда' },
  wheel: { ka: 'საჭე', en: 'Steering wheel', ru: 'Руль' },
  door: { ka: 'კარის პანელი', en: 'Door card', ru: 'Карта двери' },
  console: { ka: 'ცენტრალური კონსოლი', en: 'Centre console', ru: 'Центральная консоль' },
  glovebox: { ka: 'ხელთათმანების ყუთის სახურავი', en: 'Glovebox lid', ru: 'Крышка бардачка' },
}
export interface Part {
  id: string; model: string; kind: PartKind; condition: 'exchange' | 'used' | 'new'
  title: string; price: number; stock: number; published: boolean; img?: string
  /** optional Georgian / Russian title for the website; falls back to `title` */
  titles?: Partial<L10n>
}
export const partTitle = (p: Part, lang: Lang) => p.titles?.[lang] ?? p.title

export type Network = 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'gmb' | 'threads'
export const NETWORKS: { id: Network; label: string }[] = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'youtube', label: 'YouTube Shorts' },
  { id: 'threads', label: 'Threads' },
  { id: 'gmb', label: 'Google Business' },
]
export interface Post {
  id: string; source: 'order' | 'part' | 'manual'; refId?: string; img?: string
  captions: { ka: string; en: string; ru: string }; hashtags: string
  networks: Network[]; date: string; status: 'draft' | 'approved' | 'scheduled'
}

/* ---------- Calculator price list ---------- */
export const MATERIALS = [
  { id: 'nappa', label: 'Nappa leather', unit: 'm²', price: 95 },
  { id: 'alcantara', label: 'Alcantara', unit: 'm²', price: 120 },
  { id: 'perf', label: 'Perforated nappa', unit: 'm²', price: 110 },
  { id: 'foam', label: 'Foam 3 mm', unit: 'm²', price: 22 },
  { id: 'thread', label: 'Bonded nylon thread', unit: 'spool', price: 18 },
  { id: 'glue', label: 'Contact adhesive', unit: 'can', price: 38 },
  { id: 'clips', label: 'Clips & fixings', unit: 'set', price: 25 },
]
export const JOB_TEMPLATES: Record<string, { label: string; lines: { mat: string; qty: number }[]; hours: number }> = {
  dashboard: { label: 'Full dashboard', lines: [{ mat: 'nappa', qty: 3.2 }, { mat: 'foam', qty: 2.5 }, { mat: 'thread', qty: 1 }, { mat: 'glue', qty: 1 }, { mat: 'clips', qty: 1 }], hours: 18 },
  upper: { label: 'Upper dash only', lines: [{ mat: 'nappa', qty: 1.8 }, { mat: 'foam', qty: 1.4 }, { mat: 'thread', qty: 1 }, { mat: 'glue', qty: 1 }], hours: 10 },
  wheel: { label: 'Steering wheel', lines: [{ mat: 'nappa', qty: 0.4 }, { mat: 'thread', qty: 0.5 }, { mat: 'glue', qty: 0.3 }], hours: 5 },
  doors: { label: 'Door cards (4)', lines: [{ mat: 'nappa', qty: 2.6 }, { mat: 'foam', qty: 2 }, { mat: 'thread', qty: 1 }, { mat: 'glue', qty: 1 }], hours: 14 },
}
export const DEFAULT_RATE = 45
export const VAT = 0.18

export function quoteTotal(q: Omit<Quote, 'total'>) {
  const mat = q.lines.reduce((s, l) => s + l.qty * l.price, 0)
  const net = (mat + q.labourHours * q.rate) * (1 + q.margin / 100)
  return Math.round(net * (q.vat ? 1 + VAT : 1))
}
export const gel = (n: number) => `${n.toLocaleString('en-US', { maximumFractionDigits: 0 })} ₾`
