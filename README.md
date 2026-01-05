# Sendra API - GMX Protocol

REST API for Sendra DeFi protocol with GMX integration.

## Tech Stack

- TypeScript
- Vercel Serverless Functions
- GMX SDK (@gmx-io/sdk)

## Development

```bash
npm install
npm run dev
npm run build
npm run type-check
```

## Project Structure

```
.
├── api/           # API endpoints (Vercel Serverless Functions)
├── core/          # Core protocol logic
├── dist/          # Build output
└── package.json
```

## Deployment

Automatically deploys to Vercel on push to main branch.

