import { useState } from 'react'
import { Megaphone, Minus, Plus, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { BRANDS, PART_KIND_LABEL, carLabel, gel, type Part, type PartKind } from '../data'
import { Badge, Btn, Field, Modal, Page } from './ui'

const COND = { exchange: 'Re-trimmed, exchange', used: 'Used core', new: 'New' }

export default function PartsAdmin() {
  const { parts, posts, upsert, createPost } = useStore()
  const [edit, setEdit] = useState<Part | null>(null)
  const [msg, setMsg] = useState('')
  const set = (p: Part, patch: Partial<Part>) => upsert('parts', { ...p, ...patch })

  return (
    <Page title="Parts shop" actions={
      <Btn variant="primary" onClick={() => setEdit({ id: `PT-${Date.now().toString(36).toUpperCase()}`, model: 'bmw-x5', kind: 'dashboard', condition: 'exchange', title: '', price: 0, stock: 1, published: false })}>
        <Plus size={15} /> Add part
      </Btn>
    }>
      <p className="-mt-3 mb-5 text-sm text-dust">Published parts appear on the website under the matching make and model.</p>
      {msg && <p role="status" className="mb-4 text-sm text-ok">{msg}</p>}
      <div className="overflow-x-auto rounded-2xl border border-seam">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-hide text-left text-xs text-dust">
            <tr><th className="px-4 py-3 font-normal">Part</th><th className="font-normal">Car</th><th className="font-normal">Condition</th><th className="font-normal">Price</th><th className="font-normal">Stock</th><th className="font-normal">On website</th><th className="px-4" /></tr>
          </thead>
          <tbody className="divide-y divide-seam">
            {parts.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3">
                  <button onClick={() => setEdit(p)} className="flex items-center gap-3 text-left hover:text-thread">
                    {p.img ? <img src={p.img} alt="" className="size-10 rounded-lg object-cover" /> : <span className="size-10 rounded-lg bg-seam" />}
                    <span><span className="block">{p.title}</span><span className="block text-xs text-dust">{PART_KIND_LABEL[p.kind]}</span></span>
                  </button>
                </td>
                <td>{carLabel(p.model)}</td>
                <td className="text-dust">{COND[p.condition]}</td>
                <td>{gel(p.price)}</td>
                <td>
                  <span className="inline-flex items-center gap-2">
                    <button onClick={() => set(p, { stock: Math.max(0, p.stock - 1) })} aria-label="Less" className="text-dust hover:text-chalk"><Minus size={14} /></button>
                    <span className={`w-4 text-center ${p.stock === 0 ? 'text-warn' : ''}`}>{p.stock}</span>
                    <button onClick={() => set(p, { stock: p.stock + 1 })} aria-label="More" className="text-dust hover:text-chalk"><Plus size={14} /></button>
                  </span>
                </td>
                <td>
                  <button role="switch" aria-checked={p.published} onClick={() => set(p, { published: !p.published })}
                    className={`relative h-6 w-11 rounded-full transition ${p.published ? 'bg-thread' : 'bg-seam'}`}>
                    <span className={`absolute top-0.5 size-5 rounded-full bg-chalk transition-all ${p.published ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </td>
                <td className="px-4 text-right">
                  {posts.some((x) => x.refId === p.id)
                    ? <Badge>post drafted</Badge>
                    : <Btn variant="quiet" onClick={async () => { await createPost('part', p.id); if (!useStore.getState().error) setMsg(`Post drafted for “${p.title}”. Review it under Social content.`) }}><Megaphone size={14} /> Post it</Btn>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {edit && <PartForm initial={edit} onClose={() => setEdit(null)} />}
    </Page>
  )
}

function PartForm({ initial, onClose }: { initial: Part; onClose: () => void }) {
  const { upsert, remove, parts } = useStore()
  const [p, setP] = useState(initial)
  const isNew = !parts.some((x) => x.id === initial.id)
  return (
    <Modal title={isNew ? 'New part' : p.title} onClose={onClose}>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (p.title.trim()) { upsert('parts', p); onClose() } }}>
        <Field label="Title" className="sm:col-span-2"><input className="field" value={p.title} onChange={(e) => setP({ ...p, title: e.target.value })} placeholder="Dashboard, black nappa, double stitch" required /></Field>
        <Field label="Car">
          <select className="field" value={p.model} onChange={(e) => setP({ ...p, model: e.target.value })}>
            {BRANDS.map((b) => <optgroup key={b.id} label={b.name}>{b.models.map((m) => <option key={m.id} value={m.id}>{m.name} {m.code}</option>)}</optgroup>)}
          </select>
        </Field>
        <Field label="Type">
          <select className="field" value={p.kind} onChange={(e) => setP({ ...p, kind: e.target.value as PartKind })}>
            {Object.entries(PART_KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Condition">
          <select className="field" value={p.condition} onChange={(e) => setP({ ...p, condition: e.target.value as Part['condition'] })}>
            {Object.entries(COND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Price ₾"><input className="field" type="number" value={p.price} onChange={(e) => setP({ ...p, price: Number(e.target.value) })} /></Field>
        <Field label="Stock"><input className="field" type="number" value={p.stock} onChange={(e) => setP({ ...p, stock: Number(e.target.value) })} /></Field>
        <label className="flex items-center gap-2 self-end pb-3 text-sm">
          <input type="checkbox" checked={p.published} onChange={(e) => setP({ ...p, published: e.target.checked })} className="accent-[#f2c230]" /> Show on website
        </label>
        <div className="flex justify-between sm:col-span-2">
          {!isNew ? <Btn type="button" variant="quiet" onClick={() => { remove('parts', p.id); onClose() }}><Trash2 size={15} /> Delete</Btn> : <span />}
          <Btn variant="primary" type="submit">{isNew ? 'Add part' : 'Save changes'}</Btn>
        </div>
      </form>
    </Modal>
  )
}
