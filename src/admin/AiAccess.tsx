import { useEffect, useState } from 'react'
import { Copy, Unplug } from 'lucide-react'
import { api } from '../api'
import { useStore } from '../store'
import { Badge, Btn, Empty, Page, Panel, fmtDateTime } from './ui'

type Mode = 'ALLOW' | 'APPROVAL' | 'DENY'
interface Policy { tool: string; title: string; area: string; readOnly: boolean; default: Mode; mode: Mode }
interface Client { clientId: string; name: string; createdAt: string; lastToken: string | null; connected: boolean }

const AREAS: Record<string, string> = { system: 'General', website: 'Website & parts', workshop: 'Orders & calendar', purchasing: 'Purchasing', social: 'Social media' }
const MODE_HINT: Record<Mode, string> = { ALLOW: 'Runs right away', APPROVAL: 'Waits for you', DENY: 'Switched off' }

export default function AiAccess() {
  const [policies, setPolicies] = useState<Policy[]>([])
  const [clients, setClients] = useState<{ endpoint: string; clients: Client[] } | null>(null)
  const [copied, setCopied] = useState(false)
  const fail = (e: unknown) => useStore.setState({ error: e instanceof Error ? e.message : String(e) })

  const load = () => Promise.all([api<Policy[]>('/admin/mcp/policies').then(setPolicies), api<{ endpoint: string; clients: Client[] }>('/admin/mcp/clients').then(setClients)]).catch(fail)
  useEffect(() => { load() }, [])

  const setMode = async (p: Policy, mode: Mode) => {
    setPolicies((ps) => ps.map((x) => (x.tool === p.tool ? { ...x, mode } : x)))
    await api(`/admin/mcp/policies/${p.tool}`, { method: 'PUT', json: { mode } }).catch((e) => { fail(e); load() })
  }
  const disconnect = async (c: Client) => {
    if (!window.confirm(`Disconnect ${c.name}? It loses access immediately and has to be connected again.`)) return
    await api(`/admin/mcp/clients/${c.clientId}`, { method: 'DELETE' }).catch(fail)
    load()
  }

  const groups = Object.keys(AREAS).map((a) => ({ area: a, items: policies.filter((p) => p.area === a) })).filter((g) => g.items.length)

  return (
    <Page title="AI access">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="Connect Claude">
          <p className="text-sm text-dust">Add this address as a custom connector in Claude. Claude opens a page where you sign in with your admin account and allow access.</p>
          {clients && (
            <div className="mt-3 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-xl bg-nappa px-3 py-2.5 text-sm">{clients.endpoint}</code>
              <Btn onClick={() => { navigator.clipboard?.writeText(clients.endpoint); setCopied(true); setTimeout(() => setCopied(false), 1500) }}><Copy size={15} /> {copied ? 'Copied' : 'Copy'}</Btn>
            </div>
          )}
        </Panel>
        <Panel title="Connected assistants">
          {!clients ? <p className="text-sm text-dust">Loading…</p> : clients.clients.length === 0 ? <Empty>No assistant connected yet.</Empty> : (
            <ul className="divide-y divide-seam">
              {clients.clients.map((c) => (
                <li key={c.clientId} className="flex flex-wrap items-center gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{c.name}</span>
                    <span className="block text-xs text-dust">since {fmtDateTime(c.createdAt)}{c.lastToken && ` · last sign-in ${fmtDateTime(c.lastToken)}`}</span>
                  </span>
                  <Badge tone={c.connected ? 'ok' : 'muted'}>{c.connected ? 'connected' : 'signed out'}</Badge>
                  {c.connected && <Btn variant="quiet" onClick={() => disconnect(c)}><Unplug size={15} /> Disconnect</Btn>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <h2 className="mt-8 mb-1 font-display text-lg">What assistants may do</h2>
      <p className="mb-4 max-w-2xl text-sm text-dust">Reading is always allowed. For every action you decide: run it right away, wait for your approval, or switch it off.</p>
      <div className="space-y-4">
        {groups.map((g) => (
          <Panel key={g.area} title={AREAS[g.area]}>
            <ul className="divide-y divide-seam">
              {g.items.map((p) => (
                <li key={p.tool} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5">
                  <span className="min-w-0">
                    <span className="block text-sm">{p.title}</span>
                    <span className="block text-xs text-dust">{p.tool}{p.mode !== p.default && ` · default ${p.default.toLowerCase()}`}</span>
                  </span>
                  {p.readOnly ? <span className="text-xs text-dust">read only</span> : (
                    <div className="inline-flex flex-wrap gap-0.5 rounded-full border border-seam p-1" role="radiogroup" aria-label={p.title}>
                      {(['ALLOW', 'APPROVAL', 'DENY'] as Mode[]).map((m) => (
                        <button key={m} role="radio" aria-checked={p.mode === m} title={MODE_HINT[m]} onClick={() => setMode(p, m)}
                          className={`rounded-full px-3 py-1 text-xs whitespace-nowrap transition ${p.mode === m ? (m === 'DENY' ? 'bg-warn text-nappa' : m === 'APPROVAL' ? 'bg-thread text-nappa' : 'bg-chalk text-nappa') : 'text-dust hover:text-chalk'}`}>
                          {m === 'ALLOW' ? 'Allow' : m === 'APPROVAL' ? 'Ask me' : 'Off'}
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
    </Page>
  )
}
