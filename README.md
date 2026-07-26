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
- `tests/smoke.spec.ts`

Commands:

```bash
npx playwright install chromium
npm run test:e2e
npm run test:e2e:ui
npm run test:e2e:debug
npm run test:e2e:report
```

If browser download fails with a TLS/certificate error in a corporate network, configure your Node trust store and retry:

```bash
export NODE_EXTRA_CA_CERTS=/absolute/path/to/corporate-root-ca.pem
npx playwright install chromium
```

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
