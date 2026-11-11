import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calculator, CalendarPlus, ChevronLeft, ChevronRight, Megaphone, MessageCircle } from 'lucide-react'
import { useStore, day } from '../store'
import { ORDER_FLOW, SERVICES, carLabel, gel, lookLabel, type Order, type OrderStatus } from '../data'
import Dashboard from '../components/Dashboard'
import { useT } from '../i18n'
import { Badge, Btn, Field, Modal, Page, fmtDate } from './ui'

export default function Orders() {
  const orders = useStore((s) => s.orders)
  const updateOrder = useStore((s) => s.updateOrder)
  const [openId, setOpenId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const open = orders.find((o) => o.id === openId)

  const move = (o: Order, dir: -1 | 1) => {
    const i = ORDER_FLOW.findIndex((s) => s.id === o.status)
    const next = ORDER_FLOW[i + dir]
    if (next) updateOrder(o.id, { status: next.id })
  }

  return (
    <Page title="Orders">
      <p className="-mt-3 mb-5 text-sm text-dust">Drag a card to the next column, or open it to quote, book and reply.</p>
      <div className="scrollbar-none -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 sm:-mx-8 sm:px-8">
        {ORDER_FLOW.map((col) => {
          const list = orders.filter((o) => o.status === col.id)
          return (
            <div key={col.id}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragId) updateOrder(dragId, { status: col.id }); setDragId(null) }}
              className="flex w-72 shrink-0 flex-col rounded-2xl border border-seam bg-hide/50">
              <div className="flex items-center justify-between px-4 py-3">
                <h2 className="text-sm font-semibold">{col.label}</h2>
                <span className="text-xs text-dust">{list.length}</span>
              </div>
              <div className="flex min-h-40 flex-1 flex-col gap-2 px-2 pb-2">
                {list.map((o) => (
                  <article key={o.id} draggable onDragStart={() => setDragId(o.id)} onDragEnd={() => setDragId(null)}
                    className={`group rounded-xl border border-seam bg-nappa p-3 ${dragId === o.id ? 'opacity-40' : ''}`}>
                    <button onClick={() => setOpenId(o.id)} className="block w-full text-left">
                      <div className="flex gap-3">
                        {o.photos[0] ? <img src={o.photos[0]} alt="" className="size-11 rounded-lg object-cover" /> : <span className="size-11 rounded-lg bg-seam" />}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{carLabel(o.car.model)}</p>
                          <p className="truncate text-xs text-dust">{o.customer.name}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <Badge>{o.id}</Badge>
                        {o.quote && <Badge tone="thread">{gel(o.quote.total)}</Badge>}
                        {o.date && <span className="text-xs text-dust">{fmtDate(o.date)}</span>}
                      </div>
                    </button>
                    <div className="mt-2 flex justify-between opacity-60 group-hover:opacity-100">
                      <button onClick={() => move(o, -1)} aria-label="Move back" className="text-dust hover:text-chalk disabled:invisible" disabled={col.id === 'new'}><ChevronLeft size={16} /></button>
                      <button onClick={() => move(o, 1)} aria-label="Move forward" className="text-dust hover:text-chalk disabled:invisible" disabled={col.id === 'delivered'}><ChevronRight size={16} /></button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      {open && <OrderDetail order={open} onClose={() => setOpenId(null)} />}
    </Page>
  )
}

function OrderDetail({ order: o, onClose }: { order: Order; onClose: () => void }) {
  const t = useT()
  const navigate = useNavigate()
  const { updateOrder, bookOrder, createPost, parts, posts } = useStore()
  const [date, setDate] = useState(o.date ?? day(1))
  const [time, setTime] = useState('10:00')
  const [msg, setMsg] = useState('')
  const linkedParts = parts.filter((p) => o.parts.includes(p.id))
  const hasPost = posts.some((p) => p.refId === o.id)

  const book = async () => {
    await bookOrder(o.id, date, time)
    if (!useStore.getState().error) setMsg(`Booked for ${fmtDate(date)} at ${time}.`)
  }
  const draftPost = async () => {
    await createPost('order', o.id)
    if (!useStore.getState().error) setMsg('Social post drafted. Review it under Social content.')
  }
  const phone = o.customer.phone.replace(/\D/g, '')
  const reply = encodeURIComponent(
    o.quote
      ? `გამარჯობა ${o.customer.name}! ${carLabel(o.car.model)}: ${gel(o.quote.total)}. ${o.date ? 'თარიღი: ' + fmtDate(o.date) : ''} — Auto Interiore`
      : `გამარჯობა ${o.customer.name}! მივიღეთ თქვენი შეკვეთა ${o.id}. მალე დაგიკავშირდებით. — Auto Interiore`,
  )

  return (
    <Modal title={`${o.id} · ${carLabel(o.car.model)}`} onClose={onClose} wide>
      <div className="grid gap-6 md:grid-cols-[1fr_1fr]">
        <div className="space-y-4">
          <Field label="Status">
            <select className="field" value={o.status} onChange={(e) => updateOrder(o.id, { status: e.target.value as OrderStatus })}>
              {ORDER_FLOW.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </Field>
          <dl className="grid grid-cols-[110px_1fr] gap-y-2 text-sm">
            <dt className="text-dust">Customer</dt><dd>{o.customer.name}</dd>
            <dt className="text-dust">Phone</dt><dd>{o.customer.phone} <span className="text-dust">({o.customer.channel})</span></dd>
            <dt className="text-dust">Car</dt><dd>{carLabel(o.car.model)} {o.car.year}</dd>
            <dt className="text-dust">Work</dt><dd>{o.services.map((s) => t(SERVICES.find((x) => x.id === s)!.key)).join(', ')}</dd>
            <dt className="text-dust">Wanted date</dt><dd>{o.date ? fmtDate(o.date) : '—'}</dd>
            <dt className="text-dust">Received</dt><dd>{fmtDate(o.createdAt)}</dd>
            {o.note && <><dt className="text-dust">Note</dt><dd>{o.note}</dd></>}
          </dl>
          {linkedParts.length > 0 && (
            <div className="text-sm">
              <p className="mb-1 text-dust">Parts requested</p>
              {linkedParts.map((p) => <p key={p.id}>{p.title} · {gel(p.price)}</p>)}
            </div>
          )}
          {o.photos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {o.photos.map((p, i) => <img key={i} src={p} alt="" className="size-20 rounded-lg object-cover" />)}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {o.look && (
            <div className="rounded-2xl bg-hide p-3">
              <Dashboard look={o.look} className="w-full" />
              <p className="mt-1 text-center text-sm text-dust">{lookLabel(o.look)}</p>
            </div>
          )}
          <div className="rounded-2xl border border-seam p-4">
            <p className="text-sm text-dust">Quote</p>
            <p className="font-display text-2xl">{o.quote ? gel(o.quote.total) : 'Not quoted yet'}</p>
            <Btn className="mt-3" onClick={() => navigate(`/admin/calculator?order=${o.id}`)}><Calculator size={15} /> {o.quote ? 'Edit quote' : 'Make a quote'}</Btn>
          </div>
          <div className="rounded-2xl border border-seam p-4">
            <p className="mb-2 text-sm text-dust">Book the car in</p>
            <div className="flex gap-2">
              <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
              <input type="time" className="field w-32" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <Btn className="mt-3" onClick={book}><CalendarPlus size={15} /> Add to calendar</Btn>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`https://wa.me/${phone}?text=${reply}`} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-thread px-3.5 py-2 text-sm font-semibold text-nappa">
              <MessageCircle size={15} /> Reply on WhatsApp
            </a>
            {(o.status === 'ready' || o.status === 'delivered') && !hasPost && (
              <Btn onClick={draftPost}><Megaphone size={15} /> Turn into a post</Btn>
            )}
          </div>
          {msg && <p role="status" className="text-sm text-ok">{msg}</p>}
        </div>
      </div>
    </Modal>
  )
}
