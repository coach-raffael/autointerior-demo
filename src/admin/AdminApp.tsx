import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import AdminLayout from './AdminLayout'
import Overview from './Overview'
import Orders from './Orders'
import CalendarPage from './CalendarPage'
import CalculatorPage from './CalculatorPage'
import Purchasing from './Purchasing'
import Contacts from './Contacts'
import PartsAdmin from './PartsAdmin'
import Content from './Content'
import GalleryAdmin from './GalleryAdmin'
import Approvals from './Approvals'
import AiAccess from './AiAccess'

// Werkstatt-Admin mit eigenem Router – als eigener Chunk geladen, sobald jemand #/admin öffnet.
export default function AdminApp() {
  return (
    <HashRouter>
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
          <Route path="gallery" element={<GalleryAdmin />} />
          <Route path="approvals" element={<Approvals />} />
          <Route path="ai" element={<AiAccess />} />
        </Route>
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </HashRouter>
  )
}
