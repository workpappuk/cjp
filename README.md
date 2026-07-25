This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Production with Docker

This repository includes a production-ready Docker setup:

- `Dockerfile` (multi-stage, standalone Next.js output, non-root runtime user)
- `docker-compose.yml` (restart policy, healthcheck, read-only filesystem, tmpfs)
- `.dockerignore` (small and safe build context)

### Prerequisites

Install Docker Desktop (or Docker Engine with Compose support). If `docker` is not available in your shell, install Docker first.

### Build and Run (Docker)

```bash
docker build -t cjp-web:prod .
docker run -d --name cjp-web -p 3000:3000 cjp-web:prod
```

Open http://localhost:3000

### Build and Run (Docker Compose)

```bash
docker compose -f docker-compose.yml up -d --build
docker compose -f docker-compose.yml ps
docker compose -f docker-compose.yml logs -f web
```

To stop:

```bash
docker compose -f docker-compose.yml down
```
