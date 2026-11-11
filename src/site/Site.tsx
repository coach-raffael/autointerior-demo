import { useEffect, useState } from 'react'
import { Menu, MessageCircle, Phone, X } from 'lucide-react'
import Instagram from '../components/InstagramIcon'
import { LANGS, useLang, useT } from '../i18n'
import { INSTAGRAM, PHONE_DISPLAY, WHATSAPP } from '../data'
import { useStore } from '../store'
import Hero from './Hero'
import Work from './Work'
import Parts from './Parts'
import Process from './Process'
import OrderFunnel from './OrderFunnel'

export function Wordmark({ small = false }: { small?: boolean }) {
  return (
    <span className="inline-flex flex-col leading-none">
      <span className={`font-display font-bold ${small ? 'text-base' : 'text-lg'}`}>Auto Interiore</span>
      <span aria-hidden className="mt-1 block h-0 border-t-[1.5px] border-dashed border-thread" />
    </span>
  )
}

function LangSwitch() {
  const { lang, setLang } = useLang()
  useEffect(() => { document.documentElement.lang = lang }, [lang])
  return (
    <div className="flex rounded-full border border-seam p-0.5 text-xs">
      {LANGS.map((l) => (
        <button key={l.id} onClick={() => setLang(l.id)} aria-pressed={lang === l.id}
          className={`rounded-full px-2.5 py-1 ${lang === l.id ? 'bg-chalk text-nappa' : 'text-dust hover:text-chalk'}`}>{l.label}</button>
      ))}
    </div>
  )
}

export default function Site() {
  const t = useT()
  const loadPublic = useStore((s) => s.loadPublic)
  useEffect(() => { loadPublic() }, [loadPublic])
  const cart = useStore((s) => s.cart)
  const [menu, setMenu] = useState(false)
  const links = [
    { href: '#work', label: t('nav_work') },
    { href: '#parts', label: t('nav_parts') },
    { href: '#process', label: t('nav_process') },
  ]

  return (
    <>
      <div className="bg-thread px-4 py-1.5 text-center text-xs font-semibold text-nappa">{t('demo_banner')}</div>
      <header className="sticky top-0 z-40 border-b border-seam/70 bg-nappa/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <a href="#top" aria-label="Auto Interiore"><Wordmark /></a>
          <nav className="hidden items-center gap-7 text-sm md:flex">
            {links.map((l) => <a key={l.href} href={l.href} className="text-dust hover:text-chalk">{l.label}</a>)}
          </nav>
          <div className="flex items-center gap-3">
            <LangSwitch />
            <a href="#order" className="relative hidden rounded-full bg-thread px-4 py-2 text-sm font-semibold text-nappa sm:inline-block">
              {t('nav_order')}
              {cart.length > 0 && <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-chalk text-[11px]">{cart.length}</span>}
            </a>
            <button className="md:hidden" onClick={() => setMenu(!menu)} aria-label="Menu" aria-expanded={menu}>{menu ? <X /> : <Menu />}</button>
          </div>
        </div>
        {menu && (
          <nav className="border-t border-seam px-4 py-3 md:hidden">
            {[...links, { href: '#order', label: t('nav_order') }].map((l) => (
              <a key={l.href} href={l.href} onClick={() => setMenu(false)} className="block py-2.5">{l.label}</a>
            ))}
          </nav>
        )}
      </header>

      <main>
        <Hero />
        <Work />
        <Parts />
        <Process />
        <OrderFunnel />
      </main>

      <footer className="border-t border-seam">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
          <div>
            <Wordmark />
            <p className="mt-4 text-sm text-dust">ტორპედოს გადაკვრა · {t('footer_city')}</p>
          </div>
          <div className="space-y-2 text-sm">
            <a className="flex items-center gap-2 hover:text-thread" href={`tel:+${WHATSAPP}`}><Phone size={15} /> {PHONE_DISPLAY}</a>
            <a className="flex items-center gap-2 hover:text-thread" href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noreferrer"><MessageCircle size={15} /> WhatsApp</a>
            <a className="flex items-center gap-2 hover:text-thread" href={INSTAGRAM} target="_blank" rel="noreferrer"><Instagram size={15} /> @autointeriore</a>
          </div>
          <div className="text-sm text-dust md:text-right">
            <p>{t('footer_hours')}</p>
            <a href="#/admin" className="mt-4 inline-block underline decoration-dashed underline-offset-4 hover:text-chalk">{t('nav_admin')}</a>
          </div>
        </div>
      </footer>
    </>
  )
}
