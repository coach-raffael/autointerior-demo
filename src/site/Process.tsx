import { useT, type Key } from '../i18n'

const STEPS: [Key, Key][] = [['p1_t', 'p1_d'], ['p2_t', 'p2_d'], ['p3_t', 'p3_d'], ['p4_t', 'p4_d']]

export default function Process() {
  const t = useT()
  return (
    <section id="process" className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="font-display text-3xl font-bold sm:text-4xl">{t('process_title')}</h2>
        <p className="text-sm text-thread">{t('process_time')}</p>
      </div>
      {/* a real sequence, so it is numbered and joined by one continuous seam */}
      <ol className="relative mt-10 grid gap-8 md:grid-cols-4 md:gap-6">
        <div aria-hidden className="seam absolute top-5 right-0 left-0 hidden md:block" />
        {STEPS.map(([title, desc], i) => (
          <li key={title} className="relative">
            <span className="relative z-10 grid size-10 place-items-center rounded-full border-2 border-thread bg-nappa font-display text-sm text-thread">{i + 1}</span>
            <h3 className="mt-4 font-display text-lg font-semibold">{t(title)}</h3>
            <p className="mt-2 leading-relaxed text-dust">{t(desc)}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
