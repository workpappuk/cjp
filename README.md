# ThreadForge

ThreadForge is a Next.js 16 App Router project with:

- Social login UI (Google, GitHub, Discord)
- Client-side auth session token flow for protected pages
- MongoDB connection via Mongoose
- Docker and Docker Compose production setup

## Local Development

Install dependencies:

```bash
npm install
```

Create or update `.env.local`:

```bash
MONGODB_URI=mongodb+srv://username:password@cluster.example.mongodb.net
MONGODB_DB=threadforge
MONGODB_AUDIT_DB=threadforge_audit
```

Start development server:

```bash
npm run dev
```

Open http://localhost:3000

## Playwright E2E

This repo includes Playwright with a basic smoke test.

Files:

- `playwright.config.ts`
- `tests/e2e/smoke.spec.ts`

Commands:

```bash
npx playwright install chromium
npm run test:e2e
```

If browser download fails with a TLS/certificate error in a corporate network, configure your Node trust store and retry:

```bash
export NODE_EXTRA_CA_CERTS=/absolute/path/to/corporate-root-ca.pem
npx playwright install chromium
```

## Integration Testing Framework

This repository now includes a production-grade integration testing stack for App Router:

- Vitest
- React Testing Library
- MSW
- MongoDB Memory Server (replica set)
- Playwright (Page Object Model)

### Test Structure

```
tests/
  integration/
    actions/
    api/
    auth/
    components/
    database/
    middleware/
  e2e/
    pages/
  fixtures/
  mocks/
  setup/
  utils/
```

### Vitest Configuration

- File: `vitest.config.ts`
- Environment: `jsdom`
- Coverage target: `>= 90%` on key integration modules
- Deterministic execution: single worker for DB-backed suites

### Test Database Lifecycle

File: `tests/setup/setupDb.ts`

Helpers:

- `createTestDatabase()`
- `resetDatabase()`
- `seedDatabase()`
- `cleanupDatabase()`

### MSW

Files:

- `tests/mocks/handlers.ts`
- `tests/mocks/server.ts`
- `tests/mocks/browser.ts`

### E2E Page Objects

Files:

- `tests/e2e/pages/LoginPage.ts`
- `tests/e2e/pages/DashboardPage.ts`
- `tests/e2e/pages/NavigationPage.ts`

## Test Commands

```bash
npm test
npm run test:watch
npm run test:unit
npm run test:integration
npm run test:coverage
npm run test:ui
npm run test:e2e
```

## CI/CD

GitHub Actions workflow:

- `.github/workflows/tests.yml`

The workflow:

- installs dependencies
- executes coverage tests
- executes Playwright tests
- uploads coverage and Playwright reports as artifacts

## Testing Principles Used

- Arrange/Act/Assert test structure
- deterministic API and external service behavior
- automatic cleanup for db and mocks
- reusable fixtures and helpers
- minimal mocking of business logic

## Auth Notes

The app stores social provider and access token in local storage on login.

- Provider key: `threadforge-auth`
- Token key: `threadforge-access-token`
- Expiry key: `threadforge-access-token-expiry`

Helpers:

- `app/_utils/auth.ts` for session/token helpers
- `app/_utils/api.ts` for fetch wrapper with Authorization header

Important: The current token is a UI/dev token. For production auth security, replace with backend-issued OAuth/JWT tokens.

## MongoDB Connection

Reusable helper:

- `app/_lib/mongoose.ts`

It provides:

- Cached connection across hot reloads
- Environment validation for `MONGODB_URI`
- Retry-safe behavior by clearing failed connect promises
- Server selection timeout to fail fast when cluster is unreachable

Use in server code:

```ts
import { connectToDatabase } from "@/app/_lib/mongoose";

export async function GET() {
  await connectToDatabase();
  return Response.json({ ok: true });
}
```

### Model Delta Auditing

Model-level writes are now audited automatically for these collections:

- `Post`
- `Community`
- `Comment`
- `Tag`
- `UserProfile`

Audit behavior:

- Captures field-level delta (`from`/`to`) for create/update operations
- Writes audit entries to a separate database (`MONGODB_AUDIT_DB`)
- Uses one audit collection per model (for example `posts_audit`)
- Runs as best-effort and never blocks primary writes

### Admin Audit Query API

Read audit history with admin access:

- GET `/api/admin/audit?modelName=Post&documentId=<objectId>&operation=update&limit=50`

Query params:

- `modelName` (required): `Post`, `Community`, `Comment`, `Tag`, `UserProfile`
- `documentId` (optional): ObjectId string for one document
- `operation` (optional): `create`, `update`, or `all` (default)
- `limit` (optional): 1-200 (default 50)
- `cursor` (optional): pagination cursor from the previous response

## Startup Behavior

Mongo connection is attempted at app startup using Next instrumentation:

- `instrumentation.ts`
- `instrumentation-node.ts`

If Mongo is temporarily unavailable, startup logs a warning and continues booting so the app is still reachable.

## Health Check Endpoint

Mongo health route:

- GET `/api/health`

Success response example:

```json
{
  "ok": true,
  "message": "MongoDB connection is healthy",
  "state": 1,
  "timestamp": "2026-07-25T00:00:00.000Z"
}
```

## Docker

This repo includes:

- `Dockerfile` multi-stage standalone build
- `docker-compose.yml` runtime hardening + healthcheck

### Build and Run with Docker

```bash
docker build -t cjp-web:prod .
docker run -d --name cjp-web --env-file .env.local -p 3000:3000 cjp-web:prod
```

### Build and Run with Docker Compose

`docker-compose.yml` already loads `.env.local` with `env_file`.

```bash
docker compose -f docker-compose.yml up -d --build --force-recreate
docker compose -f docker-compose.yml ps
docker compose -f docker-compose.yml logs -f web
```

Stop containers:

```bash
docker compose -f docker-compose.yml down
```

## Troubleshooting

If `http://localhost:3000/api/health` is unreachable:

1. Confirm app is running: `npm run dev`
2. Confirm env keys exist in `.env.local`: `MONGODB_URI`, `MONGODB_DB`
3. Check runtime logs for Mongo timeout or DNS/network issues
4. If port 3000 is busy, Next may run on another port (for example 3001)
