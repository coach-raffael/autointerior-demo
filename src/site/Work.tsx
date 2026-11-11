import { useState } from 'react'
import { X } from 'lucide-react'
import Instagram from '../components/InstagramIcon'
import { BRANDS, INSTAGRAM, WORK } from '../data'
import { useT } from '../i18n'

export default function Work() {
  const t = useT()
  const [brand, setBrand] = useState('all')
  const [open, setOpen] = useState<number | null>(null)
  const used = BRANDS.filter((b) => WORK.some((w) => w.brand === b.id))
  const items = WORK.filter((w) => brand === 'all' || w.brand === brand)

  return (
    <section id="work" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="font-display text-3xl font-bold sm:text-4xl">{t('work_title')}</h2>
        <a href={INSTAGRAM} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-dust hover:text-chalk">
          <Instagram size={16} /> {t('work_ig')}
        </a>
      </div>

      <div className="scrollbar-none mt-6 flex gap-2 overflow-x-auto pb-1">
        {[{ id: 'all', name: t('work_all') }, ...used].map((b) => (
          <button
            key={b.id}
            onClick={() => setBrand(b.id)}
            aria-pressed={brand === b.id}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm transition ${brand === b.id ? 'border-thread text-thread' : 'border-seam text-dust hover:text-chalk'}`}
          >
            {b.name}
          </button>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((w, i) => (
          <button
            key={w.img}
            onClick={() => setOpen(i)}
            className="group relative overflow-hidden rounded-2xl bg-hide text-left"
          >
            <img src={w.img} alt={`${w.title} — ${w.what}`} loading="lazy" className="aspect-[3/4] h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3 pt-10">
              <span className="block font-display text-sm font-semibold">{w.title}</span>
              <span className="block text-xs text-dust">{w.what}</span>
            </span>
          </button>
        ))}
      </div>

      {open !== null && items[open] && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4" onClick={() => setOpen(null)}>
          <figure className="relative max-h-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <img src={items[open].img} alt={items[open].title} className="max-h-[80vh] rounded-2xl object-contain" />
            <figcaption className="mt-3 text-center">
              <span className="font-display">{items[open].title}</span>
              <span className="text-dust"> — {items[open].what}</span>
            </figcaption>
            <button onClick={() => setOpen(null)} className="absolute -top-3 -right-3 grid size-10 place-items-center rounded-full bg-chalk text-nappa" aria-label="Close">
              <X size={18} />
            </button>
          </figure>
        </div>
      )}
    </section>
  )
}
