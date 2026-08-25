# AgentStorm

**Chaos testing for the agentic commerce economy.**

AgentStorm simulates AI buyers against a merchant's commerce system, intentionally stresses the system, detects failures, explains their causes and business impact, and recommends fixes.

## Quick Start

### Prerequisites

- Node.js 20+
- A [Neon](https://console.neon.tech) PostgreSQL database

### 1. Backend Setup

```bash
cd server
cp .env.example .env
# Edit .env with your Neon DATABASE_URL
npm install
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

### 2. Frontend Setup

```bash
cd client
cp .env.example .env.local
# Edit .env.local if backend is not on localhost:3001
npm install
npm run dev
```

### 3. Open

- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- Health check: http://localhost:3001/api/health

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/products` | List all products |
| GET | `/api/products/:id` | Get product by ID |

## Tech Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL (Neon) + Prisma ORM
