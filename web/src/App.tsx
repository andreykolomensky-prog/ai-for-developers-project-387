import { Route, Routes } from 'react-router'
import { Layout } from './components/Layout.tsx'
import { AdminLayout } from './pages/admin/AdminLayout.tsx'
import { EventTypesAdminPage } from './pages/admin/EventTypesAdminPage.tsx'
import { UpcomingBookingsPage } from './pages/admin/UpcomingBookingsPage.tsx'
import { BookingPage } from './pages/BookingPage.tsx'
import { EventTypesPage } from './pages/EventTypesPage.tsx'
import { HomePage } from './pages/HomePage.tsx'
import { NotFoundPage } from './pages/NotFoundPage.tsx'

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="book" element={<EventTypesPage />} />
        <Route path="book/:eventTypeId" element={<BookingPage />} />
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<UpcomingBookingsPage />} />
          <Route path="event-types" element={<EventTypesAdminPage />} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
