import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router';
import LinearProgress from '@mui/material/LinearProgress';
import { AppLayout } from './components/AppLayout';
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

const InvoicesPage = lazy(() => import('./pages/invoices/InvoicesPage').then((m) => ({ default: m.InvoicesPage })));
const InvoiceDetailPage = lazy(() =>
  import('./pages/invoices/InvoiceDetailPage').then((m) => ({ default: m.InvoiceDetailPage })),
);
const NewInvoicePage = lazy(() =>
  import('./pages/invoices/InvoiceFormPage').then((m) => ({ default: m.NewInvoicePage })),
);
const EditInvoicePage = lazy(() =>
  import('./pages/invoices/InvoiceFormPage').then((m) => ({ default: m.EditInvoicePage })),
);

const RemindersPage = lazy(() => import('./pages/reminders/RemindersPage').then((m) => ({ default: m.RemindersPage })));
const SettingsPage = lazy(() => import('./pages/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));

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
        <Route path="invoices">
          <Route index element={<InvoicesPage />} />
          <Route path="new" element={<NewInvoicePage />} />
          <Route path=":id" element={<InvoiceDetailPage />} />
          <Route path=":id/edit" element={<EditInvoicePage />} />
        </Route>
        <Route path="clients">
          <Route index element={<ClientsPage />} />
          <Route path="new" element={<NewClientPage />} />
          <Route path=":id" element={<ClientDetailPage />} />
          <Route path=":id/edit" element={<EditClientPage />} />
        </Route>
        <Route path="reminders" element={<RemindersPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
