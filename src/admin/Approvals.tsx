import { Fragment, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, X } from 'lucide-react'
import { api } from '../api'
import { useStore } from '../store'
import { Badge, Btn, Empty, Page, fmtDateTime } from './ui'

interface Approval {
  id: string; tool: string; toolTitle: string; summary: string; args: Record<string, unknown>; status: 'pending' | 'approved' | 'rejected' | 'failed'
  requestedBy: string; decidedBy: string | null; decidedAt: string | null; createdAt: string; preview: string | null; error: string | null
}
const TONE = { pending: 'thread', approved: 'ok', rejected: 'muted', failed: 'warn' } as const

export default function Approvals() {
  const [items, setItems] = useState<Approval[] | null>(null)
  const [tab, setTab] = useState<'pending' | 'all'>('pending')
  const [busy, setBusy] = useState<string | null>(null)
  const [params] = useSearchParams()
  const focus = params.get('id')
  const loadAdmin = useStore((s) => s.loadAdmin)

  const load = useCallback(() => api<Approval[]>(`/admin/approvals${tab === 'pending' ? '?status=pending' : ''}`).then(setItems).catch((e) => useStore.setState({ error: e.message })), [tab])
  useEffect(() => { load() }, [load])

  const decide = async (a: Approval, approve: boolean) => {
    setBusy(a.id)
    try {
      const r = await api<Approval>(`/admin/approvals/${a.id}/${approve ? 'approve' : 'reject'}`, { method: 'POST' })
      if (r.status === 'failed') useStore.setState({ error: `“${a.summary}” could not run: ${r.error}` })
      await Promise.all([load(), loadAdmin()])
    } catch (e) {
      useStore.setState({ error: e instanceof Error ? e.message : String(e) })
    } finally { setBusy(null) }
  }

  return (
    <Page title="Approvals">
      <p className="-mt-3 mb-5 max-w-2xl text-sm text-dust">
        Actions an AI assistant asked to do that change the website, send messages or delete data. Nothing happens until you approve; approved actions run immediately.
      </p>
      <div className="mb-4 flex gap-2">
        <Btn variant={tab === 'pending' ? 'ghost' : 'quiet'} aria-pressed={tab === 'pending'} onClick={() => setTab('pending')}>Waiting</Btn>
        <Btn variant={tab === 'all' ? 'ghost' : 'quiet'} aria-pressed={tab === 'all'} onClick={() => setTab('all')}>History</Btn>
      </div>
      {items === null ? <p className="text-sm text-dust" aria-busy="true">Loading…</p> : items.length === 0 ? (
        <Empty>{tab === 'pending' ? 'Nothing is waiting for you.' : 'No AI actions yet. Connect Claude under AI access.'}</Empty>
      ) : (
        <ul className="space-y-3">
          {items.map((a) => (
            <li key={a.id} className={`rounded-2xl border bg-hide/70 p-4 ${focus === a.id ? 'border-thread' : 'border-seam'}`}>
              <div className="flex flex-wrap gap-4">
                {a.preview && <img src={a.preview} alt="" className="size-24 shrink-0 rounded-xl object-cover" />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={TONE[a.status]}>{a.status === 'pending' ? 'waiting' : a.status}</Badge>
                    <span className="text-xs text-dust">{a.toolTitle} · {a.requestedBy} · {fmtDateTime(a.createdAt)}</span>
                  </div>
                  <p className="mt-2 font-semibold">{a.summary}</p>
                  <Details args={a.args} />
                  {a.status === 'failed' && a.error && <p className="mt-2 text-sm text-warn">{a.error}</p>}
                  {a.decidedBy && <p className="mt-2 text-xs text-dust">{a.status === 'rejected' ? 'Rejected' : 'Approved'} by {a.decidedBy}{a.decidedAt && `, ${fmtDateTime(a.decidedAt)}`}</p>}
                </div>
                {a.status === 'pending' && (
                  <div className="flex items-start gap-2">
                    <Btn variant="quiet" disabled={busy === a.id} onClick={() => decide(a, false)}><X size={15} /> Reject</Btn>
                    <Btn variant="primary" disabled={busy === a.id} onClick={() => decide(a, true)}><Check size={15} /> Approve</Btn>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}

/** The arguments as readable lines; long text and ids stay short. */
function Details({ args }: { args: Record<string, unknown> }) {
  const rows = Object.entries(args).filter(([k]) => k !== 'media_id')
  if (!rows.length) return null
  const show = (v: unknown): string => typeof v === 'object' && v !== null
    ? Object.entries(v as Record<string, unknown>).map(([k, x]) => `${k}: ${typeof x === 'object' ? JSON.stringify(x) : String(x)}`).join(' · ')
    : String(v)
  return (
    <dl className="mt-2 grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
      {rows.map(([k, v]) => (<Fragment key={k}><dt className="truncate text-dust">{k}</dt><dd className="break-words">{show(v)}</dd></Fragment>))}
    </dl>
  )
}
