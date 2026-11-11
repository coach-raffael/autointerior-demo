import { useState } from 'react'
import { Mail, MessageCircle, PackageCheck, Plus, Trash2 } from 'lucide-react'
import { useStore, day } from '../store'
import { gel, type PurchaseOrder } from '../data'
import { Badge, Btn, Empty, Field, Modal, Page, fmtDate } from './ui'

const total = (p: PurchaseOrder) => p.items.reduce((s, i) => s + i.qty * i.price, 0)
const TONE = { draft: 'warn', sent: 'thread', received: 'ok' } as const

export default function Purchasing() {
  const { pos, suppliers, upsert } = useStore()
  const [openId, setOpenId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | PurchaseOrder['status']>('all')
  const open = pos.find((p) => p.id === openId)
  const list = pos.filter((p) => filter === 'all' || p.status === filter)

  const create = () => {
    const id = `PO-${2300 + Math.floor(Math.random() * 600)}`
    upsert('pos', { id, supplierId: suppliers.find((s) => s.kind === 'supplier')!.id, createdAt: day(0), status: 'draft', items: [{ name: '', qty: 1, unit: 'm²', price: 0 }] })
    setOpenId(id)
  }

  return (
    <Page title="Purchase orders" actions={<Btn variant="primary" onClick={create}><Plus size={15} /> New purchase order</Btn>}>
      <div className="mb-4 flex gap-2">
        {(['all', 'draft', 'sent', 'received'] as const).map((f) => (
          <Btn key={f} variant={filter === f ? 'ghost' : 'quiet'} onClick={() => setFilter(f)} aria-pressed={filter === f}>
            {f === 'all' ? 'All' : f === 'draft' ? 'Not sent' : f === 'sent' ? 'Awaiting delivery' : 'Received'}
          </Btn>
        ))}
      </div>
      {list.length === 0 ? <Empty>No purchase orders here. Create one, or send materials straight from the calculator.</Empty> : (
        <div className="overflow-x-auto rounded-2xl border border-seam">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-hide text-left text-xs text-dust">
              <tr><th className="px-4 py-3 font-normal">Number</th><th className="font-normal">Supplier</th><th className="font-normal">Items</th><th className="font-normal">For order</th><th className="font-normal">Created</th><th className="font-normal">Status</th><th className="px-4 text-right font-normal">Total</th></tr>
            </thead>
            <tbody className="divide-y divide-seam">
              {list.map((p) => (
                <tr key={p.id} onClick={() => setOpenId(p.id)} className="cursor-pointer hover:bg-hide/60">
                  <td className="px-4 py-3 font-semibold">{p.id}</td>
                  <td>{suppliers.find((s) => s.id === p.supplierId)?.name}</td>
                  <td className="max-w-56 truncate text-dust">{p.items.map((i) => i.name).filter(Boolean).join(', ') || '—'}</td>
                  <td>{p.orderRef ?? '—'}</td>
                  <td className="text-dust">{fmtDate(p.createdAt)}</td>
                  <td><Badge tone={TONE[p.status]}>{p.status === 'draft' ? 'not sent' : p.status}</Badge></td>
                  <td className="px-4 text-right">{gel(total(p))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && <PODetail po={open} onClose={() => setOpenId(null)} />}
    </Page>
  )
}

function PODetail({ po, onClose }: { po: PurchaseOrder; onClose: () => void }) {
  const { suppliers, upsert, remove } = useStore()
  const sup = suppliers.find((s) => s.id === po.supplierId)
  const set = (patch: Partial<PurchaseOrder>) => upsert('pos', { ...po, ...patch })
  const setItem = (i: number, patch: Partial<PurchaseOrder['items'][number]>) => set({ items: po.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) })

  const body = [
    `Hello ${sup?.contact ?? ''},`,
    `please send the following (our ref. ${po.id}${po.orderRef ? ' / ' + po.orderRef : ''}):`,
    ...po.items.filter((i) => i.name).map((i) => `• ${i.qty} ${i.unit} — ${i.name}`),
    '',
    'Delivery to: Auto Interiore, Tbilisi. Thank you!',
  ].join('\n')
  const phone = (sup?.phone ?? '').replace(/\D/g, '')
  const emailOk = sup?.email && sup.email.includes('@')

  return (
    <Modal title={`${po.id}`} onClose={onClose} wide>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Supplier">
          <select className="field" value={po.supplierId} onChange={(e) => set({ supplierId: e.target.value })} disabled={po.status !== 'draft'}>
            {suppliers.filter((s) => s.kind !== 'partner').map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="For customer order (optional)">
          <input className="field" value={po.orderRef ?? ''} onChange={(e) => set({ orderRef: e.target.value || undefined })} placeholder="AI-1040" />
        </Field>
      </div>
      {sup && <p className="mt-2 text-xs text-dust">{sup.contact} · {sup.phone} · usual lead time {sup.leadDays} day(s)</p>}

      <div className="mt-6 space-y-2">
        {po.items.map((it, i) => (
          <div key={i} className="grid grid-cols-[1fr_70px_70px_80px_28px] items-center gap-2">
            <input className="field" value={it.name} placeholder="Item" onChange={(e) => setItem(i, { name: e.target.value })} disabled={po.status !== 'draft'} aria-label="Item" />
            <input className="field" type="number" value={it.qty} onChange={(e) => setItem(i, { qty: Number(e.target.value) })} disabled={po.status !== 'draft'} aria-label="Qty" />
            <input className="field" value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value })} disabled={po.status !== 'draft'} aria-label="Unit" />
            <input className="field" type="number" value={it.price} onChange={(e) => setItem(i, { price: Number(e.target.value) })} disabled={po.status !== 'draft'} aria-label="Price" />
            {po.status === 'draft' && <button onClick={() => set({ items: po.items.filter((_, j) => j !== i) })} aria-label="Remove" className="text-dust hover:text-warn"><Trash2 size={15} /></button>}
          </div>
        ))}
        {po.status === 'draft' && <Btn variant="quiet" onClick={() => set({ items: [...po.items, { name: '', qty: 1, unit: 'pc', price: 0 }] })}><Plus size={14} /> Add item</Btn>}
      </div>
      <p className="mt-4 text-right">Total <span className="font-display text-xl text-thread">{gel(total(po))}</span></p>

      <div className="mt-6 rounded-2xl border border-seam p-4">
        <p className="mb-2 text-sm text-dust">Message to the supplier</p>
        <pre className="whitespace-pre-wrap font-body text-sm">{body}</pre>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {po.status === 'draft' && (
          <>
            {emailOk && <a className="inline-flex items-center gap-1.5 rounded-full bg-thread px-3.5 py-2 text-sm font-semibold text-nappa" onClick={() => set({ status: 'sent' })}
              href={`mailto:${sup!.email}?subject=${encodeURIComponent('Order ' + po.id)}&body=${encodeURIComponent(body)}`}><Mail size={15} /> Send by email</a>}
            {phone && <a className="inline-flex items-center gap-1.5 rounded-full border border-seam px-3.5 py-2 text-sm" onClick={() => set({ status: 'sent' })} target="_blank" rel="noreferrer"
              href={`https://wa.me/${phone}?text=${encodeURIComponent(body)}`}><MessageCircle size={15} /> Send on WhatsApp</a>}
            <Btn variant="quiet" onClick={() => { remove('pos', po.id); onClose() }}><Trash2 size={15} /> Delete draft</Btn>
          </>
        )}
        {po.status === 'sent' && <Btn variant="primary" onClick={() => set({ status: 'received' })}><PackageCheck size={15} /> Mark as received</Btn>}
        {po.status === 'received' && <Badge tone="ok">Delivered and booked in</Badge>}
      </div>
    </Modal>
  )
}
