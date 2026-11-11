import { create } from 'zustand'
import { apiMode, api, uploadImage, dataUrlToBlob, loadAdminData, loadPublicData, toPart, toPO, toPost, toSupplier, fromPart, fromSupplier, fromEvent, type GalleryItem, type ServerContact, type ServerPart, type ServerPO, type ServerPost } from './api'
import { useLang } from './i18n'
import { persist } from 'zustand/middleware'
import {
  type CalEvent, type Look, type Order, type Part, type Post, type PurchaseOrder, type Supplier,
  DEFAULT_LOOK, carLabel, leatherOf, THREADS, modelOf, PART_KIND_LABEL, WORK,
} from './data'

export const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
export const day = (offset: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

/* ---------- seed data: plausible, clearly fictional ---------- */
function seed() {
  const orders: Order[] = [
    { id: 'AI-1041', createdAt: day(-1), status: 'new', customer: { name: 'Giorgi M.', phone: '+995 599 11 22 33', channel: 'whatsapp' },
      car: { model: 'bmw-x5', year: '2020' }, services: ['dashboard'], look: { leather: 'black', finish: 'nappa', thread: 'blue', seam: 'double' },
      parts: [], photos: ['work/bmw-x6.jpg'], date: day(6), note: 'Cracked above the airbag after the sun.' },
    { id: 'AI-1040', createdAt: day(-2), status: 'new', customer: { name: 'Nino K.', phone: '+995 577 40 18 90', channel: 'whatsapp' },
      car: { model: 'mb-w140', year: '1996' }, services: ['dashboard', 'wheel'], look: { leather: 'cream', finish: 'nappa', thread: 'tonal', seam: 'single' },
      parts: [], photos: ['work/mercedes-w140.jpg'], date: day(9) },
    { id: 'AI-1038', createdAt: day(-4), status: 'quoted', customer: { name: 'Davit T.', phone: '+995 555 70 03 41', channel: 'telegram' },
      car: { model: 'p-cayenne', year: '2021' }, services: ['dashboard'], look: { leather: 'black', finish: 'nappa', thread: 'red', seam: 'double' },
      parts: [], photos: ['work/porsche-cayenne.jpg'], date: day(4),
      quote: { lines: [{ label: 'Nappa leather', qty: 3.2, unit: 'm²', price: 95 }, { label: 'Foam 3 mm', qty: 2.5, unit: 'm²', price: 22 }], labourHours: 18, rate: 45, margin: 25, vat: true, total: 1749 } },
    { id: 'AI-1036', createdAt: day(-6), status: 'scheduled', customer: { name: 'Levan B.', phone: '+995 591 22 87 15', channel: 'whatsapp' },
      car: { model: 'b-gt', year: '2019' }, services: ['dashboard', 'console'], look: { leather: 'oxblood', finish: 'nappa', thread: 'white', seam: 'double' },
      parts: [], photos: ['work/bentley.jpg'], date: day(1) },
    { id: 'AI-1033', createdAt: day(-9), status: 'workshop', customer: { name: 'Sandro J.', phone: '+995 568 33 90 12', channel: 'viber' },
      car: { model: 'bmw-m6', year: '2015' }, services: ['dashboard'], look: { leather: 'black', finish: 'nappa', thread: 'white', seam: 'double' },
      parts: [], photos: ['work/bmw-m6.jpg'], date: day(-3) },
    { id: 'AI-1031', createdAt: day(-11), status: 'workshop', customer: { name: 'Ana G.', phone: '+995 593 61 44 08', channel: 'whatsapp' },
      car: { model: 'a-etron', year: '2020' }, services: ['dashboard'], look: { leather: 'graphite', finish: 'alcantara', thread: 'tonal', seam: 'single' },
      parts: [], photos: ['work/audi-etron.jpg'], date: day(-2) },
    { id: 'AI-1027', createdAt: day(-15), status: 'ready', customer: { name: 'Irakli S.', phone: '+995 599 08 77 61', channel: 'call' },
      car: { model: 'j-fpace', year: '2018' }, services: ['dashboard'], look: { leather: 'black', finish: 'nappa', thread: 'red', seam: 'single' },
      parts: [], photos: ['work/jaguar.jpg'], date: day(-7) },
    { id: 'AI-1022', createdAt: day(-21), status: 'delivered', customer: { name: 'Tornike P.', phone: '+995 551 19 02 76', channel: 'whatsapp' },
      car: { model: 'bmw-m5', year: '2019' }, services: ['dashboard', 'wheel'], look: { leather: 'black', finish: 'nappa', thread: 'blue', seam: 'double' },
      parts: [], photos: ['work/bmw-m5.jpg'], date: day(-14) },
  ]

  const suppliers: Supplier[] = [
    { id: 'S-01', name: 'Pelle Italia Trading', kind: 'supplier', category: 'Nappa & Alcantara', contact: 'Marco R.', phone: '+39 02 555 0142', email: 'orders@example-pelle.it', city: 'Milan', leadDays: 9 },
    { id: 'S-02', name: 'Kartli Foam & Glue', kind: 'supplier', category: 'Foam, adhesives', contact: 'Zura A.', phone: '+995 32 2 55 01 90', email: 'sales@example-kartli.ge', city: 'Tbilisi', leadDays: 1 },
    { id: 'S-03', name: 'Amann Thread (dealer)', kind: 'supplier', category: 'Thread', contact: 'Office', phone: '+90 212 555 0110', email: 'tr@example-thread.com', city: 'Istanbul', leadDays: 6 },
    { id: 'D-01', name: 'Eliava Parts Row 14', kind: 'dealer', category: 'Used dashboards & cores', contact: 'Beso', phone: '+995 599 44 10 10', email: '—', city: 'Tbilisi', leadDays: 0 },
    { id: 'D-02', name: 'Autopapa Import', kind: 'dealer', category: 'German & Japanese parts', contact: 'Mariam', phone: '+995 577 10 20 30', email: 'parts@example-autopapa.ge', city: 'Rustavi', leadDays: 3 },
    { id: 'P-01', name: 'Premium Detailing Saburtalo', kind: 'partner', category: 'Sends customers', contact: 'Nika', phone: '+995 555 12 12 34', email: 'hello@example-detail.ge', city: 'Tbilisi', leadDays: 0 },
  ]

  const pos: PurchaseOrder[] = [
    { id: 'PO-2207', supplierId: 'S-01', createdAt: day(-3), status: 'sent', orderRef: 'AI-1036',
      items: [{ name: 'Nappa, oxblood, 1.1 mm', qty: 4, unit: 'm²', price: 95 }, { name: 'Nappa, black, 1.1 mm', qty: 6, unit: 'm²', price: 92 }] },
    { id: 'PO-2208', supplierId: 'S-02', createdAt: day(-1), status: 'draft',
      items: [{ name: 'Foam 3 mm', qty: 10, unit: 'm²', price: 22 }, { name: 'Contact adhesive', qty: 4, unit: 'can', price: 38 }] },
    { id: 'PO-2201', supplierId: 'S-03', createdAt: day(-12), status: 'received',
      items: [{ name: 'Bonded nylon, red', qty: 4, unit: 'spool', price: 18 }, { name: 'Bonded nylon, M blue', qty: 4, unit: 'spool', price: 18 }] },
  ]

  const events: CalEvent[] = [
    { id: uid('E'), date: day(0), start: '10:00', end: '11:00', title: 'Inspect Cayenne (Davit)', kind: 'appointment', orderId: 'AI-1038' },
    { id: uid('E'), date: day(0), start: '16:00', end: '16:30', title: 'Jaguar pickup (Irakli)', kind: 'pickup', orderId: 'AI-1027' },
    { id: uid('E'), date: day(1), start: '10:00', end: '11:00', title: 'Bentley GT drop-off (Levan)', kind: 'appointment', orderId: 'AI-1036' },
    { id: uid('E'), date: day(2), start: '12:00', end: '13:00', title: 'Leather delivery from Milan', kind: 'delivery' },
    { id: uid('E'), date: day(4), start: '11:00', end: '12:00', title: 'Cayenne drop-off (Davit)', kind: 'appointment', orderId: 'AI-1038' },
    { id: uid('E'), date: day(5), start: '09:00', end: '19:00', title: 'Workshop full', kind: 'block' },
    { id: uid('E'), date: day(8), start: '09:00', end: '19:00', title: 'Workshop full', kind: 'block' },
    { id: uid('E'), date: day(12), start: '15:00', end: '16:00', title: 'Range Rover viewing', kind: 'appointment' },
  ]

  const parts: Part[] = [
    { id: 'PT-01', model: 'bmw-x6', kind: 'dashboard', condition: 'exchange', title: 'Dashboard, black nappa, double stitch', titles: { ka: 'ტორპედო, შავი ნაპა, ორმაგი ნაკერი', ru: 'Торпеда, чёрная наппа, двойная строчка' }, price: 2400, stock: 1, published: true, img: 'work/bmw-x6.jpg' },
    { id: 'PT-02', model: 'bmw-m6', kind: 'dashboard', condition: 'exchange', title: 'Dashboard upper, black nappa, grey stitch', titles: { ka: 'ტორპედოს ზედა ნაწილი, შავი ნაპა, ნაცრისფერი ნაკერი', ru: 'Верх торпеды, чёрная наппа, серая строчка' }, price: 2100, stock: 1, published: true, img: 'work/bmw-m6-finish.jpg' },
    { id: 'PT-03', model: 'bmw-e39', kind: 'wheel', condition: 'exchange', title: 'M sport wheel, re-trimmed nappa', titles: { ka: 'M Sport საჭე, გადაკრული ნაპით', ru: 'Руль M Sport, перетянут наппой' }, price: 480, stock: 2, published: true, img: 'work/bmw-wheel.jpg' },
    { id: 'PT-04', model: 'mb-w140', kind: 'dashboard', condition: 'used', title: 'Dashboard core, no cracks', titles: { ka: 'ტორპედოს ბაზა, ბზარების გარეშე', ru: 'Основа торпеды, без трещин' }, price: 650, stock: 1, published: true, img: 'work/mercedes-w140.jpg' },
    { id: 'PT-05', model: 'p-cayenne', kind: 'dashboard', condition: 'exchange', title: 'Dashboard, black nappa, red stitch', titles: { ka: 'ტორპედო, შავი ნაპა, წითელი ნაკერი', ru: 'Торпеда, чёрная наппа, красная строчка' }, price: 2900, stock: 1, published: true, img: 'work/porsche-cayenne.jpg' },
    { id: 'PT-06', model: 'a-etron', kind: 'dashboard', condition: 'used', title: 'Dashboard core with airbag lid', titles: { ka: 'ტორპედოს ბაზა ეარბეგის სახურავით', ru: 'Основа торпеды с крышкой подушки' }, price: 1100, stock: 1, published: true, img: 'work/audi-etron.jpg' },
    { id: 'PT-07', model: 'j-fpace', kind: 'dashboard', condition: 'exchange', title: 'Dashboard, black, red contrast stitch', titles: { ka: 'ტორპედო, შავი, წითელი კონტრასტული ნაკერი', ru: 'Торпеда, чёрная, красная контрастная строчка' }, price: 2300, stock: 0, published: true, img: 'work/jaguar.jpg' },
    { id: 'PT-08', model: 'bmw-x7', kind: 'dashboard', condition: 'used', title: 'Dashboard core, centre seam intact', titles: { ka: 'ტორპედოს ბაზა, ცენტრალური ნაკერი მთელია', ru: 'Основа торпеды, центральный шов цел' }, price: 1500, stock: 1, published: false, img: 'work/bmw-x7.jpg' },
    { id: 'PT-09', model: 'mb-w463', kind: 'glovebox', condition: 'exchange', title: 'Glovebox lid, cognac nappa', titles: { ka: 'ხელთათმანების ყუთის სახურავი, კონიაკისფერი ნაპა', ru: 'Крышка бардачка, коньячная наппа' }, price: 390, stock: 1, published: true },
    { id: 'PT-10', model: 'lr-rr', kind: 'console', condition: 'exchange', title: 'Centre armrest, black perforated', titles: { ka: 'ცენტრალური საიდაყვე, შავი პერფორირებული', ru: 'Центральный подлокотник, чёрный перфорированный' }, price: 520, stock: 1, published: true },
  ]

  const posts: Post[] = [
    makePost(orders[6], day(1) + 'T19:30', 'approved'),
    makePost(orders[7], day(-5) + 'T19:30', 'scheduled'),
    makePartPost(parts[2], day(3) + 'T13:00'),
  ]
  return { orders, suppliers, pos, events, parts, posts }
}

/* ---------- content generation (what the pipeline would feed to Metricool) ---------- */
const threadName = (id: string) => (THREADS.find((t) => t.id === id) ?? THREADS[0]).name.toLowerCase()
const KA_LEATHER: Record<string, string> = { black: 'შავი', graphite: 'გრაფიტისფერი', cognac: 'კონიაკისფერი', oxblood: 'მუქი ბორდოსფერი', navy: 'მუქი ლურჯი', cream: 'კრემისფერი' }
const KA_THREAD: Record<string, string> = { yellow: 'ყვითელი', red: 'წითელი', white: 'თეთრი', blue: 'ლურჯი', tonal: 'ტყავის ფერის' }
const KA_FINISH: Record<string, string> = { nappa: 'ნაპა', alcantara: 'ალკანტარა', perforated: 'პერფორირებული ტყავი' }
const RU_LEATHER: Record<string, string> = { black: 'чёрная', graphite: 'графитовая', cognac: 'коньячная', oxblood: 'бордовая', navy: 'тёмно-синяя', cream: 'кремовая' }
const RU_THREAD: Record<string, string> = { yellow: 'жёлтой', red: 'красной', white: 'белой', blue: 'синей', tonal: 'тон-в-тон' }
const RU_FINISH: Record<string, string> = { nappa: 'наппа', alcantara: 'алькантара', perforated: 'перфорированная кожа' }

export function makePost(o: Order, date: string, status: Post['status'] = 'draft'): Post {
  const car = carLabel(o.car.model)
  const lk = o.look
  const leather = lk ? `${leatherOf(lk.leather).name.toLowerCase()} ${lk.finish}` : 'nappa'
  const stitch = lk ? `${threadName(lk.thread)} ${lk.seam} stitch` : 'hand stitching'
  const leatherKa = lk ? `${KA_LEATHER[lk.leather]} ${KA_FINISH[lk.finish]}` : 'ნაპა'
  const stitchKa = lk ? `${KA_THREAD[lk.thread]} ${lk.seam === 'double' ? 'ორმაგი' : 'ერთმაგი'} ნაკერი` : 'ხელით ნაკერი'
  const leatherRu = lk ? `${RU_LEATHER[lk.leather]} ${RU_FINISH[lk.finish]}` : 'наппа'
  const stitchRu = lk ? `${lk.seam === 'double' ? 'двойная' : 'одинарная'} строчка ${RU_THREAD[lk.thread]} нитью` : 'ручная строчка'
  const brand = modelOf(o.car.model)?.brand.name ?? ''
  return {
    id: uid('POST'), source: 'order', refId: o.id, img: o.photos[0], date, status,
    networks: ['instagram', 'facebook', 'tiktok', 'threads', 'gmb'],
    captions: {
      ka: `${car} — ტორპედო გადაკრულია: ${leatherKa}, ${stitchKa}. ხელით ნაკერი, თბილისში. 📍 ჩაწერა: 558 65 72 97`,
      en: `${car} — dashboard re-trimmed in ${leather} with ${stitch}. Hand-sewn in Tbilisi. Book: +995 558 65 72 97`,
      ru: `${car} — торпеда перетянута: ${leatherRu}, ${stitchRu}. Ручная работа, Тбилиси. Запись: +995 558 65 72 97`,
    },
    hashtags: `#ტორპედოსგადაკვრა #autointeriore #tbilisi #${brand.replace(/[^a-z]/gi, '').toLowerCase()} #carinterior #leatherdashboard #перетяжкаторпедо`,
  }
}
export function makePartPost(p: Part, date: string): Post {
  const car = carLabel(p.model)
  return {
    id: uid('POST'), source: 'part', refId: p.id, img: p.img, date, status: 'draft',
    networks: ['instagram', 'facebook', 'threads'],
    captions: {
      ka: `გაყიდვაშია: ${car} — ${PART_KIND_LABEL[p.kind]}. ${p.price} ₾. მიწერეთ WhatsApp-ზე.`,
      en: `For sale: ${car} — ${PART_KIND_LABEL[p.kind].toLowerCase()}, ${p.title.toLowerCase()}. ${p.price} ₾. Message us on WhatsApp.`,
      ru: `В продаже: ${car} — ${PART_KIND_LABEL[p.kind].toLowerCase()}. ${p.price} ₾. Пишите в WhatsApp.`,
    },
    hashtags: '#autointeriore #tbilisi #carparts #ავტონაწილები #запчасти',
  }
}

/* ---------- store ---------- */
type Data = ReturnType<typeof seed>
type Key = 'suppliers' | 'pos' | 'events' | 'parts' | 'posts'

/** The gallery of the self-contained demo (no backend): built from the bundled images. */
const localGallery = (): GalleryItem[] => WORK.map((w, i) => ({
  id: `GAL-LOCAL${i}`, brand: w.brand, focus: '50% 50%', published: true, image: w.img,
  title: { en: w.title, ka: ('titleL10n' in w ? (w.titleL10n as { ka: string }).ka : w.title), ru: ('titleL10n' in w ? (w.titleL10n as { ru: string }).ru : w.title) },
  caption: { en: w.what, ka: w.l10n.ka, ru: w.l10n.ru },
}))

interface State extends Data {
  gallery: GalleryItem[]
  /** true once the current view has its data (always true in the local demo) */
  ready: boolean
  /** last failed write/read, shown as a toast in the admin */
  error: string | null
  clearError: () => void
  // visitor-side scratch state
  look: Look
  cart: string[]
  setLook: (l: Look) => void
  toggleCart: (partId: string) => void
  clearCart: () => void
  // loading (API mode)
  loadPublic: () => Promise<void>
  loadAdmin: () => Promise<void>
  // writes — the same calls work against the API and the local demo
  addOrder: (o: Order) => Promise<string>
  updateOrder: (id: string, patch: Partial<Order>) => Promise<void>
  bookOrder: (id: string, date: string, start: string) => Promise<void>
  upsert: <K extends Key>(key: K, item: Data[K][number]) => Promise<Data[K][number] | undefined>
  remove: (key: Key, id: string) => Promise<void>
  createPost: (source: 'order' | 'part' | 'gallery', refId: string) => Promise<void>
  generatePosts: () => Promise<number>
  saveGalleryItem: (g: Partial<GalleryItem> & { id?: string; file?: Blob }) => Promise<void>
  removeGalleryItem: (id: string) => Promise<void>
  resetDemo: () => void
}

const ENDPOINT: Record<Key, string> = { suppliers: '/admin/contacts', pos: '/admin/purchase-orders', events: '/admin/events', parts: '/admin/parts', posts: '/admin/posts' }

export const useStore = create<State>()(
  persist(
    (set, get) => {
      /** run an API write, reload the admin data, surface errors */
      const write = async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
        try {
          const r = await fn()
          await get().loadAdmin()
          return r
        } catch (e) {
          set({ error: e instanceof Error ? e.message : String(e) })
          return undefined
        }
      }
      const localUpsert = <K extends Key>(key: K, item: Data[K][number]) =>
        set((s) => {
          const list = s[key] as { id: string }[]
          const exists = list.some((x) => x.id === item.id)
          return { [key]: exists ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list] } as Partial<State>
        })

      return {
        ...seed(),
        gallery: localGallery(),
        ready: !apiMode,
        error: null,
        clearError: () => set({ error: null }),
        look: DEFAULT_LOOK,
        cart: [],
        setLook: (look) => set({ look }),
        toggleCart: (id) => set((s) => ({ cart: s.cart.includes(id) ? s.cart.filter((x) => x !== id) : [...s.cart, id] })),
        clearCart: () => set({ cart: [] }),

        loadPublic: async () => {
          if (!apiMode) return
          try { set({ ...(await loadPublicData()), ready: true }) } catch (e) { set({ error: e instanceof Error ? e.message : String(e), ready: true }) }
        },
        loadAdmin: async () => {
          if (!apiMode) return
          set({ ...(await loadAdminData()), ready: true })
        },

        addOrder: async (o) => {
          if (!apiMode) { set((s) => ({ orders: [o, ...s.orders] })); return o.id }
          // customer photos are uploaded first, the booking references them
          const photoIds = []
          for (const p of o.photos) photoIds.push((await uploadImage(await dataUrlToBlob(p), 'public')).id)
          const r = await api<{ id: string }>('/public/orders', { method: 'POST', json: {
            customerName: o.customer.name, customerPhone: o.customer.phone, channel: o.customer.channel,
            carModel: o.car.model, carYear: o.car.year, services: o.services, look: o.look ?? null, partIds: o.parts, photoIds,
            wantedDate: o.date, note: o.note, lang: useLang.getState().lang,
          } })
          return r.id
        },

        updateOrder: async (id, patch) => {
          if (!apiMode) { set((s) => ({ orders: s.orders.map((o) => (o.id === id ? { ...o, ...patch } : o)) })); return }
          await write(async () => {
            if (patch.quote) {
              const { lines, labourHours, rate, margin, vat } = patch.quote
              await api(`/admin/orders/${id}/quote`, { method: 'POST', json: { lines, labourHours, rate, margin, vat } })
            }
            if (patch.status) await api(`/admin/orders/${id}/status`, { method: 'PATCH', json: { status: patch.status } })
            if (patch.note !== undefined) await api(`/admin/orders/${id}/note`, { method: 'PATCH', json: { note: patch.note } })
          })
        },

        bookOrder: async (id, date, start) => {
          if (!apiMode) {
            const o = get().orders.find((x) => x.id === id)!
            localUpsert('events', { id: uid('E'), date, start, end: `${String(Number(start.slice(0, 2)) + 1).padStart(2, '0')}${start.slice(2)}`, title: `${carLabel(o.car.model)} drop-off (${o.customer.name})`, kind: 'appointment', orderId: id })
            set((s) => ({ orders: s.orders.map((x) => (x.id === id ? { ...x, status: 'scheduled', date } : x)) }))
            return
          }
          await write(() => api(`/admin/orders/${id}/book`, { method: 'POST', json: { date, start } }))
        },

        upsert: async (key, item) => {
          if (!apiMode) { localUpsert(key, item); return item }
          const old = (get()[key] as { id: string }[]).find((x) => x.id === item.id)
          return write(async () => {
            switch (key) {
              case 'parts': {
                const p = item as Part
                const r = await api<ServerPart>(old ? `/admin/parts/${p.id}` : '/admin/parts', { method: old ? 'PATCH' : 'POST', json: fromPart(p) })
                return toPart(r) as Data[typeof key][number]
              }
              case 'suppliers': {
                const r = await api<ServerContact>('/admin/contacts', { method: 'POST', json: fromSupplier(item as Supplier, !old) })
                return toSupplier(r) as Data[typeof key][number]
              }
              case 'events': {
                const r = await api<CalEvent>('/admin/events', { method: 'POST', json: fromEvent(item as CalEvent) })
                return r as Data[typeof key][number]
              }
              case 'pos': {
                const po = item as PurchaseOrder
                const prev = old as PurchaseOrder | undefined
                if (!prev) {
                  const r = await api<ServerPO>('/admin/purchase-orders', { method: 'POST', json: { contactId: po.supplierId, items: po.items.filter((i) => i.name), orderRef: po.orderRef, note: po.note } })
                  return toPO(r) as Data[typeof key][number]
                }
                if (po.status !== prev.status) {
                  const r = await api<ServerPO>(`/admin/purchase-orders/${po.id}/mark`, { method: 'POST', json: { status: po.status, via: po.status === 'sent' ? 'email-app' : undefined } })
                  return toPO(r) as Data[typeof key][number]
                }
                const items = po.items.filter((i) => i.name)
                const r = await api<ServerPO>(`/admin/purchase-orders/${po.id}`, { method: 'PATCH', json: { items: items.length ? items : undefined, orderRef: po.orderRef ?? null, note: po.note ?? null } })
                return toPO(r) as Data[typeof key][number]
              }
              case 'posts': {
                const p = item as Post
                const prev = old as Post | undefined
                if (prev && p.status !== prev.status) {
                  if (p.status === 'approved') await api(`/admin/posts/${p.id}/approve`, { method: 'POST' })
                  else if (p.status === 'scheduled') await api(`/admin/posts/${p.id}/schedule`, { method: 'POST', json: { lang: 'ka' } })
                  return p as Data[typeof key][number]
                }
                const r = await api<ServerPost>(`/admin/posts/${p.id}`, { method: 'PATCH', json: { captions: p.captions, hashtags: p.hashtags, networks: p.networks, publishAt: p.date } })
                return toPost(r) as Data[typeof key][number]
              }
            }
          })
        },

        remove: async (key, id) => {
          if (!apiMode) { set((s) => ({ [key]: (s[key] as { id: string }[]).filter((x) => x.id !== id) }) as Partial<State>); return }
          await write(() => api(`${ENDPOINT[key]}/${id}`, { method: 'DELETE' }))
        },

        createPost: async (source, refId) => {
          if (!apiMode) {
            if (source === 'order') { const o = get().orders.find((x) => x.id === refId); if (o) localUpsert('posts', makePost(o, day(1) + 'T19:30')) }
            if (source === 'part') { const p = get().parts.find((x) => x.id === refId); if (p) localUpsert('posts', makePartPost(p, day(2) + 'T13:00')) }
            return
          }
          await write(() => api('/admin/posts', { method: 'POST', json: { source, refId } }))
        },

        generatePosts: async () => {
          if (!apiMode) {
            const s = get()
            const todo = s.orders.filter((o) => (o.status === 'ready' || o.status === 'delivered') && !s.posts.some((p) => p.refId === o.id))
            todo.forEach((o, i) => localUpsert('posts', makePost(o, day(i + 2) + 'T19:30')))
            return todo.length
          }
          const r = await write(() => api<unknown[]>('/admin/posts/generate', { method: 'POST' }))
          return r?.length ?? 0
        },

        saveGalleryItem: async (g) => {
          if (!apiMode) {
            const image = g.file ? URL.createObjectURL(g.file) : g.image
            const item = { ...(get().gallery.find((x) => x.id === g.id) ?? { id: uid('GAL'), focus: '50% 50%', published: true }), ...g, image } as GalleryItem
            set((s) => ({ gallery: s.gallery.some((x) => x.id === item.id) ? s.gallery.map((x) => (x.id === item.id ? item : x)) : [item, ...s.gallery] }))
            return
          }
          await write(async () => {
            const body = { brand: g.brand, title: g.title, caption: g.caption, focus: g.focus, published: g.published }
            if (g.id) return api(`/admin/gallery/${g.id}`, { method: 'PATCH', json: body })
            const media = await uploadImage(g.file!, 'admin')
            return api('/admin/gallery', { method: 'POST', json: { ...body, media_id: media.id } })
          })
        },
        removeGalleryItem: async (id) => {
          if (!apiMode) { set((s) => ({ gallery: s.gallery.filter((x) => x.id !== id) })); return }
          await write(() => api(`/admin/gallery/${id}`, { method: 'DELETE' }))
        },

        resetDemo: () => set({ ...seed(), gallery: localGallery(), look: DEFAULT_LOOK, cart: [] }),
      }
    },
    {
      name: 'autointeriore-demo-v2',
      // with a backend, only the visitor's own choices stay in the browser
      partialize: (s) => (apiMode ? { look: s.look, cart: s.cart } : { ...s, error: null }) as Partial<State>,
    },
  ),
)
