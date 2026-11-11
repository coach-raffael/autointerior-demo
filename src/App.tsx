import { lazy, Suspense } from 'react'
import { HashRouter, Route, Routes } from 'react-router-dom'
import Site from './site/Site'

// Der Werkstatt-Admin wird erst geladen, wenn jemand /admin öffnet –
// die öffentliche Seite bleibt dadurch klein (Lighthouse: Performance).
const AdminLayout = lazy(() => import('./admin/AdminLayout'))
const Overview = lazy(() => import('./admin/Overview'))
const Orders = lazy(() => import('./admin/Orders'))
const CalendarPage = lazy(() => import('./admin/CalendarPage'))
const CalculatorPage = lazy(() => import('./admin/CalculatorPage'))
const Purchasing = lazy(() => import('./admin/Purchasing'))
const Contacts = lazy(() => import('./admin/Contacts'))
const PartsAdmin = lazy(() => import('./admin/PartsAdmin'))
const Content = lazy(() => import('./admin/Content'))

export default function App() {
  return (
    <HashRouter>
      <Suspense fallback={<div className="min-h-screen bg-hide" />}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Overview />} />
            <Route path="orders" element={<Orders />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="calculator" element={<CalculatorPage />} />
            <Route path="purchasing" element={<Purchasing />} />
            <Route path="contacts" element={<Contacts />} />
            <Route path="parts" element={<PartsAdmin />} />
            <Route path="content" element={<Content />} />
          </Route>
          <Route path="/*" element={<Site />} />
        </Routes>
      </Suspense>
    </HashRouter>
  )
}
