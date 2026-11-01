import { Route, Routes } from 'react-router';
import { AppLayout } from './components/AppLayout';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { DashboardPage } from './pages/DashboardPage';
import { NotFoundPage } from './pages/NotFoundPage';

/** Every page of the app, inside the shared layout. */
export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route
          path="invoices/*"
          element={
            <ComingSoonPage
              title="Invoices"
              description="Invoice list with filters and paging, invoice details and PDF, drafts with line items, sending, voiding and recording payments."
            />
          }
        />
        <Route
          path="clients/*"
          element={
            <ComingSoonPage
              title="Clients"
              description="Client search and list, adding and editing clients, and each client's statement with aging buckets."
            />
          }
        />
        <Route
          path="reminders"
          element={
            <ComingSoonPage
              title="Reminders"
              description="Reminder settings, the history of reminders sent, and running the reminder job on demand."
            />
          }
        />
        <Route
          path="settings"
          element={<ComingSoonPage title="Settings" description="Currencies and payment methods." />}
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
