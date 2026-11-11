import { useState } from 'react'
import { Mail, MessageCircle, Phone, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import type { Supplier, SupplierKind } from '../data'
import { Btn, Empty, Field, Modal, Page } from './ui'

const KINDS: { id: SupplierKind; label: string; hint: string }[] = [
  { id: 'supplier', label: 'Suppliers', hint: 'Leather, foam, thread and glue' },
  { id: 'dealer', label: 'Parts dealers', hint: 'Where cores and used parts come from' },
  { id: 'partner', label: 'Partners', hint: 'Garages and detailers who send customers' },
]

export default function Contacts() {
  const { suppliers, pos } = useStore()
  const [kind, setKind] = useState<SupplierKind>('supplier')
  const [edit, setEdit] = useState<Supplier | null>(null)
  const list = suppliers.filter((s) => s.kind === kind)
  const k = KINDS.find((x) => x.id === kind)!

  return (
    <Page title="Suppliers & dealers" actions={
      <Btn variant="primary" onClick={() => setEdit({ id: `C-${Date.now().toString(36).toUpperCase()}`, name: '', kind, category: '', contact: '', phone: '', email: '', city: 'Tbilisi', leadDays: 1 })}>
        <Plus size={15} /> Add contact
      </Btn>
    }>
      <div className="mb-2 flex flex-wrap gap-2">
        {KINDS.map((x) => (
          <Btn key={x.id} variant={kind === x.id ? 'ghost' : 'quiet'} aria-pressed={kind === x.id} onClick={() => setKind(x.id)}>
            {x.label} <span className="text-dust">{suppliers.filter((s) => s.kind === x.id).length}</span>
          </Btn>
        ))}
      </div>
      <p className="mb-5 text-sm text-dust">{k.hint}</p>

      {list.length === 0 ? <Empty>No contacts in this group yet.</Empty> : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((s) => {
            const openPOs = pos.filter((p) => p.supplierId === s.id && p.status !== 'received').length
            const phone = s.phone.replace(/\D/g, '')
            return (
              <article key={s.id} className="rounded-2xl border border-seam bg-hide/70 p-4">
                <button onClick={() => setEdit(s)} className="block w-full text-left">
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-sm text-dust">{s.category} · {s.city}</p>
                  <p className="mt-3 text-sm">{s.contact}</p>
                  <p className="text-xs text-dust">
                    {s.kind !== 'partner' && <>Lead time {s.leadDays} d</>}
                    {openPOs > 0 && <> · {openPOs} open order{openPOs > 1 ? 's' : ''}</>}
                  </p>
                </button>
                <div className="mt-3 flex gap-3 text-dust">
                  {phone && <a href={`tel:+${phone}`} aria-label="Call" className="hover:text-chalk"><Phone size={16} /></a>}
                  {phone && <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" aria-label="WhatsApp" className="hover:text-chalk"><MessageCircle size={16} /></a>}
                  {s.email.includes('@') && <a href={`mailto:${s.email}`} aria-label="Email" className="hover:text-chalk"><Mail size={16} /></a>}
                </div>
              </article>
            )
          })}
        </div>
      )}
      {edit && <ContactForm initial={edit} onClose={() => setEdit(null)} />}
    </Page>
  )
}

function ContactForm({ initial, onClose }: { initial: Supplier; onClose: () => void }) {
  const { upsert, remove, suppliers } = useStore()
  const [s, setS] = useState(initial)
  const isNew = !suppliers.some((x) => x.id === initial.id)
  const f = (k: keyof Supplier) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setS({ ...s, [k]: k === 'leadDays' ? Number(e.target.value) : e.target.value })

  return (
    <Modal title={isNew ? 'New contact' : s.name} onClose={onClose}>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (s.name.trim()) { upsert('suppliers', s); onClose() } }}>
        <Field label="Company" className="sm:col-span-2"><input className="field" value={s.name} onChange={f('name')} required /></Field>
        <Field label="Type">
          <select className="field" value={s.kind} onChange={f('kind')}>
            {KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
        </Field>
        <Field label="What they supply"><input className="field" value={s.category} onChange={f('category')} /></Field>
        <Field label="Contact person"><input className="field" value={s.contact} onChange={f('contact')} /></Field>
        <Field label="City"><input className="field" value={s.city} onChange={f('city')} /></Field>
        <Field label="Phone / WhatsApp"><input className="field" value={s.phone} onChange={f('phone')} /></Field>
        <Field label="Email"><input className="field" type="email" value={s.email} onChange={f('email')} /></Field>
        <Field label="Lead time (days)"><input className="field" type="number" value={s.leadDays} onChange={f('leadDays')} /></Field>
        <div className="flex items-end justify-between gap-2 sm:col-span-2">
          {!isNew ? <Btn type="button" variant="quiet" onClick={() => { remove('suppliers', s.id); onClose() }}><Trash2 size={15} /> Remove</Btn> : <span />}
          <Btn variant="primary" type="submit">{isNew ? 'Add contact' : 'Save changes'}</Btn>
        </div>
      </form>
    </Modal>
  )
}
