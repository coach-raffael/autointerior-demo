import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { useStore, uid, day } from '../store'
import type { CalEvent } from '../data'
import { Btn, Empty, Field, Page, Panel } from './ui'

const KIND: Record<CalEvent['kind'], { label: string; cls: string }> = {
  appointment: { label: 'Drop-off / viewing', cls: 'bg-thread text-nappa' },
  pickup: { label: 'Pickup', cls: 'bg-ok text-nappa' },
  delivery: { label: 'Material delivery', cls: 'bg-cognac text-chalk' },
  block: { label: 'Blocked', cls: 'bg-seam text-dust' },
}
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function CalendarPage() {
  const { events, upsert, remove } = useStore()
  const today = day(0)
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [sel, setSel] = useState(today)
  const [form, setForm] = useState({ title: '', start: '10:00', end: '11:00', kind: 'appointment' as CalEvent['kind'] })

  const cells = useMemo(() => {
    const first = new Date(cursor)
    const offset = (first.getDay() + 6) % 7 // Monday first
    const start = new Date(first); start.setDate(1 - offset)
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d })
  }, [cursor])

  const dayEvents = events.filter((e) => e.date === sel).sort((a, b) => a.start.localeCompare(b.start))
  const add = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return
    upsert('events', { id: uid('E'), date: sel, ...form, title: form.title.trim() })
    setForm({ ...form, title: '' })
  }
  const shift = (n: number) => { const d = new Date(cursor); d.setMonth(d.getMonth() + n); setCursor(d) }

  return (
    <Page title="Calendar" actions={
      <div className="flex items-center gap-2">
        <Btn variant="quiet" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft size={16} /></Btn>
        <span className="w-48 text-center font-display whitespace-nowrap">{cursor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</span>
        <Btn variant="quiet" onClick={() => shift(1)} aria-label="Next month"><ChevronRight size={16} /></Btn>
        <Btn onClick={() => { const d = new Date(); d.setDate(1); setCursor(d); setSel(today) }}>Today</Btn>
      </div>
    }>
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="overflow-hidden rounded-2xl border border-seam">
          <div className="grid grid-cols-7 bg-hide text-center text-xs text-dust">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((d) => {
              const k = iso(d)
              const ev = events.filter((e) => e.date === k)
              const other = d.getMonth() !== cursor.getMonth()
              return (
                <button key={k} onClick={() => setSel(k)} aria-pressed={sel === k}
                  className={`min-h-24 border-t border-l border-seam p-1.5 text-left align-top transition first:border-l-0 [&:nth-child(7n+1)]:border-l-0 ${sel === k ? 'bg-hide' : 'hover:bg-hide/50'} ${other ? 'opacity-40' : ''}`}>
                  <span className={`inline-grid size-6 place-items-center rounded-full text-xs ${k === today ? 'bg-thread font-semibold text-nappa' : ''}`}>{d.getDate()}</span>
                  <span className="mt-1 block space-y-1">
                    {ev.slice(0, 3).map((e) => (
                      <span key={e.id} className={`block truncate rounded px-1 py-0.5 text-[11px] ${KIND[e.kind].cls}`}>{e.kind !== 'block' && e.start + ' '}{e.title}</span>
                    ))}
                    {ev.length > 3 && <span className="block text-[11px] text-dust">+{ev.length - 3} more</span>}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-4">
          <Panel title={new Date(sel + 'T12:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}>
            {dayEvents.length === 0 ? <Empty>Free day. Add a drop-off or block it below.</Empty> : (
              <ul className="space-y-2">
                {dayEvents.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 rounded-xl bg-nappa p-3 text-sm">
                    <span className={`mt-1 size-2.5 shrink-0 rounded-full ${KIND[e.kind].cls}`} />
                    <span className="flex-1">
                      <span className="block">{e.title}</span>
                      <span className="block text-xs text-dust">{e.start}–{e.end} · {KIND[e.kind].label}{e.orderId && ` · ${e.orderId}`}</span>
                    </span>
                    <button onClick={() => remove('events', e.id)} aria-label="Delete event" className="text-dust hover:text-warn"><Trash2 size={15} /></button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="Add to this day">
            <form onSubmit={add} className="grid grid-cols-2 gap-3">
              <Field label="What" className="col-span-2"><input className="field" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Range Rover drop-off" /></Field>
              <Field label="From"><input className="field" type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} /></Field>
              <Field label="To"><input className="field" type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} /></Field>
              <Field label="Type" className="col-span-2">
                <select className="field" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as CalEvent['kind'] })}>
                  {Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </Field>
              <Btn variant="primary" type="submit" className="col-span-2 justify-center"><Plus size={15} /> Add event</Btn>
            </form>
            <p className="mt-3 text-xs text-dust">Blocked days show as “full” in the booking form on the website.</p>
          </Panel>
        </div>
      </div>
    </Page>
  )
}
