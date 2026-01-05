# Sendra API - GMX Protocol

REST API for Sendra DeFi protocol with GMX integration.

## Tech Stack

- TypeScript
- Vercel Serverless Functions
- GMX SDK (@gmx-io/sdk)
- Viem

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

## API Endpoints

### GET `/api`

Root endpoint that returns API information.

**Response:**
```json
{
  "name": "Sendra API - GMX Protocol",
  "version": "1.0.0",
  "endpoints": [...]
}
```

### GET `/api/funding-fees`

Returns hourly funding fees (net rate) for all GMX markets.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "market": "ARB/USD [ARB-ARB]",
      "long": "-0.0453%",
      "short": "+0.0453%",
      "longRaw": "-85363616184677789999997600",
      "shortRaw": "453064083201679701969500400"
    }
  ],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### GET `/api/positions`

Returns all positions for a user account with their position keys and basic information.

**Query Parameters:**
- `account` (required): User wallet address (e.g., `0x8224D492eC12564EdEbe060a7fFD76296760aD4e`)
- `marketAddress` (optional): Filter by specific market address

**Example:**
```
GET /api/positions?account=0x8224D492eC12564EdEbe060a7fFD76296760aD4e
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "positionKey": "0xee8c4090ba839bd2ddc22efbfc17b49e28da2f03b0adbe8de41984b530373d5d",
      "positionKeyRaw": "0xee8c4090ba839bd2ddc22efbfc17b49e28da2f03b0adbe8de41984b530373d5d",
      "market": "ARB/USD [ARB-ARB]",
      "marketAddress": "0x2d340912Aa47e33c90Efb078e69E70EFe2B34b9B",
      "account": "0x8224D492eC12564EdEbe060a7fFD76296760aD4e",
      "isLong": true,
      "sizeInUsd": "1000000000000000000",
      "collateralAmount": "500000000000000000",
      "collateralToken": "0x...",
      "claimableFundingFeeUsd": "50000000000000000"
    }
  ],
  "count": 3,
  "account": "0x8224D492eC12564EdEbe060a7fFD76296760aD4e",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### GET `/api/positions`

Returns all positions for a user account with their position keys.

**Query Parameters:**
- `account` (required): User wallet address
- `marketAddress` (optional): Filter by specific market address

**Example:**
```
GET /api/positions?account=0x8224D492eC12564EdEbe060a7fFD76296760aD4e
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "positionKey": "0x...",
      "positionKeyRaw": "...",
      "market": "ARB/USD [ARB-ARB]",
      "marketAddress": "0x2d340912Aa47e33c90Efb078e69E70EFe2B34b9B",
      "account": "0x8224D492eC12564EdEbe060a7fFD76296760aD4e",
      "isLong": true,
      "sizeInUsd": "1000000000000000000",
      "collateralAmount": "500000000000000000",
      "collateralToken": "0x...",
      "claimableFundingFeeUsd": "50000000000000000"
    }
  ],
  "count": 3,
  "account": "0x8224D492eC12564EdEbe060a7fFD76296760aD4e",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## CORS

All endpoints support CORS and can be called from any origin.

## Deployment

Automatically deploys to Vercel on push to main branch.

