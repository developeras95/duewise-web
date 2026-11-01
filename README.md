# Duewise Web

![React 19](https://img.shields.io/badge/React-19-149eca)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6)
![MUI](https://img.shields.io/badge/MUI-9-007fff)
![License: proprietary](https://img.shields.io/badge/license-proprietary-lightgrey)

The web app for [Duewise](https://github.com/developeras95/duewise-invoicing-api), an invoicing API
for freelancers and small businesses: clients, invoices with line items and PDF, payments, client
statements and overdue reminders.

> Work in progress. Ready: clients (search, add and edit, statements with aging buckets) and invoices
> (filters, drafts with live totals, sending, voiding, payments, PDF). Being added: reminders,
> settings and the dashboard.

## Run everything with Docker

Needs only [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
docker compose up -d --build
```

| Open                                  | What                                        |
| ------------------------------------- | ------------------------------------------- |
| http://localhost:3000                 | the app                                     |
| http://localhost:3000/swagger-ui.html | the API's Swagger UI                        |
| http://localhost:8026                 | Mailpit, catching every email Duewise sends |

This starts four containers: PostgreSQL, Mailpit, the Duewise API (the released image from GitHub's
container registry) and this app, served by nginx. nginx also forwards `/api` to Duewise, so the
browser sees a single address and the API needs no CORS settings.

Stop with `docker compose down`; add `-v` to delete the database as well. Ports, the Duewise version,
real email and another database (such as the
[5-million-invoice performance study](https://github.com/developeras95/duewise-postgres-performance))
are set in a `.env` file: copy [`.env.example`](.env.example) and uncomment what you need.

## Develop

Needs Node.js 22 or later, and a Duewise API to talk to: either Duewise run from its own repository
on http://localhost:8080, or the one from `docker compose up -d` above.

```bash
npm ci
npm run dev                                        # http://localhost:5173, API on localhost:8080
DUEWISE_API_URL=http://localhost:8090 npm run dev  # use the API started by this repo's compose
```

On Windows PowerShell, set the variable first: `$env:DUEWISE_API_URL="http://localhost:8090"`.

| Command                | What it does                                                       |
| ---------------------- | ------------------------------------------------------------------ |
| `npm run dev`          | Development server with instant reload; forwards `/api` to Duewise |
| `npm run build`        | Type-checks and builds the production files into `dist/`           |
| `npm test`             | Unit and component tests (Vitest, Testing Library)                 |
| `npm run lint`         | ESLint                                                             |
| `npm run format`       | Formats the code with Prettier                                     |
| `npm run generate:api` | Regenerates the API types from `openapi/duewise-api.json`          |

### API types

`src/api/schema.d.ts` is generated from Duewise's OpenAPI document, so every path, parameter and
response is type-checked: when Duewise's API changes, the build points at each place the app must
follow. To update it, save the document from a running Duewise and regenerate:

```bash
curl http://localhost:8080/v3/api-docs -o openapi/duewise-api.json
npm run generate:api
```

## How it is built

| Concern            | Choice                                                                      |
| ------------------ | --------------------------------------------------------------------------- |
| Language and build | TypeScript, Vite                                                            |
| Components         | MUI (Material UI), light and dark mode                                      |
| Pages              | React Router                                                                |
| Server data        | TanStack Query: caching, loading and error states, refetching after changes |
| API calls          | openapi-fetch with types generated from the OpenAPI document                |
| Errors             | Duewise's RFC 7807 problem details shown with their message and error code  |
| Container          | Multi-stage build: Node builds, non-root nginx serves and proxies the API   |

```
src/
  api/          typed API client, error handling, data hooks
  components/   layout and shared building blocks
  pages/        one file per screen
  test/         test setup and helpers
nginx/          nginx configuration used in the Docker image
openapi/        Duewise's OpenAPI document the types are generated from
```

## License

Copyright © 2026 Abhijit Saha. **All rights reserved.** Published for reading and evaluation; see
[LICENSE](LICENSE). Third-party packages are licensed under their own terms.
