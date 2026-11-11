import { useState } from 'react'
import { NavLink, Outlet, Link } from 'react-router-dom'
import { CalendarDays, Calculator, ClipboardList, Contact, ExternalLink, LayoutDashboard, Menu, Megaphone, Package, RotateCcw, Truck } from 'lucide-react'
import { useStore } from '../store'
import { Wordmark } from '../site/Site'

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/orders', label: 'Orders', icon: ClipboardList },
  { to: '/admin/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/admin/calculator', label: 'Calculator', icon: Calculator },
  { to: '/admin/purchasing', label: 'Purchase orders', icon: Truck },
  { to: '/admin/contacts', label: 'Suppliers & dealers', icon: Contact },
  { to: '/admin/parts', label: 'Parts shop', icon: Package },
  { to: '/admin/content', label: 'Social content', icon: Megaphone },
]

export default function AdminLayout() {
  const newCount = useStore((s) => s.orders.filter((o) => o.status === 'new').length)
  const draftPosts = useStore((s) => s.posts.filter((p) => p.status === 'draft').length)
  const resetDemo = useStore((s) => s.resetDemo)
  const [open, setOpen] = useState(false)

  const nav = (
    <nav className="space-y-0.5">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}
          className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${isActive ? 'bg-hide text-chalk' : 'text-dust hover:text-chalk'}`}>
          <Icon size={17} />
          <span className="flex-1">{label}</span>
          {label === 'Orders' && newCount > 0 && <span className="rounded-full bg-thread px-1.5 text-xs font-semibold text-nappa">{newCount}</span>}
          {label === 'Social content' && draftPosts > 0 && <span className="rounded-full bg-seam px-1.5 text-xs">{draftPosts}</span>}
        </NavLink>
      ))}
    </nav>
  )

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="hidden border-r border-seam p-4 lg:flex lg:flex-col">
        <Link to="/admin" className="mb-8 px-3 pt-2"><Wordmark small /></Link>
        {nav}
        <div className="mt-auto space-y-1 pt-6">
          <Link to="/" className="flex items-center gap-2 px-3 py-2 text-sm text-dust hover:text-chalk"><ExternalLink size={15} /> View website</Link>
          <button onClick={() => confirmReset(resetDemo)} className="flex items-center gap-2 px-3 py-2 text-sm text-dust hover:text-chalk"><RotateCcw size={15} /> Reset demo data</button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-seam bg-nappa/90 px-4 backdrop-blur lg:hidden">
        <Wordmark small />
        <button onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}><Menu /></button>
      </header>
      {open && <div className="border-b border-seam p-3 lg:hidden">{nav}</div>}

      <main className="min-w-0">
        <Outlet />
      </main>
    </div>
  )
}

function confirmReset(reset: () => void) {
  // inline confirm keeps the demo self-contained; replaced by a proper dialog in production
  if (window.confirm('Reset all demo data to the sample set?')) reset()
}
