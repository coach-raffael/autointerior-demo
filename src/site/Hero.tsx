import { useState } from 'react'
import { Move3d, MessageCircle } from 'lucide-react'
import Cockpit3D, { type CockpitState } from '../components/Cockpit3D'
import type { View } from '../three/cockpit'
import { FINISHES, LEATHERS, THREADS, type Look, PHONE_DISPLAY, WHATSAPP, leatherOf, lookLabel, gel } from '../data'
import { useStore } from '../store'
import { useLang, useT, type Key } from '../i18n'

export default function Hero() {
  const t = useT()
  const lang = useLang((s) => s.lang)
  const look = useStore((s) => s.look)
  const setLook = useStore((s) => s.setLook)
  const [sewKey, setSewKey] = useState(0)
  const [view, setView] = useState<View>('driver')
  const [cockpitState, setCockpitState] = useState<CockpitState>('poster')
  const touch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
  const VIEWS: { id: View; key: Key }[] = [
    { id: 'driver', key: 'view_driver' }, { id: 'center', key: 'view_center' },
    { id: 'seam', key: 'view_seam' }, { id: 'wheel', key: 'view_wheel' },
  ]

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
          <h1 className="font-display text-[clamp(1.85rem,8.2vw,2.4rem)] leading-[1.08] font-bold [overflow-wrap:break-word] text-balance sm:text-6xl lg:text-7xl">{t('hero_title')}</h1>
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
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 pt-5 sm:px-8">
          <p className="text-sm text-dust">{t('hero_try')}</p>
          <p className="text-sm">
            <span className="text-dust">{t('cfg_from')} </span>
            <span className="font-display whitespace-nowrap text-thread">{gel(fromPrice)}</span>
          </p>
        </div>

        <Cockpit3D look={look} sewKey={sewKey} view={view} label={`${t('hero_try')}: ${lookLabel(look, lang)}`} onState={setCockpitState} />

        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-4 sm:px-8">
          <p className="flex items-center gap-2 text-xs text-dust" aria-live="polite">
            <Move3d size={15} className="shrink-0 text-thread" />
            {cockpitState === 'ready' ? t(touch ? 'cfg_drag_touch' : 'cfg_drag') : cockpitState === 'loading' ? t('cfg_loading') : t('cfg_poster')}
          </p>
          {cockpitState === 'ready' && (
            <div className="flex flex-wrap gap-1.5">
              {VIEWS.map((v) => (
                <button key={v.id} onClick={() => setView(v.id)} aria-pressed={view === v.id}
                  className={`rounded-full border px-3 py-1 text-xs whitespace-nowrap transition ${view === v.id ? 'border-thread text-thread' : 'border-seam text-dust hover:text-chalk'}`}>
                  {t(v.key)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="seam mx-5 sm:mx-8" />

        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 px-5 py-6 sm:grid-cols-[repeat(2,minmax(0,1fr))] sm:px-8 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end">
          <Control label={t('cfg_leather')}>
            <div className="flex flex-wrap gap-2">
              {LEATHERS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => change({ leather: l.id })}
                  aria-pressed={look.leather === l.id}
                  title={l.l10n[lang]}
                  className={`size-10 rounded-full border-2 transition ${look.leather === l.id ? 'border-thread scale-110' : 'border-seam hover:border-dust'}`}
                  style={{ background: `radial-gradient(circle at 35% 30%, ${l.hi}, ${l.hex} 70%)` }}
                >
                  <span className="sr-only">{l.l10n[lang]}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-dust">{leatherOf(look.leather).l10n[lang]}</p>
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
                  title={th.l10n[lang]}
                  className={`grid size-8 place-items-center rounded-full border-2 transition ${look.thread === th.id ? 'border-chalk' : 'border-transparent hover:border-seam'}`}
                >
                  <span
                    className="block size-5 rounded-full"
                    style={{ background: th.hex || `linear-gradient(135deg, ${leatherOf(look.leather).hi}, ${leatherOf(look.leather).hex})`, outline: '1px dashed rgba(0,0,0,.35)', outlineOffset: '-4px' }}
                  />
                  <span className="sr-only">{th.l10n[lang]}</span>
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
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-thread px-6 py-2 text-center font-semibold text-nappa transition hover:bg-[#ffd447] sm:self-end"
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
    <div className="inline-flex max-w-full flex-wrap gap-0.5 rounded-[22px] border border-seam p-1">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={`rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap transition ${value === o.id ? 'bg-chalk text-nappa' : 'text-dust hover:text-chalk'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
