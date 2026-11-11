import { lazy, Suspense, useEffect, useState } from 'react'
import Site from './site/Site'

/*
  Öffentliche Seite ohne Router: Sie braucht keinen, und React Router wäre der größte Brocken im
  ersten Bundle (Lighthouse: LCP). Der Werkstatt-Admin (#/admin…) bringt seinen Router als eigenen
  Chunk mit. Umschalten über hashchange – „View website“ im Admin führt auf #/ zurück.
*/
const AdminApp = lazy(() => import('./admin/AdminApp'))

const isAdmin = () => window.location.hash.startsWith('#/admin')

export default function App() {
  const [admin, setAdmin] = useState(isAdmin)

  useEffect(() => {
    const onHash = () => setAdmin(isAdmin())
    // hashchange: Links mit href="#/…" · popstate: Zurück-Taste und Navigation des Admin-Routers (pushState)
    window.addEventListener('hashchange', onHash)
    window.addEventListener('popstate', onHash)
    return () => {
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('popstate', onHash)
    }
  }, [])

  if (!admin) return <Site />
  return (
    <Suspense fallback={<div className="min-h-screen bg-hide" />}>
      <AdminApp />
    </Suspense>
  )
}
