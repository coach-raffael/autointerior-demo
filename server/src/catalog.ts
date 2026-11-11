/*
  Reference data the server validates against. Mirrors src/data.ts in the web app
  (makes, models, services, materials). Keep both in sync when adding a model.
*/

export const BRANDS: { id: string; name: string; models: { id: string; name: string; code: string }[] }[] = [
  { id: 'bmw', name: 'BMW', models: [
    { id: 'bmw-x5', name: 'X5', code: 'G05' }, { id: 'bmw-x6', name: 'X6', code: 'G06' }, { id: 'bmw-x7', name: 'X7', code: 'G07' },
    { id: 'bmw-m5', name: 'M5', code: 'F90' }, { id: 'bmw-m6', name: 'M6', code: 'F13' }, { id: 'bmw-e39', name: '5 Series', code: 'E39' },
  ] },
  { id: 'mercedes', name: 'Mercedes-Benz', models: [
    { id: 'mb-w140', name: 'S-Class', code: 'W140' }, { id: 'mb-w222', name: 'S-Class', code: 'W222' },
    { id: 'mb-w463', name: 'G-Class', code: 'W463' }, { id: 'mb-w213', name: 'E-Class', code: 'W213' },
    { id: 'mb-w205', name: 'C-Class', code: 'W205' },
  ] },
  { id: 'porsche', name: 'Porsche', models: [
    { id: 'p-cayenne', name: 'Cayenne', code: '9Y0' }, { id: 'p-panamera', name: 'Panamera', code: '971' }, { id: 'p-911', name: '911', code: '992' },
  ] },
  { id: 'audi', name: 'Audi', models: [
    { id: 'a-etron', name: 'e-tron', code: 'GE' }, { id: 'a-q7', name: 'Q7', code: '4M' }, { id: 'a-a6', name: 'A6', code: 'C8' },
  ] },
  { id: 'bentley', name: 'Bentley', models: [{ id: 'b-gt', name: 'Continental GT', code: '3S' }, { id: 'b-bentayga', name: 'Bentayga', code: '4V' }] },
  { id: 'jaguar', name: 'Jaguar', models: [{ id: 'j-fpace', name: 'F-Pace', code: 'X761' }, { id: 'j-xf', name: 'XF', code: 'X260' }] },
  { id: 'landrover', name: 'Land Rover', models: [{ id: 'lr-rr', name: 'Range Rover', code: 'L405' }, { id: 'lr-def', name: 'Defender', code: 'L663' }] },
  { id: 'toyota', name: 'Toyota', models: [{ id: 't-lc300', name: 'Land Cruiser', code: 'J300' }, { id: 't-lc200', name: 'Land Cruiser', code: 'J200' }] },
]
export const BRAND_IDS = BRANDS.map((b) => b.id) as [string, ...string[]]
export const MODEL_IDS = BRANDS.flatMap((b) => b.models.map((m) => m.id)) as [string, ...string[]]

export function modelOf(id: string) {
  for (const b of BRANDS) {
    const m = b.models.find((x) => x.id === id)
    if (m) return { brand: b, model: m }
  }
  return undefined
}
export const carLabel = (id: string) => {
  const r = modelOf(id)
  return r ? `${r.brand.name} ${r.model.name} ${r.model.code}` : id
}

export const SERVICES = ['dashboard', 'wheel', 'doors', 'console', 'airbag', 'part'] as const
export const SERVICE_FROM: Record<(typeof SERVICES)[number], number> = { dashboard: 1400, wheel: 350, doors: 900, console: 450, airbag: 250, part: 0 }

export const LEATHERS = ['black', 'graphite', 'cognac', 'oxblood', 'navy', 'cream'] as const
export const THREADS = ['yellow', 'red', 'white', 'blue', 'tonal'] as const

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

export function quoteTotal(q: { lines: { qty: number; price: number }[]; labourHours: number; rate: number; margin: number; vat: boolean }) {
  const mat = q.lines.reduce((s, l) => s + l.qty * l.price, 0)
  const net = (mat + q.labourHours * q.rate) * (1 + q.margin / 100)
  return Math.round(net * (q.vat ? 1 + VAT : 1))
}
