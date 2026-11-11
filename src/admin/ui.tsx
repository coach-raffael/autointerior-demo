import { useEffect } from 'react'
import { X } from 'lucide-react'

export function Page({ title, actions, children }: { title: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="px-4 py-6 sm:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        <div className="flex flex-wrap gap-2">{actions}</div>
      </div>
      {children}
    </div>
  )
}

export function Panel({ title, right, children, className = '' }: { title?: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-seam bg-hide/70 ${className}`}>
      {title && (
        <div className="flex items-center justify-between border-b border-seam px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {right}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  )
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'quiet' }
export function Btn({ variant = 'ghost', className = '', ...p }: BtnProps) {
  const v = {
    primary: 'bg-thread text-nappa font-semibold hover:bg-[#ffd447]',
    ghost: 'border border-seam hover:border-dust',
    quiet: 'text-dust hover:text-chalk',
  }[variant]
  return <button {...p} className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm transition disabled:opacity-40 ${v} ${className}`} />
}

export function Badge({ tone = 'muted', children }: { tone?: 'muted' | 'thread' | 'ok' | 'warn'; children: React.ReactNode }) {
  const c = { muted: 'bg-seam text-chalk', thread: 'bg-thread/15 text-thread', ok: 'bg-ok/15 text-ok', warn: 'bg-warn/15 text-warn' }[tone]
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${c}`}>{children}</span>
}

export function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs text-dust">{label}</span>
      {children}
    </label>
  )
}

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        className={`h-full w-full overflow-y-auto border-l border-seam bg-nappa ${wide ? 'max-w-3xl' : 'max-w-xl'}`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-seam bg-nappa px-5 py-4">
          <h2 className="font-display text-lg">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-dust hover:text-chalk"><X /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-dashed border-seam px-4 py-8 text-center text-sm text-dust">{children}</p>
}

export const fmtDate = (iso: string) => new Date(iso.length === 10 ? iso + 'T12:00' : iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
export const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
