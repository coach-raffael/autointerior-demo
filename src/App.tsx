import { HashRouter, Route, Routes } from 'react-router-dom'
import Site from './site/Site'
import AdminLayout from './admin/AdminLayout'
import Overview from './admin/Overview'
import Orders from './admin/Orders'
import CalendarPage from './admin/CalendarPage'
import CalculatorPage from './admin/CalculatorPage'
import Purchasing from './admin/Purchasing'
import Contacts from './admin/Contacts'
import PartsAdmin from './admin/PartsAdmin'
import Content from './admin/Content'

export default function App() {
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
        </Route>
        <Route path="/*" element={<Site />} />
      </Routes>
    </HashRouter>
  )
}
