# Changelog

All notable changes to Duewise Web. Versions follow [semantic versioning](https://semver.org/).

## [1.0.0] - 2026-11-13

The first release: a web app for every part of the Duewise API. Needs Duewise 1.1.0 or later.

### Added

- Clients: search as you type, add and edit with Duewise's validation shown on each field, and each
  client's statement with balances per currency in aging buckets.
- Invoices: list with status, client, date and overdue filters, kept in the address; drafts with
  line items and live totals rounded exactly as Duewise rounds; sending, voiding with a reason,
  deleting drafts; recording full and part payments; PDF preview and download; emailing the invoice
  with its PDF to the client when it is sent, and again at any time after.
- Reminders: settings, daily-summary recipients and reminder days; history of every reminder sent;
  running the reminder job on demand.
- Settings: currencies and payment methods.
- Dashboard: overdue invoices oldest first, drafts to send, latest reminder, system status.
- Request-time badge: how long each call to Duewise took, as the browser saw it.
- Light and dark mode; works on phones.
- One-command Docker setup (PostgreSQL, Mailpit, the Duewise API and this app behind nginx), and
  `compose.release.yaml` to run a release without cloning.
- Unit and component tests (Vitest, Testing Library, MSW) and end-to-end tests (Playwright) against
  the real API, in CI on every push.
