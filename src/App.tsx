import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import LinearProgress from '@mui/material/LinearProgress';
import { AppLayout } from './components/AppLayout';
import { ComingSoonPage } from './pages/ComingSoonPage';
import { DashboardPage } from './pages/DashboardPage';
import { NotFoundPage } from './pages/NotFoundPage';

// Larger screens are loaded when first opened, so the first visit downloads only what it shows.
const ClientsPage = lazy(() => import('./pages/clients/ClientsPage').then((m) => ({ default: m.ClientsPage })));
const ClientDetailPage = lazy(() =>
  import('./pages/clients/ClientDetailPage').then((m) => ({ default: m.ClientDetailPage })),
);
const NewClientPage = lazy(() => import('./pages/clients/ClientFormPage').then((m) => ({ default: m.NewClientPage })));
const EditClientPage = lazy(() =>
  import('./pages/clients/ClientFormPage').then((m) => ({ default: m.EditClientPage })),
);

/** Every page of the app, inside the shared layout. */
export function App() {
  return (
    <Routes>
      <Route
        element={
          <Suspense fallback={<LinearProgress sx={{ position: 'fixed', top: 0, left: 0, right: 0 }} />}>
            <AppLayout />
          </Suspense>
        }
      >
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
        <Route path="clients">
          <Route index element={<ClientsPage />} />
          <Route path="new" element={<NewClientPage />} />
          <Route path=":id" element={<ClientDetailPage />} />
          <Route path=":id/edit" element={<EditClientPage />} />
        </Route>
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
