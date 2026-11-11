import { useEffect, useState } from 'react'
import { NavLink, Outlet, Link } from 'react-router-dom'
import { Bot, CalendarDays, Calculator, ClipboardList, Contact, ExternalLink, Images, LayoutDashboard, LogOut, Menu, Megaphone, Package, RotateCcw, ShieldCheck, Truck, X } from 'lucide-react'
import { useStore } from '../store'
import { api, apiMode } from '../api'
import { Wordmark } from '../site/Site'
import Login from './Login'

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/orders', label: 'Orders', icon: ClipboardList },
  { to: '/admin/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/admin/calculator', label: 'Calculator', icon: Calculator },
  { to: '/admin/purchasing', label: 'Purchase orders', icon: Truck },
  { to: '/admin/contacts', label: 'Suppliers & dealers', icon: Contact },
  { to: '/admin/gallery', label: 'Website gallery', icon: Images },
  { to: '/admin/parts', label: 'Parts shop', icon: Package },
  { to: '/admin/content', label: 'Social content', icon: Megaphone },
  { to: '/admin/approvals', label: 'Approvals', icon: ShieldCheck },
  { to: '/admin/ai', label: 'AI access', icon: Bot },
]

type User = { id: number; email: string; name: string } | null

export default function AdminLayout() {
  const newCount = useStore((s) => s.orders.filter((o) => o.status === 'new').length)
  const draftPosts = useStore((s) => s.posts.filter((p) => p.status === 'draft').length)
  const { resetDemo, loadAdmin, ready, error, clearError } = useStore()
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<User | undefined>(apiMode ? undefined : null)
  const [pending, setPending] = useState(0)

  // API mode: who is signed in? then load everything once
  useEffect(() => {
    if (!apiMode) return
    api<{ user: User }>('/auth/me').then((r) => setUser(r.user)).catch(() => setUser(null))
  }, [])
  useEffect(() => {
    if (!apiMode || !user) return
    loadAdmin().catch((e) => useStore.setState({ error: e.message }))
    const poll = () => api<unknown[]>('/admin/approvals?status=pending').then((r) => setPending(r.length)).catch(() => {})
    poll()
    const t = setInterval(() => { poll(); loadAdmin().catch(() => {}) }, 30_000)
    return () => clearInterval(t)
  }, [user, loadAdmin])

  if (apiMode && user === undefined) return <div className="min-h-screen" aria-busy="true" />
  if (apiMode && !user) return <Login onSignedIn={setUser} />

  const badge = (label: string) =>
    label === 'Orders' && newCount > 0 ? <span className="rounded-full bg-thread px-1.5 text-xs font-semibold text-nappa">{newCount}</span>
      : label === 'Social content' && draftPosts > 0 ? <span className="rounded-full bg-seam px-1.5 text-xs">{draftPosts}</span>
        : label === 'Approvals' && pending > 0 ? <span className="rounded-full bg-thread px-1.5 text-xs font-semibold text-nappa">{pending}</span>
          : null
  const visible = NAV.filter((n) => apiMode || (n.to !== '/admin/approvals' && n.to !== '/admin/ai'))

  const nav = (
    <nav className="space-y-0.5">
      {visible.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}
          className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${isActive ? 'bg-hide text-chalk' : 'text-dust hover:text-chalk'}`}>
          <Icon size={17} />
          <span className="flex-1">{label}</span>
          {badge(label)}
        </NavLink>
      ))}
    </nav>
  )

  const signOut = async () => { await api('/auth/logout', { method: 'POST' }).catch(() => {}); setUser(null) }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="hidden border-r border-seam p-4 lg:flex lg:flex-col">
        <Link to="/admin" className="mb-8 px-3 pt-2"><Wordmark small /></Link>
        {nav}
        <div className="mt-auto space-y-1 pt-6">
          {user && <p className="truncate px-3 text-xs text-dust" title={user.email}>{user.email}</p>}
          <Link to="/" className="flex items-center gap-2 px-3 py-2 text-sm text-dust hover:text-chalk"><ExternalLink size={15} /> View website</Link>
          {apiMode
            ? <button onClick={signOut} className="flex items-center gap-2 px-3 py-2 text-sm text-dust hover:text-chalk"><LogOut size={15} /> Sign out</button>
            : <button onClick={() => confirmReset(resetDemo)} className="flex items-center gap-2 px-3 py-2 text-sm text-dust hover:text-chalk"><RotateCcw size={15} /> Reset demo data</button>}
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-seam bg-nappa/90 px-4 backdrop-blur lg:hidden">
        <Wordmark small />
        <button onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}><Menu /></button>
      </header>
      {open && <div className="border-b border-seam p-3 lg:hidden">{nav}{apiMode && <button onClick={signOut} className="mt-2 flex items-center gap-2 px-3 py-2 text-sm text-dust"><LogOut size={15} /> Sign out</button>}</div>}

      <main className="min-w-0">
        {ready ? <Outlet /> : <p className="p-8 text-sm text-dust" aria-busy="true">Loading the workshop…</p>}
      </main>

      {error && (
        <div role="alert" className="fixed right-4 bottom-4 left-4 z-50 flex items-start gap-3 rounded-2xl border border-warn/40 bg-hide p-4 text-sm shadow-lg sm:left-auto sm:max-w-md">
          <span className="flex-1">{error}</span>
          <button onClick={clearError} aria-label="Dismiss" className="text-dust hover:text-chalk"><X size={16} /></button>
        </div>
      )}
    </div>
  )
}

function confirmReset(reset: () => void) {
  // inline confirm keeps the demo self-contained; replaced by a proper dialog in production
  if (window.confirm('Reset all demo data to the sample set?')) reset()
}
