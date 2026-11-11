import { useState } from 'react'
import { Eye, EyeOff, ImagePlus, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { BRANDS } from '../data'
import type { GalleryItem } from '../api'
import { Badge, Btn, Empty, Field, Modal, Page } from './ui'

type Draft = Partial<GalleryItem> & { file?: Blob; previewUrl?: string }
const blank = (): Draft => ({ brand: 'bmw', title: { en: '', ka: '', ru: '' }, caption: { en: '', ka: '', ru: '' }, focus: '50% 50%', published: true })

export default function GalleryAdmin() {
  const { gallery, saveGalleryItem, removeGalleryItem } = useStore()
  const [edit, setEdit] = useState<Draft | null>(null)

  return (
    <Page title="Website gallery" actions={<Btn variant="primary" onClick={() => setEdit(blank())}><ImagePlus size={15} /> Add photo</Btn>}>
      <p className="-mt-3 mb-5 text-sm text-dust">The “Recent work” photos on the website, newest first. Hidden photos stay here but not on the site.</p>
      {gallery.length === 0 ? <Empty>No photos yet. Add your first finished dashboard.</Empty> : (
        <div className="grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 sm:grid-cols-[repeat(3,minmax(0,1fr))] xl:grid-cols-[repeat(5,minmax(0,1fr))]">
          {gallery.map((g) => (
            <article key={g.id} className={`overflow-hidden rounded-2xl border border-seam bg-hide/70 ${g.published ? '' : 'opacity-60'}`}>
              <button onClick={() => setEdit({ ...g })} className="block w-full text-left">
                <img src={g.image} alt="" style={{ objectPosition: g.focus }} className="aspect-[3/4] w-full object-cover" />
                <span className="block p-3">
                  <span className="block truncate text-sm font-semibold">{g.title.en}</span>
                  <span className="block truncate text-xs text-dust">{g.caption.en}</span>
                </span>
              </button>
              <div className="flex items-center justify-between px-3 pb-3">
                {g.published ? <Badge tone="ok">on website</Badge> : <Badge>hidden</Badge>}
                <button onClick={() => saveGalleryItem({ id: g.id, published: !g.published })} aria-label={g.published ? 'Hide' : 'Show'} className="text-dust hover:text-chalk">
                  {g.published ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {edit && <GalleryForm draft={edit} onClose={() => setEdit(null)} onSave={saveGalleryItem} onDelete={removeGalleryItem} />}
    </Page>
  )
}

function GalleryForm({ draft, onClose, onSave, onDelete }: { draft: Draft; onClose: () => void; onSave: (d: Draft) => Promise<void>; onDelete: (id: string) => Promise<void> }) {
  const [d, setD] = useState<Draft>(draft)
  const [busy, setBusy] = useState(false)
  const isNew = !d.id
  const img = d.previewUrl ?? d.image
  const setText = (k: 'title' | 'caption', lang: 'en' | 'ka' | 'ru', v: string) => setD({ ...d, [k]: { ...(d[k] ?? { en: '', ka: '', ru: '' }), [lang]: v } })
  const [fx, fy] = (d.focus ?? '50% 50%').split(' ').map((x) => parseInt(x))

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isNew && !d.file) return
    setBusy(true)
    const fill = (t?: { en: string; ka: string; ru: string }) => t && ({ en: t.en, ka: t.ka || t.en, ru: t.ru || t.en })
    await onSave({ ...d, title: fill(d.title), caption: fill(d.caption) })
    setBusy(false)
    if (!useStore.getState().error) onClose()
  }

  return (
    <Modal title={isNew ? 'Add a photo' : d.title?.en || 'Photo'} onClose={onClose} wide>
      <form onSubmit={save} className="grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]">
        <div>
          {img ? (
            <div className="relative">
              <img src={img} alt="" style={{ objectPosition: d.focus }} className="aspect-[3/4] w-full rounded-2xl object-cover" />
              <span aria-hidden className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-thread" style={{ left: `${fx}%`, top: `${fy}%` }} />
            </div>
          ) : <div className="grid aspect-[3/4] place-items-center rounded-2xl border-2 border-dashed border-seam text-sm text-dust">No photo yet</div>}
          {isNew && (
            <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-full border border-seam px-3 py-2 text-sm hover:border-thread">
              <ImagePlus size={15} /> Choose photo
              <input type="file" accept="image/*" className="sr-only" required onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) setD({ ...d, file: f, previewUrl: URL.createObjectURL(f) })
              }} />
            </label>
          )}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Field label="Focus left–right"><input type="range" min={0} max={100} value={fx} onChange={(e) => setD({ ...d, focus: `${e.target.value}% ${fy}%` })} className="w-full accent-[#f2c230]" /></Field>
            <Field label="Focus top–bottom"><input type="range" min={0} max={100} value={fy} onChange={(e) => setD({ ...d, focus: `${fx}% ${e.target.value}%` })} className="w-full accent-[#f2c230]" /></Field>
          </div>
        </div>
        <div className="grid content-start gap-3">
          <Field label="Make">
            <select className="field" value={d.brand} onChange={(e) => setD({ ...d, brand: e.target.value })}>
              {BRANDS.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
          {(['en', 'ka', 'ru'] as const).map((l) => (
            <div key={l} className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
              <Field label={`Car (${l === 'en' ? 'English' : l === 'ka' ? 'Georgian' : 'Russian'})`}><input className="field" required={l === 'en'} value={d.title?.[l] ?? ''} onChange={(e) => setText('title', l, e.target.value)} placeholder={l === 'en' ? 'Mercedes C-Class W205' : 'same as English'} /></Field>
              <Field label={`What was done (${l})`}><input className="field" required={l === 'en'} value={d.caption?.[l] ?? ''} onChange={(e) => setText('caption', l, e.target.value)} placeholder={l === 'en' ? 'Dashboard in black nappa' : 'same as English'} /></Field>
            </div>
          ))}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={d.published ?? true} onChange={(e) => setD({ ...d, published: e.target.checked })} className="accent-[#f2c230]" /> Show on the website
          </label>
          <div className="mt-2 flex justify-between">
            {!isNew ? <Btn type="button" variant="quiet" onClick={async () => { if (window.confirm('Remove this photo from the gallery?')) { await onDelete(d.id!); onClose() } }}><Trash2 size={15} /> Remove</Btn> : <span />}
            <Btn variant="primary" type="submit" disabled={busy || (isNew && !d.file)}>{busy ? 'Saving…' : isNew ? 'Add photo' : 'Save changes'}</Btn>
          </div>
        </div>
      </form>
    </Modal>
  )
}
