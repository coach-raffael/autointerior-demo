import { Link } from 'react-router-dom'
import { useStore, day } from '../store'
import { carLabel, gel, ORDER_FLOW } from '../data'
import { Badge, Page, Panel, Empty, fmtDate } from './ui'

export default function Overview() {
  const { orders, events, pos, parts, posts, suppliers } = useStore()
  const today = day(0)
  const weekEnd = day(7)
  const todays = events.filter((e) => e.date === today).sort((a, b) => a.start.localeCompare(b.start))
  const week = events.filter((e) => e.date >= today && e.date <= weekEnd && e.kind === 'appointment')
  const fresh = orders.filter((o) => o.status === 'new')
  const quotedValue = orders.filter((o) => o.quote && o.status !== 'delivered').reduce((s, o) => s + (o.quote?.total ?? 0), 0)
  const openPO = pos.filter((p) => p.status !== 'received')
  const lowStock = parts.filter((p) => p.published && p.stock === 0)

  const stats = [
    { label: 'New requests', value: fresh.length, to: '/admin/orders' },
    { label: 'Cars in the workshop', value: orders.filter((o) => o.status === 'workshop').length, to: '/admin/orders' },
    { label: 'Drop-offs next 7 days', value: week.length, to: '/admin/calendar' },
    { label: 'Quoted, not yet delivered', value: gel(quotedValue), to: '/admin/orders' },
  ]

  return (
    <Page title="Good morning">
      <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 lg:grid-cols-[repeat(4,minmax(0,1fr))]">
        {stats.map((s) => (
          <Link key={s.label} to={s.to} className="rounded-2xl border border-seam bg-hide/70 p-4 transition hover:border-dust">
            <p className="font-display text-2xl">{s.value}</p>
            <p className="mt-1 text-sm text-dust">{s.label}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Panel title="New requests" right={<Link to="/admin/orders" className="text-xs text-dust hover:text-chalk">All orders</Link>}>
          {fresh.length === 0 ? <Empty>No new requests. They appear here as soon as someone books on the website.</Empty> : (
            <ul className="divide-y divide-seam">
              {fresh.map((o) => (
                <li key={o.id} className="flex items-center gap-3 py-3">
                  {o.photos[0] ? <img src={o.photos[0]} alt="" className="size-12 rounded-lg object-cover" /> : <span className="size-12 rounded-lg bg-seam" />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{carLabel(o.car.model)} <span className="font-normal text-dust">{o.car.year}</span></p>
                    <p className="truncate text-sm text-dust">{o.customer.name} · {o.customer.phone}</p>
                  </div>
                  <div className="shrink-0 text-right text-sm">
                    <Badge tone="thread">{o.id}</Badge>
                    {o.date && <p className="mt-1 text-dust">wants {fmtDate(o.date)}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title={`Today, ${fmtDate(today)}`} right={<Link to="/admin/calendar" className="text-xs text-dust hover:text-chalk">Calendar</Link>}>
          {todays.length === 0 ? <Empty>Nothing booked today.</Empty> : (
            <ul className="space-y-2">
              {todays.map((e) => (
                <li key={e.id} className="flex gap-3 rounded-xl bg-nappa p-3">
                  <span className="w-12 shrink-0 font-display text-sm text-thread">{e.start}</span>
                  <span className="text-sm">{e.title}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Workshop pipeline">
          <div className="space-y-2">
            {ORDER_FLOW.map((s) => {
              const n = orders.filter((o) => o.status === s.id).length
              return (
                <div key={s.id} className="flex items-center gap-3 text-sm">
                  <span className="w-28 shrink-0 text-dust">{s.label}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-nappa">
                    <span className="block h-full rounded-full bg-thread" style={{ width: `${Math.min(100, n * 20)}%` }} />
                  </span>
                  <span className="w-6 text-right">{n}</span>
                </div>
              )
            })}
          </div>
        </Panel>

        <Panel title="Needs attention">
          <ul className="space-y-2 text-sm">
            {openPO.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <Link to="/admin/purchasing" className="hover:text-thread">{p.id} to {suppliers.find((s) => s.id === p.supplierId)?.name}</Link>
                <Badge tone={p.status === 'draft' ? 'warn' : 'muted'}>{p.status === 'draft' ? 'not sent' : 'awaiting delivery'}</Badge>
              </li>
            ))}
            {lowStock.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <Link to="/admin/parts" className="hover:text-thread">{carLabel(p.model)}: {p.title}</Link>
                <Badge tone="warn">out of stock, still listed</Badge>
              </li>
            ))}
            <li className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <Link to="/admin/content" className="hover:text-thread">Social posts waiting for approval</Link>
              <Badge tone="thread">{posts.filter((p) => p.status === 'draft').length}</Badge>
            </li>
          </ul>
        </Panel>
      </div>
    </Page>
  )
}
