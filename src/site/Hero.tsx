import { useState } from 'react'
import { MessageCircle } from 'lucide-react'
import Dashboard from '../components/Dashboard'
import { FINISHES, LEATHERS, THREADS, type Look, PHONE_DISPLAY, WHATSAPP, leatherOf, gel } from '../data'
import { useStore } from '../store'
import { useT, type Key } from '../i18n'

export default function Hero() {
  const t = useT()
  const look = useStore((s) => s.look)
  const setLook = useStore((s) => s.setLook)
  const [sewKey, setSewKey] = useState(0)

  const change = (patch: Partial<Look>) => {
    setLook({ ...look, ...patch })
    setSewKey((k) => k + 1)
  }
  const fromPrice = 1400 + (look.finish === 'alcantara' ? 250 : look.finish === 'perforated' ? 150 : 0) + (look.seam === 'double' ? 120 : 0)

  return (
    <section id="top" className="mx-auto max-w-7xl px-4 pt-10 pb-16 sm:px-6 lg:pt-16">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
        <div className="max-w-3xl">
          <p className="mb-4 text-sm text-thread">{t('hero_kicker')}</p>
          <h1 className="font-display text-[2.4rem] leading-[1.05] font-bold sm:text-6xl lg:text-7xl">{t('hero_title')}</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-dust">{t('hero_sub')}</p>
        </div>
        <a
          href={`https://wa.me/${WHATSAPP}`}
          target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-3 self-start rounded-full border border-seam px-5 py-3 text-sm transition hover:border-thread lg:self-end"
        >
          <MessageCircle size={18} className="text-thread" />
          <span>WhatsApp · {PHONE_DISPLAY}</span>
        </a>
      </div>

      {/* configurator */}
      <div className="relative mt-10 overflow-hidden rounded-[28px] border border-seam bg-hide/60">
        <div className="flex items-center justify-between px-5 pt-5 sm:px-8">
          <p className="text-sm text-dust">{t('hero_try')}</p>
          <p className="text-sm">
            <span className="text-dust">{t('cfg_from')} </span>
            <span className="font-display text-thread">{gel(fromPrice)}</span>
          </p>
        </div>
        <Dashboard look={look} sewKey={sewKey} className="mx-auto block w-full max-w-5xl px-2 sm:px-8" />

        <div className="seam mx-5 sm:mx-8" />

        <div className="grid gap-6 px-5 py-6 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-end">
          <Control label={t('cfg_leather')}>
            <div className="flex flex-wrap gap-2">
              {LEATHERS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => change({ leather: l.id })}
                  aria-pressed={look.leather === l.id}
                  title={l.name}
                  className={`size-10 rounded-full border-2 transition ${look.leather === l.id ? 'border-thread scale-110' : 'border-seam hover:border-dust'}`}
                  style={{ background: `radial-gradient(circle at 35% 30%, ${l.hi}, ${l.hex} 70%)` }}
                >
                  <span className="sr-only">{l.name}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-dust">{leatherOf(look.leather).name}</p>
          </Control>

          <Control label={t('cfg_finish')}>
            <Segmented
              value={look.finish}
              options={FINISHES.map((f) => ({ id: f, label: t(`finish_${f}` as Key) }))}
              onChange={(finish) => change({ finish })}
            />
          </Control>

          <Control label={`${t('cfg_thread')} / ${t('cfg_style')}`}>
            <div className="flex flex-wrap items-center gap-2">
              {THREADS.map((th) => (
                <button
                  key={th.id}
                  onClick={() => change({ thread: th.id })}
                  aria-pressed={look.thread === th.id}
                  title={th.name}
                  className={`grid size-8 place-items-center rounded-full border-2 transition ${look.thread === th.id ? 'border-chalk' : 'border-transparent hover:border-seam'}`}
                >
                  <span
                    className="block size-5 rounded-full"
                    style={{ background: th.hex || `linear-gradient(135deg, ${leatherOf(look.leather).hi}, ${leatherOf(look.leather).hex})`, outline: '1px dashed rgba(0,0,0,.35)', outlineOffset: '-4px' }}
                  />
                  <span className="sr-only">{th.name}</span>
                </button>
              ))}
            </div>
            <div className="mt-3">
              <Segmented
                value={look.seam}
                options={[{ id: 'single', label: t('cfg_single') }, { id: 'double', label: t('cfg_double') }]}
                onChange={(seam) => change({ seam })}
              />
            </div>
          </Control>

          <a
            href="#order"
            className="inline-flex h-12 items-center justify-center rounded-full bg-thread px-6 font-semibold text-nappa transition hover:bg-[#ffd447]"
          >
            {t('cfg_request')}
          </a>
        </div>
      </div>
    </section>
  )
}

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm text-dust">{label}</p>
      {children}
    </div>
  )
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex flex-wrap rounded-full border border-seam p-1">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={`rounded-full px-3.5 py-1.5 text-sm transition ${value === o.id ? 'bg-chalk text-nappa' : 'text-dust hover:text-chalk'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
