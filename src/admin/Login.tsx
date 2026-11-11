import { useState } from 'react'
import { api } from '../api'
import { Wordmark } from '../site/Site'

type User = { id: number; email: string; name: string }

export default function Login({ onSignedIn }: { onSignedIn: (u: User) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const r = await api<{ user: User }>('/auth/login', { method: 'POST', json: { email, password } })
      onSignedIn(r.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed')
    } finally { setBusy(false) }
  }

  return (
    <main className="grid min-h-screen place-items-center p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-3xl border border-seam bg-hide/70 p-7">
        <Wordmark />
        <h1 className="mt-6 font-display text-xl">Workshop admin</h1>
        <p className="mt-1 text-sm text-dust">Sign in to see orders, the calendar and AI approvals.</p>
        <label className="mt-6 block">
          <span className="mb-1 block text-xs text-dust">Email</span>
          <input className="field" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="mt-3 block">
          <span className="mb-1 block text-xs text-dust">Password</span>
          <input className="field" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p role="alert" className="mt-3 text-sm text-warn">{error}</p>}
        <button disabled={busy} className="mt-6 w-full rounded-full bg-thread py-3 font-semibold text-nappa disabled:opacity-60">{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </main>
  )
}
