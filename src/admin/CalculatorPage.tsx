import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check, Copy, Plus, Trash2, Truck } from 'lucide-react'
import { useStore, day } from '../store'
import { DEFAULT_RATE, JOB_TEMPLATES, MATERIALS, VAT, carLabel, gel, quoteTotal, type QuoteLine } from '../data'
import { Btn, Field, Page, Panel } from './ui'

const fromTemplate = (key: string): QuoteLine[] =>
  JOB_TEMPLATES[key].lines.map((l) => {
    const m = MATERIALS.find((x) => x.id === l.mat)!
    return { label: m.label, qty: l.qty, unit: m.unit, price: m.price }
  })

export default function CalculatorPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { orders, suppliers, updateOrder, upsert } = useStore()
  const order = orders.find((o) => o.id === params.get('order'))
  const initialTpl = order?.services.includes('wheel') && !order.services.includes('dashboard') ? 'wheel' : 'dashboard'

  const [tpl, setTpl] = useState(initialTpl)
  const [lines, setLines] = useState<QuoteLine[]>(order?.quote?.lines ?? fromTemplate(initialTpl))
  const [hours, setHours] = useState(order?.quote?.labourHours ?? JOB_TEMPLATES[initialTpl].hours)
  const [rate, setRate] = useState(order?.quote?.rate ?? DEFAULT_RATE)
  const [margin, setMargin] = useState(order?.quote?.margin ?? 25)
  const [vat, setVat] = useState(order?.quote?.vat ?? true)
  const [done, setDone] = useState('')
  const [supplierId, setSupplierId] = useState(suppliers.find((s) => s.kind === 'supplier')?.id ?? '')

  const mat = lines.reduce((s, l) => s + l.qty * l.price, 0)
  const labour = hours * rate
  const net = (mat + labour) * (1 + margin / 100)
  const total = useMemo(() => quoteTotal({ lines, labourHours: hours, rate, margin, vat }), [lines, hours, rate, margin, vat])

  const applyTpl = (k: string) => { setTpl(k); setLines(fromTemplate(k)); setHours(JOB_TEMPLATES[k].hours) }
  const setLine = (i: number, patch: Partial<QuoteLine>) => setLines(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)))

  const text = [
    order ? `${carLabel(order.car.model)} — ${order.customer.name}` : JOB_TEMPLATES[tpl].label,
    ...lines.map((l) => `${l.label}: ${l.qty} ${l.unit}`),
    `Labour: ${hours} h`,
    `Total${vat ? ' incl. 18% VAT' : ''}: ${gel(total)}`,
  ].join('\n')

  const save = () => {
    if (!order) return
    updateOrder(order.id, { quote: { lines, labourHours: hours, rate, margin, vat, total }, status: order.status === 'new' ? 'quoted' : order.status })
    setDone(`Quote saved to ${order.id}.`)
  }
  const toPO = () => {
    const id = `PO-${2209 + Math.floor(Math.random() * 90)}`
    upsert('pos', { id, supplierId, createdAt: day(0), status: 'draft', orderRef: order?.id, items: lines.map((l) => ({ name: l.label, qty: l.qty, unit: l.unit, price: l.price })) })
    navigate('/admin/purchasing')
  }

  return (
    <Page title="Calculator" actions={order && <span className="text-sm text-dust">for {order.id} · {carLabel(order.car.model)}</span>}>
      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Panel title="Materials" right={
          <select className="field !w-auto !py-1.5 text-sm" value={tpl} onChange={(e) => applyTpl(e.target.value)} aria-label="Job template">
            {Object.entries(JOB_TEMPLATES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        }>
          <div className="space-y-2">
            <div className="hidden grid-cols-[1fr_80px_60px_90px_90px_32px] gap-2 px-1 text-xs text-dust sm:grid">
              <span>Item</span><span>Qty</span><span>Unit</span><span>Price ₾</span><span className="text-right">Line</span><span />
            </div>
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_70px_80px_32px] items-center gap-2 sm:grid-cols-[1fr_80px_60px_90px_90px_32px]">
                <input className="field col-span-4 sm:col-span-1" value={l.label} onChange={(e) => setLine(i, { label: e.target.value })} aria-label="Item" />
                <input className="field" type="number" step="0.1" value={l.qty} onChange={(e) => setLine(i, { qty: Number(e.target.value) })} aria-label="Quantity" />
                <span className="hidden text-sm text-dust sm:block">{l.unit}</span>
                <input className="field" type="number" value={l.price} onChange={(e) => setLine(i, { price: Number(e.target.value) })} aria-label="Unit price" />
                <span className="hidden text-right text-sm sm:block">{gel(l.qty * l.price)}</span>
                <button onClick={() => setLines(lines.filter((_, j) => j !== i))} aria-label="Remove line" className="text-dust hover:text-warn"><Trash2 size={16} /></button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2 pt-2">
              {MATERIALS.filter((m) => !lines.some((l) => l.label === m.label)).map((m) => (
                <Btn key={m.id} variant="quiet" onClick={() => setLines([...lines, { label: m.label, qty: 1, unit: m.unit, price: m.price }])}><Plus size={14} /> {m.label}</Btn>
              ))}
              <Btn variant="quiet" onClick={() => setLines([...lines, { label: 'Other', qty: 1, unit: 'pc', price: 0 }])}><Plus size={14} /> Custom line</Btn>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <Field label="Labour hours"><input className="field" type="number" value={hours} onChange={(e) => setHours(Number(e.target.value))} /></Field>
            <Field label="Rate ₾/h"><input className="field" type="number" value={rate} onChange={(e) => setRate(Number(e.target.value))} /></Field>
            <Field label="Margin %"><input className="field" type="number" value={margin} onChange={(e) => setMargin(Number(e.target.value))} /></Field>
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Quote">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-dust">Materials</dt><dd>{gel(mat)}</dd></div>
              <div className="flex justify-between"><dt className="text-dust">Labour ({hours} h × {rate} ₾)</dt><dd>{gel(labour)}</dd></div>
              <div className="flex justify-between"><dt className="text-dust">Margin {margin}%</dt><dd>{gel(net - mat - labour)}</dd></div>
              <label className="flex items-center justify-between">
                <span className="text-dust">VAT {VAT * 100}%</span>
                <input type="checkbox" checked={vat} onChange={(e) => setVat(e.target.checked)} className="accent-[#f2c230]" />
              </label>
            </dl>
            <div className="seam my-4" />
            <p className="flex items-end justify-between"><span className="text-dust">Customer price</span><span className="font-display text-3xl text-thread">{gel(total)}</span></p>
            <p className="mt-1 text-right text-xs text-dust">You keep ≈ {gel(net - mat)} (labour + margin, before tax)</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {order && <Btn variant="primary" onClick={save}><Check size={15} /> Save to {order.id}</Btn>}
              <Btn onClick={() => { navigator.clipboard?.writeText(text); setDone('Quote copied — paste it into WhatsApp.') }}><Copy size={15} /> Copy as message</Btn>
            </div>
            {done && <p role="status" className="mt-3 text-sm text-ok">{done}</p>}
          </Panel>
          <Panel title="Order the materials">
            <Field label="Supplier">
              <select className="field" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                {suppliers.filter((s) => s.kind === 'supplier').map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Btn className="mt-3" onClick={toPO}><Truck size={15} /> Create purchase order</Btn>
          </Panel>
        </div>
      </div>
    </Page>
  )
}
