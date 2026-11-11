import { useState } from 'react'
import { Check, Plus, Wrench } from 'lucide-react'
import { BRANDS, PART_KIND_L10N, gel, partTitle } from '../data'
import { useStore } from '../store'
import { useLang, useT, type Key } from '../i18n'

const COND_KEY: Record<string, Key> = { exchange: 'cond_exchange', used: 'cond_used', new: 'cond_new' }

export default function Parts() {
  const t = useT()
  const lang = useLang((s) => s.lang)
  const parts = useStore((s) => s.parts)
  const cart = useStore((s) => s.cart)
  const toggleCart = useStore((s) => s.toggleCart)
  const [brandId, setBrandId] = useState('bmw')
  const brand = BRANDS.find((b) => b.id === brandId)!
  const firstWithStock = (b: typeof brand) => (b.models.find((m) => parts.some((p) => p.published && p.model === m.id)) ?? b.models[0]).id
  const [modelId, setModelId] = useState(() => firstWithStock(brand))
  const model = brand.models.find((m) => m.id === modelId) ?? brand.models[0]
  const list = parts.filter((p) => p.published && p.model === model.id)
  const countFor = (mId: string) => parts.filter((p) => p.published && p.model === mId && p.stock > 0).length

  return (
    <section id="parts" className="border-y border-seam bg-hide/40 py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <h2 className="font-display text-3xl font-bold sm:text-4xl">{t('parts_title')}</h2>
        <p className="mt-3 max-w-xl text-dust">{t('parts_sub')}</p>

        {/* make: one oversized line of type */}
        <div className="scrollbar-none mt-10 -mx-4 flex gap-x-8 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:px-0">
          {BRANDS.map((b) => (
            <button
              key={b.id}
              onClick={() => { setBrandId(b.id); setModelId(firstWithStock(b)) }}
              aria-pressed={b.id === brandId}
              className={`shrink-0 font-display text-2xl font-bold transition sm:text-4xl ${b.id === brandId ? 'text-chalk' : 'text-seam hover:text-dust'}`}
            >
              {b.name}
            </button>
          ))}
        </div>

        <div className="mt-8 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
          {/* models */}
          <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 self-start">
            {brand.models.map((m) => {
              const n = countFor(m.id)
              const active = m.id === model.id
              return (
                <button
                  key={m.id}
                  onClick={() => setModelId(m.id)}
                  aria-pressed={active}
                  className={`relative min-w-0 overflow-hidden rounded-2xl border p-4 text-left break-words transition ${active ? 'border-thread bg-nappa' : 'border-seam hover:border-dust'}`}
                >
                  <span aria-hidden className="pointer-events-none absolute -right-2 -bottom-4 font-display text-6xl font-bold text-white/[0.04]">{m.code}</span>
                  <span className="block font-display text-lg font-semibold">{m.name}</span>
                  <span className="block text-sm text-dust">{m.code} · {m.years}</span>
                  <span className={`mt-3 inline-block text-xs ${n ? 'text-thread' : 'text-dust'}`}>{n} {t('parts_stock')}</span>
                </button>
              )
            })}
          </div>

          {/* parts for selected model */}
          <div>
            <p className="font-display text-xl">
              {brand.name} {model.name} <span className="text-dust">{model.code}</span>
            </p>
            <div className="seam-muted my-4" />
            <ul className="space-y-3">
              <li className="flex items-center gap-4 rounded-2xl border border-dashed border-seam p-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-nappa text-thread"><Wrench size={20} /></span>
                <span className="flex-1">
                  <span className="block font-semibold">{t('parts_service')}</span>
                  <span className="block text-sm text-dust">{t('parts_service_d')}</span>
                </span>
                <a href="#order" className="rounded-full border border-seam px-4 py-2 text-sm hover:border-thread">{t('nav_order')}</a>
              </li>
              {list.map((p) => {
                const inCart = cart.includes(p.id)
                return (
                  <li key={p.id} className="flex items-center gap-4 rounded-2xl bg-nappa p-3 pr-4">
                    {p.img
                      ? <img src={p.img} alt="" className="size-16 shrink-0 rounded-xl object-cover" />
                      : <span className="size-16 shrink-0 rounded-xl bg-hide" />}
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs text-dust">{PART_KIND_L10N[p.kind][lang]} · {t(COND_KEY[p.condition])}</span>
                      <span className="line-clamp-2 block font-semibold">{partTitle(p, lang)}</span>
                      <span className="block text-sm">
                        <span className="font-display text-thread">{gel(p.price)}</span>
                        <span className="text-dust"> · {p.stock > 0 ? `${p.stock} ${t('parts_stock')}` : '—'}</span>
                      </span>
                    </span>
                    <button
                      disabled={p.stock === 0}
                      onClick={() => toggleCart(p.id)}
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm transition disabled:opacity-40 ${inCart ? 'bg-thread text-nappa' : 'border border-seam hover:border-thread'}`}
                    >
                      {inCart ? <Check size={15} /> : <Plus size={15} />}
                      <span className="hidden sm:inline">{inCart ? t('parts_added') : t('parts_add')}</span>
                    </button>
                  </li>
                )
              })}
              {list.length === 0 && <li className="px-1 text-sm text-dust">{t('parts_none')}</li>}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
