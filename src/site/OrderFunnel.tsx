import { useMemo, useState } from 'react'
import { Camera, Check, MessageCircle, X } from 'lucide-react'
import Dashboard from '../components/Dashboard'
import { BRANDS, SERVICES, WHATSAPP, carLabel, gel, lookLabel, partTitle, type Order } from '../data'
import { useStore, day } from '../store'
import { useLang, useT, type Key } from '../i18n'

const STEPS: Key[] = ['step_car', 'step_work', 'step_photos', 'step_date', 'step_contact']
const CHANNELS = [
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'viber', label: 'Viber' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'call', label: '☎' },
] as const

async function shrink(file: File, max = 480): Promise<string> {
  const url = URL.createObjectURL(file)
  const img = new Image()
  img.src = url
  await img.decode()
  const s = Math.min(1, max / Math.max(img.width, img.height))
  const c = document.createElement('canvas')
  c.width = Math.round(img.width * s)
  c.height = Math.round(img.height * s)
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  URL.revokeObjectURL(url)
  return c.toDataURL('image/jpeg', 0.72)
}

export default function OrderFunnel() {
  const t = useT()
  const lang = useLang((s) => s.lang)
  const { look, cart, parts, events, addOrder, clearCart, toggleCart } = useStore()
  const [step, setStep] = useState(0)
  const [brandId, setBrandId] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [services, setServices] = useState<string[]>(['dashboard'])
  const [useLook, setUseLook] = useState(true)
  const [photos, setPhotos] = useState<string[]>([])
  const [date, setDate] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [channel, setChannel] = useState<Order['customer']['channel']>('whatsapp')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState<Order | null>(null)

  const brand = BRANDS.find((b) => b.id === brandId)
  const cartParts = parts.filter((p) => cart.includes(p.id))
  const services2 = cartParts.length && !services.includes('part') ? [...services, 'part'] : services
  const estimate = SERVICES.filter((s) => services2.includes(s.id)).reduce((a, s) => a + s.from, 0) + cartParts.reduce((a, p) => a + p.price, 0)

  const days = useMemo(() => {
    const out: { iso: string; d: Date; full: boolean }[] = []
    for (let i = 1; out.length < 12; i++) {
      const iso = day(i)
      const d = new Date(iso + 'T12:00')
      if (d.getDay() === 0) continue
      out.push({ iso, d, full: events.some((e) => e.date === iso && e.kind === 'block') })
    }
    return out
  }, [events])
  const locale = lang === 'ka' ? 'ka-GE' : lang === 'ru' ? 'ru-RU' : 'en-GB'

  const next = () => {
    setError('')
    if (step === 0 && !model) return setError(t('f_need_car'))
    if (step === 1 && services2.length === 0) return setError(t('f_need_work'))
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }
  const submit = () => {
    if (!name.trim() || phone.replace(/\D/g, '').length < 6) return setError(t('f_need_contact'))
    const o: Order = {
      id: `AI-${1042 + Math.floor(Math.random() * 900)}`,
      createdAt: day(0), status: 'new',
      customer: { name: name.trim(), phone: phone.trim(), channel },
      car: { model, year }, services: services2, look: useLook ? look : undefined,
      parts: cart, photos, date: date || undefined, note: note.trim() || undefined,
    }
    addOrder(o)
    clearCart()
    setSent(o)
  }
  const reset = () => {
    setSent(null); setStep(0); setBrandId(''); setModel(''); setYear(''); setPhotos([]); setDate(''); setNote(''); setError('')
  }

  const waText = sent
    ? encodeURIComponent(
        [`${t('sent_text')}: ${sent.id}`, carLabel(sent.car.model) + (sent.car.year ? ` (${sent.car.year})` : ''),
          sent.services.map((s) => t(SERVICES.find((x) => x.id === s)!.key)).join(', '),
          sent.look ? lookLabel(sent.look, lang) : '', sent.date ?? ''].filter(Boolean).join('\n'),
      )
    : ''

  return (
    <section id="order" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <h2 className="font-display text-3xl font-bold sm:text-4xl">{t('order_title')}</h2>
          <p className="mt-3 max-w-sm text-dust">{t('order_sub')}</p>
          {!sent && (
            <ol className="mt-8 space-y-1">
              {STEPS.map((s, i) => (
                <li key={s}>
                  <button
                    onClick={() => i < step && setStep(i)}
                    disabled={i > step}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left ${i === step ? 'bg-hide' : ''}`}
                  >
                    <span className={`grid size-7 place-items-center rounded-full border text-xs ${i < step ? 'border-thread bg-thread text-nappa' : i === step ? 'border-thread text-thread' : 'border-seam text-dust'}`}>
                      {i < step ? <Check size={14} /> : i + 1}
                    </span>
                    <span className={i === step ? '' : 'text-dust'}>{t(s)}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
          {!sent && estimate > 0 && (
            <div className="mt-8 rounded-2xl border border-seam p-4">
              <p className="text-sm text-dust">{t('estimate')}</p>
              <p className="font-display text-2xl text-thread">≈ {gel(estimate)}</p>
              <p className="mt-1 text-xs text-dust">{t('estimate_note')}</p>
            </div>
          )}
        </div>

        <div className="rounded-[28px] border border-seam bg-hide/60 p-5 sm:p-8">
          {sent ? (
            <div className="py-6 text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-full bg-thread text-nappa"><Check size={28} /></span>
              <h3 className="mt-5 font-display text-2xl">{t('sent_title')}</h3>
              <p className="mt-2 text-dust">{t('sent_text')}: <span className="font-display text-chalk">{sent.id}</span></p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <a href={`https://wa.me/${WHATSAPP}?text=${waText}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full bg-thread px-5 py-3 font-semibold text-nappa">
                  <MessageCircle size={18} /> {t('sent_wa')}
                </a>
                <button onClick={reset} className="rounded-full border border-seam px-5 py-3">{t('sent_again')}</button>
              </div>
            </div>
          ) : (
            <>
              <h3 className="font-display text-xl">{t(STEPS[step])}</h3>
              <div className="mt-6 min-h-[260px]">
                {step === 0 && (
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label={t('f_brand')}>
                      <select className="field" value={brandId} onChange={(e) => { setBrandId(e.target.value); setModel('') }}>
                        <option value="">{t('f_choose')}</option>
                        {BRANDS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </Field>
                    <Field label={t('f_model')}>
                      <select className="field" value={model} onChange={(e) => setModel(e.target.value)} disabled={!brand}>
                        <option value="">{t('f_choose')}</option>
                        {brand?.models.map((m) => <option key={m.id} value={m.id}>{m.name} {m.code}</option>)}
                      </select>
                    </Field>
                    <Field label={t('f_year')}>
                      <input className="field" inputMode="numeric" maxLength={4} placeholder="2019" value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))} />
                    </Field>
                  </div>
                )}

                {step === 1 && (
                  <div>
                    <p className="mb-3 text-sm text-dust">{t('f_services')}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {SERVICES.filter((s) => s.id !== 'part').map((s) => {
                        const on = services.includes(s.id)
                        return (
                          <button key={s.id} onClick={() => setServices(on ? services.filter((x) => x !== s.id) : [...services, s.id])} aria-pressed={on}
                            className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition ${on ? 'border-thread' : 'border-seam hover:border-dust'}`}>
                            <span>{t(s.key)}</span>
                            <span className="text-sm text-dust">{gel(s.from)}+</span>
                          </button>
                        )
                      })}
                    </div>
                    <div className="mt-6 flex items-center gap-4 rounded-2xl bg-nappa p-3">
                      <Dashboard look={look} className="w-40 shrink-0" />
                      <div className="flex-1 text-sm">
                        <p className="text-dust">{t('f_look')}</p>
                        <p>{lookLabel(look, lang)}</p>
                        <label className="mt-2 inline-flex items-center gap-2 text-dust">
                          <input type="checkbox" checked={useLook} onChange={(e) => setUseLook(e.target.checked)} className="accent-[#f2c230]" />
                          {t('cfg_request')}
                        </label>
                      </div>
                    </div>
                    {cartParts.length > 0 && (
                      <div className="mt-4">
                        <p className="mb-2 text-sm text-dust">{t('f_parts')}</p>
                        {cartParts.map((p) => (
                          <div key={p.id} className="flex items-center justify-between border-b border-seam py-2 text-sm">
                            <span className="min-w-0">{carLabel(p.model)} — {partTitle(p, lang)}</span>
                            <span className="flex items-center gap-3">{gel(p.price)}
                              <button onClick={() => toggleCart(p.id)} aria-label="Remove" className="text-dust hover:text-chalk"><X size={15} /></button>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {step === 2 && (
                  <div>
                    <p className="text-sm text-dust">{t('f_photos')}</p>
                    <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-seam py-10 hover:border-thread">
                      <Camera className="text-thread" />
                      <span>{t('f_photos_btn')}</span>
                      <input type="file" accept="image/*" multiple className="sr-only" onChange={async (e) => {
                        const files = Array.from(e.target.files ?? []).slice(0, 4 - photos.length)
                        const urls = await Promise.all(files.map((f) => shrink(f)))
                        setPhotos((p) => [...p, ...urls].slice(0, 4))
                      }} />
                    </label>
                    {photos.length > 0 && (
                      <div className="mt-4 flex gap-3">
                        {photos.map((p, i) => (
                          <div key={i} className="relative">
                            <img src={p} alt="" className="size-20 rounded-xl object-cover" />
                            <button onClick={() => setPhotos(photos.filter((_, j) => j !== i))} className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-chalk text-nappa" aria-label="Remove"><X size={13} /></button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {step === 3 && (
                  <div>
                    <p className="mb-3 text-sm text-dust">{t('f_date')}</p>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {days.map(({ iso, d, full }) => (
                        <button key={iso} disabled={full} onClick={() => setDate(iso)} aria-pressed={date === iso}
                          className={`min-w-0 rounded-xl border px-1.5 py-3 text-center [overflow-wrap:anywhere] transition disabled:cursor-not-allowed disabled:opacity-35 ${date === iso ? 'border-thread bg-nappa' : 'border-seam hover:border-dust'}`}>
                          <span className="block text-xs text-dust">{d.toLocaleDateString(locale, { weekday: 'short' })}</span>
                          <span className="block font-display">{d.getDate()}</span>
                          <span className="block text-xs text-dust">{full ? t('f_full') : d.toLocaleDateString(locale, { month: 'short' })}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label={t('f_name')}><input className="field" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>
                    <Field label={t('f_phone')}><input className="field" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+995 5__ __ __ __" inputMode="tel" autoComplete="tel" /></Field>
                    <div className="sm:col-span-2">
                      <p className="mb-2 text-sm text-dust">{t('f_channel')}</p>
                      <div className="flex flex-wrap gap-2">
                        {CHANNELS.map((c) => (
                          <button key={c.id} onClick={() => setChannel(c.id)} aria-pressed={channel === c.id}
                            className={`rounded-full border px-4 py-2 text-sm ${channel === c.id ? 'border-thread text-thread' : 'border-seam text-dust'}`}>{c.label}</button>
                        ))}
                      </div>
                    </div>
                    <div className="sm:col-span-2"><Field label={t('f_note')}><textarea className="field min-h-20" value={note} onChange={(e) => setNote(e.target.value)} /></Field></div>
                  </div>
                )}
              </div>

              {error && <p role="alert" className="mt-4 text-sm text-warn">{error}</p>}
              <div className="mt-6 flex justify-between gap-3">
                <button onClick={() => { setError(''); setStep((s) => Math.max(0, s - 1)) }} className={`rounded-full border border-seam px-5 py-3 ${step === 0 ? 'invisible' : ''}`}>{t('f_back')}</button>
                {step < STEPS.length - 1
                  ? <button onClick={next} className="rounded-full bg-chalk px-6 py-3 font-semibold text-nappa">{t('f_next')}</button>
                  : <button onClick={submit} className="rounded-full bg-thread px-6 py-3 font-semibold text-nappa">{t('f_send')}</button>}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-dust">{label}</span>
      {children}
    </label>
  )
}
