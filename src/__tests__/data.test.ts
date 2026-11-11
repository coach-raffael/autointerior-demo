import { describe, expect, it } from 'vitest'
import { BRANDS, carLabel, DEFAULT_LOOK, JOB_TEMPLATES, lookLabel, MATERIALS, modelOf, quoteTotal, threadOf, VAT } from '../data'

describe('configurator', () => {
  it('describes the default look', () => {
    expect(lookLabel(DEFAULT_LOOK)).toBe('Black nappa, yellow double stitch')
  })

  it('uses a tonal thread derived from the leather', () => {
    expect(threadOf('tonal', 'cognac')).toBe('#b36c3e')
    expect(threadOf('red', 'cognac')).toBe('#c8322f')
  })

  it('falls back to the first thread for unknown ids', () => {
    expect(threadOf('does-not-exist', 'black')).toBe('#f2c230')
  })
})

describe('vehicles', () => {
  it('finds every model by id and labels it with brand and code', () => {
    for (const b of BRANDS) {
      for (const m of b.models) {
        expect(modelOf(m.id)?.brand.id).toBe(b.id)
        expect(carLabel(m.id)).toBe(`${b.name} ${m.name} ${m.code}`)
      }
    }
  })

  it('keeps unknown model ids as they are', () => {
    expect(modelOf('nope')).toBeUndefined()
    expect(carLabel('nope')).toBe('nope')
  })
})

describe('quote calculator', () => {
  const price = (id: string) => MATERIALS.find((m) => m.id === id)!.price

  it('adds materials, labour, margin and VAT', () => {
    const lines = [{ label: 'Nappa', qty: 2, unit: 'm²', price: 100 }]
    // (200 + 10 h × 45) × 1.2 = 780, × 1.18 = 920.4
    expect(quoteTotal({ lines, labourHours: 10, rate: 45, margin: 20, vat: true })).toBe(920)
  })

  it('skips VAT when switched off', () => {
    expect(quoteTotal({ lines: [], labourHours: 2, rate: 50, margin: 0, vat: false })).toBe(100)
    expect(VAT).toBe(0.18)
  })

  it('prices every job template with known materials', () => {
    for (const t of Object.values(JOB_TEMPLATES)) {
      for (const l of t.lines) expect(price(l.mat)).toBeGreaterThan(0)
    }
  })
})
