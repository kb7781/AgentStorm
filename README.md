# AgentStorm ⚡

**Chaos testing, multi-agent simulation, and decision intelligence platform for the autonomous AI commerce economy.**

AgentStorm stress-tests modern e-commerce systems against concurrent, autonomous AI shopping agents. Instead of traditional synthetic HTTP load generators that merely measure response latency, AgentStorm simulates **real commerce semantics**: autonomous agent decision-making, high-speed flash sale inventory contention, atomic stock reservations, payment drops, automated stock restoration, and evidence-backed reliability auditing.

---

## 🏆 Verified Results

The complete AgentStorm system has undergone rigorous automated testing across database concurrency, payment state machines, and multi-agent workloads:

- ✅ **184 / 184 Automated Assertions Passed** across 6 specialized test suites.
- ✅ **0 Oversell Events**: Maintained strict mathematical stock conservation under concurrent contention storms.
- ✅ **0 Negative Stock Events**: Conditional atomic updates prevent inventory from dropping below zero.
- ✅ **Atomic Inventory Reservation**: Concurrency races resolve cleanly without inventory corruption.
- ✅ **Idempotent Payment Recovery**: Stock is restored exactly once upon test payment failure or order cancellation.
- ✅ **0 LLM Calls for Unambiguous Decisions**: 100% deterministic bypass when 0 or 1 candidate product matches.
- ✅ **Maximum 1 Compact Groq Call**: Only calls the LLM when multiple eligible products require persona selection (`max_tokens: 256`, `temp: 0.1`).
- ✅ **Immediate Deterministic Fallback**: Seamless, instant failover when Groq is unavailable or rate-limited (HTTP 429) with zero retry storms.
- ✅ **Dynamic Intelligence Analytics**: All Buyer Intelligence and Simulation Intelligence metrics are derived dynamically from database records and runtime telemetry.
- ✅ **Build & Type Validation**: Server TypeScript validation, Prisma schema verification, and Next.js client production builds compile with 0 errors.

---

## 🎬 Demo

The AgentStorm interactive dashboard runs locally at **[http://localhost:3000](http://localhost:3000)** (Backend API at **[http://localhost:3001](http://localhost:3001)**) and provides 5 integrated modules:

1. **🛍️ Products & Cart**: Live catalog with real-time stock counters, multi-item cart, and Razorpay test-mode checkout.
2. **⚡ AI Buyers**: Launch autonomous buyers across 4 personas (`Budget Shopper`, `Power User`, `Deal Hunter`, `Impulse Buyer`) with real-time decision traces.
3. **🌪️ Simulation Storm**: Run concurrent stress scenarios (`Flash Sale`, `Market Storm`, `Payment Chaos`) with live stock conservation auditing.
4. **🧠 Buyer Intelligence**: Inspect buyer decision telemetry, dynamic budget utilization, product rejection reasons, and preferred items.
5. **📊 Simulation Intelligence**: View cross-scenario comparison matrices, 0 oversell verification, and automated deterministic engineering insights.

---

## 📑 Table of Contents

- [🎯 The Problem AgentStorm Solves](#-the-problem-agentstorm-solves)
- [🏗️ System Architecture](#️-system-architecture)
- [🌟 Key Innovations & Capabilities](#-key-innovations--capabilities)
- [🤖 Autonomous AI Buyer Engine](#-autonomous-ai-buyer-engine)
- [🌪️ Simulation Storms & Scenarios](#️-simulation-storms--scenarios)
- [🧠 Buyer Intelligence & Decision Analytics](#-buyer-intelligence--decision-analytics)
- [📊 Simulation Intelligence & Scenario Analytics](#-simulation-intelligence--scenario-analytics)
- [🛡️ ACID Order & Payment Lifecycle](#️-acid-order--payment-lifecycle)
- [⚡ Token-Optimized Groq & Fallback Engine](#-token-optimized-groq--fallback-engine)
- [📐 Deterministic Reliability Audit Engine](#-deterministic-reliability-audit-engine)
- [🔌 API Reference](#-api-reference)
- [🛠️ Tech Stack](#️-tech-stack)
- [🚀 Quickstart & Setup](#-quickstart--setup)
- [🧪 Automated Test Suites & Verification](#-automated-test-suites--verification)
- [🏁 Final Verification Status](#-final-verification-status)

---

## 🎯 The Problem AgentStorm Solves

As autonomous AI agents increasingly browse and purchase products on behalf of consumers, e-commerce backends will face novel traffic profiles:
1. **Sub-second Inventory Contention**: Multiple autonomous agents attempting to claim the same limited stock units simultaneously.
2. **Abandoned Checkouts & Drops**: AI agents dropping checkout sessions when unexpected price discrepancies or network failures occur.
3. **LLM Cost Explosions & Rate Limits**: Unoptimized multi-turn agent loops consuming excessive tokens per purchase attempt.
4. **Data Corruption & Overselling**: Race conditions between inventory inspection and order creation leading to negative stock ledgers.

**AgentStorm provides a testing, simulation, and observability harness** to ensure e-commerce architectures maintain mathematical inventory conservation, idempotent payment transitions, and token efficiency under concurrent agent workloads.

---

## 🏗️ System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Next.js 16 Client (Dark Theme UI)                                │
│   🛍️ Catalog & Cart  │  ⚡ AI Buyers  │  🌪️ Simulation Storm  │  🧠 Buyer Intel  │  📊 Sim Intel  │
└────────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                                 │ HTTP REST / JSON
┌────────────────────────────────────────────────▼─────────────────────────────────────────────────┐
│                                  Express TypeScript API (Port 3001)                              │
│   /api/products  •  /api/orders  •  /api/payments  •  /api/buyers  •  /api/simulations  •  /api/events  │
├────────────────────────────────────────────────┬─────────────────────────────────────────────────┤
│           ⚡ AI Buyer Decision Engine           │             🌪️ Simulation Orchestrator          │
│   • Deterministic Pre-Filtering (0 LLM calls)  │   • Sequential Execution Queue                  │
│   • Compact Groq Adapter (Single-turn, JSON)   │   • Concurrency & Inventory Snapshots           │
│   • Instant Fallback Agent (Zero-retry 429)    │   • Automated Stock Recovery Verification       │
├────────────────────────────────────────────────┴─────────────────────────────────────────────────┤
│                                Prisma ORM & Transaction Safety Layer                             │
│   • Atomic Conditional Decrements: `where: { id, stock: { gte: qty } }`                          │
│   • Idempotent Inventory Recovery: `updateMany({ where: { id, inventoryRestored: false } })`     │
│   • Event Audit Ledger: Structured event stream stored in the `events` table                     │
└────────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                                 │ Connection Pooling (SSL)
┌────────────────────────────────────────────────▼─────────────────────────────────────────────────┐
│                                PostgreSQL Database (Neon / Local)                                │
│         merchants  •  products  •  orders  •  order_items  •  payments  •  events                │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

> **Note on Infrastructure**: AgentStorm is implemented and tested as an Express + Next.js full-stack architecture connected to PostgreSQL (tested with Neon Serverless PostgreSQL and local PostgreSQL instances).

---

## 🌟 Key Innovations & Capabilities

- **🛡️ Atomic Inventory Protection**: Uses conditional transactional updates to eliminate overselling and race conditions under concurrent agent purchasing.
- **⚡ Token-Optimized AI Engine**: Eliminates 100% of LLM calls on unambiguous catalog matches. Uses single-turn compact Groq calls with structured JSON output and low `max_tokens` (256) when multiple candidates exist.
- **🔄 Idempotent Payment Recovery**: State machine transitions (`PENDING` $\rightarrow$ `PAID` or `CANCELLED` / `FAILED`) automatically restore inventory exactly once with zero double-crediting risk.
- **🧠 Real-Time Buyer Decision Telemetry**: Tracks products considered, rejection categorizations (`EXCEEDS_BUDGET`, `OUT_OF_STOCK`, `LOWER_RANKED`, `CONTENTION_LOST`), selection rationales, and dynamic budget utilization.
- **📊 Cross-Scenario Simulation Analytics**: Real-time stress matrix across Flash Sale, Market Storm, and Payment Chaos with automated deterministic engineering insights.
- **📐 4-Category Reliability Scoring**: Mathematically calculates scores (0–100) across Inventory Safety, Payment Reliability, Order Consistency, and AI Buyer Success directly from database facts.

---

## 🤖 Autonomous AI Buyer Engine

AgentStorm features 4 distinct, pre-configured AI buyer personas with realistic shopping behaviors and strict budget constraints:

| Persona | Budget Cap | Target Category | Shopping Behavior & Selection Rationale |
|---|---|---|---|
| **💰 Budget Shopper** | ₹5,000 | Headphones | Strongly price-sensitive. Selects the most affordable in-stock option within budget. |
| **🖥️ Power User** | ₹50,000 | Monitors | High-end preference. Prioritizes premium build, 4K resolution, and top specifications. |
| **🔍 Deal Hunter** | ₹20,000 | Cross-Category | Value-driven. Compares specs against price across multiple categories to maximize ROI. |
| **⚡ Impulse Buyer** | ₹15,000 | Keyboards | Fast, decisive purchasing. Selects the first attractive candidate meeting core criteria. |

### Controlled Agent Execution Flow
1. **Deterministic Candidate Filtering**: Fetches catalog and filters by category, budget cap, and real-time stock.
2. **Decision Optimization**:
   - **0 eligible items**: Categorized as `NO_ELIGIBLE_INVENTORY` or `OUT_OF_BUDGET` (0 LLM calls).
   - **1 eligible item**: Selected directly via deterministic bypass (0 LLM calls).
   - **Multiple eligible items**: Exactly 1 compact Groq call (`llama-3.3-70b-versatile`, temp: 0.1, JSON mode).
3. **Atomic Purchase Execution**: Executes conditional atomic reservation in PostgreSQL.
4. **Contention Handling**: If another buyer claimed the last unit in the same millisecond, the outcome is recorded as `EXPECTED_CONTENTION` (zero fake orders created, neutral telemetry).

---

## 🌪️ Simulation Storms & Scenarios

AgentStorm provides 3 automated simulation scenarios to test commerce resilience under diverse adversarial conditions:

### 1. 🔥 Flash Sale Contention
- **Configuration**: Standard 5-agent stress test racing concurrently for 2 available inventory units.
- **Verified Behavior**: In this test configuration, exactly 2 buyers succeed and 3 lose inventory contention (`EXPECTED_CONTENTION`). **Oversell = 0**, **negative stock = 0**, and stock conservation is verified mathematically.

### 2. 🌪️ Mixed Market Storm
- **Configuration**: All 4 buyer personas execute concurrent shopping runs across diverse catalog categories.
- **Verified Behavior**: Multi-category concurrent throughput, budget enforcement, and accurate total GMV aggregation.

### 3. ⚡ Payment Chaos & Stock Recovery
- **Configuration**: Concurrent buyers place orders, followed by simulated payment gateway drops and user cancellations in test mode.
- **Verified Behavior**: Dropped orders transition to `CANCELLED`, inventory is restored exactly once, and active `PAID` orders remain decremented.

---

## 🧠 Buyer Intelligence & Decision Analytics

Exposed via `GET /api/buyers/analytics` and visualized on the **`🧠 Buyer Intelligence`** tab:

- **Dynamic Available Budget**: Calculated dynamically as:
  $$\text{Available Budget}_{\text{persona}} = \text{persona.budget} \times \text{actual number of runs for that persona}$$
- **Dynamic Budget Utilization %**: Calculated dynamically as:
  $$\text{Budget Utilization \%}_{\text{persona}} = \frac{\text{actual total spending for that persona}}{\text{Available Budget}_{\text{persona}}} \times 100$$
- **Product Rejection Breakdown**: Categorized into `EXCEEDS_BUDGET`, `OUT_OF_STOCK`, `LOWER_RANKED`, and `CONTENTION_LOST`.
- **Decision Mode Telemetry**: Real-time breakdown of Direct Deterministic selections, Groq AI calls, and Deterministic Fallbacks.

---

## 📊 Simulation Intelligence & Scenario Analytics

Exposed via `GET /api/simulations/analytics` and visualized on the **`📊 Simulation Intelligence`** tab:

- **Cross-Scenario Comparison Matrix**: Multi-dimensional benchmarking of Flash Sale, Market Storm, and Payment Chaos.
- **Stock Conservation Verification**:
  $$\text{Final Stock} == \text{Initial Stock} - \text{Net Paid Units Purchased}$$
- **Automated Deterministic Insights**: Rule-based engineering analysis generated purely from mathematical data (0 LLM calls):
  - *"Flash Sale: Atomic transaction locks maintained 100% stock integrity with 0 oversell anomalies across contention events."*
  - *"Payment Chaos: Automated stock recovery successfully restored units from dropped checkout carts."*
  - *"Market Storm: Deterministic pre-filtering bypassed LLM roundtrips on unambiguous catalog matches."*

---

## 🛡️ ACID Order & Payment Lifecycle

AgentStorm implements a strict, unambiguous order state machine:

```
                  ┌──────────────────────┐
                  │   Buyer Submits      │
                  │   Order Request      │
                  └──────────┬───────────┘
                             │ Atomic Stock Decrement
                             ▼
                  ┌──────────────────────┐
                  │       PENDING        │
                  │  (Stock Reserved)    │
                  └─────┬──────────┬─────┘
                        │          │
    Payment Captured &  │          │ Payment Dropped /
    Signature Verified  │          │ User Cancelled
                        ▼          ▼
            ┌──────────────┐   ┌───────────────────────────┐
            │     PAID     │   │         CANCELLED         │
            │  (Captured)  │   │     (Stock Restored)      │
            └──────────────┘   └───────────────────────────┘
```

### Explicit Frontend State Labels:
- **`PENDING`**: `"PENDING · Stock Reserved"`
- **`PAID`**: `"PAID · Captured"`
- **`CANCELLED`**: `"CANCELLED · Restored"`
- **`FAILED`**: `"FAILED · Restored"`

*(Note: Payment operations use Razorpay Test Mode for safe simulation and demonstration).*

---

## ⚡ Token-Optimized Groq & Fallback Engine

| Workload Dimension | Traditional Multi-Turn Agent | AgentStorm Token-Optimized Engine | Design Rationale |
|---|---|---|---|
| **Prompts & Tools** | Multi-turn chat loop (5-10 turns) | Single-turn compact decision | **Designed to minimize latency & roundtrips** |
| **Tokens per Decision** | ~2,500 – 5,000 tokens | ~80 – 220 tokens | **Designed to reduce token consumption by ~90%** |
| **0/1 Candidate Bypasses** | Calls LLM unnecessarily | Bypasses LLM completely | **0 tokens consumed** |
| **429 Rate Limit Handling** | Unbounded retry storms | Immediate deterministic fallback | **Zero downtime under rate limits** |

---

## 📐 Deterministic Reliability Audit Engine

All reliability scores and verdicts are computed directly from PostgreSQL ledger facts:

$$\text{AgentStorm Reliability Score} = \text{round}\left(\frac{\text{Inventory Safety} + \text{Payment Reliability} + \text{Order Consistency} + \text{Buyer Success}}{4}\right)$$

1. **Inventory Safety (0–100%)**: Asserts 0 oversell events, 0 negative stock counts, and exact stock conservation.
2. **Payment Reliability (0–100%)**: Validates signature captures in test mode and verifies 100% inventory restoration on dropped orders.
3. **Order Consistency (0–100%)**: Verifies integer quantities, positive amounts, and line-item total integrity.
4. **AI Buyer Success (0–100%)**: Measures successful completions alongside clean, non-penalizing handling of expected contention.

---

## 🔌 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check & system status. |
| `GET` | `/api/products` | Retrieve catalog products with real-time stock levels. |
| `POST` | `/api/orders` | Create an order with atomic stock reservation. |
| `GET` | `/api/orders/:id` | Get order details, item lines, and payment state. |
| `POST` | `/api/orders/:id/cancel` | Cancel order and idempotently restore inventory. |
| `POST` | `/api/payments/create` | Create a Razorpay test-mode checkout order. |
| `POST` | `/api/payments/verify` | Verify Razorpay test HMAC signature & transition to `PAID`. |
| `GET` | `/api/buyers` | List available AI buyer personas and configurations. |
| `POST` | `/api/buyers/run` | Execute a single autonomous buyer run. |
| `GET` | `/api/buyers/analytics` | Aggregated buyer intelligence, persona profiles, and traces. |
| `GET` | `/api/simulations/scenarios` | List available simulation storm scenarios. |
| `POST` | `/api/simulations/run` | Execute a concurrent simulation scenario. |
| `GET` | `/api/simulations/:id/report`| Fetch the reliability audit report for a simulation run. |
| `GET` | `/api/simulations/analytics` | Aggregated simulation intelligence & scenario comparison matrix. |
| `GET` | `/api/events` | Audit event ledger query stream. |

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 16 (Turbopack, App Router), React 19, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript, tsx
- **Database & ORM**: PostgreSQL (Neon / Local), Prisma ORM
- **AI & LLM**: Groq SDK (`llama-3.3-70b-versatile`) with compact prompt engineering + deterministic fallback
- **Payments**: Razorpay Node SDK (Test Mode Integration)
- **Tooling**: Concurrently, ESLint, TypeScript Compiler

---

## 🚀 Quickstart & Setup

### Prerequisites
- Node.js 20+
- A PostgreSQL database connection string (e.g. Neon or local PostgreSQL)
- (Optional) Groq API key and Razorpay test keys

### 1. Installation
```bash
# Clone the repository
git clone https://github.com/kb7781/AgentStorm.git
cd AgentStorm

# Install backend dependencies & initialize database
cd server
npm install
npx prisma db push
npx prisma db seed

# Install frontend dependencies
cd ../client
npm install
```

### 2. Environment Configuration

#### `server/.env`
```env
DATABASE_URL="postgresql://user:password@ep-sample-pooler.neon.tech/agentstorm?sslmode=require"
PORT=3001
CLIENT_URL="http://localhost:3000"

# Optional credentials (deterministic fallback operates seamlessly if omitted)
GROQ_API_KEY="gsk_your_groq_api_key"
GROQ_MODEL="llama-3.3-70b-versatile"
RAZORPAY_KEY_ID="rzp_test_your_key_id"
RAZORPAY_KEY_SECRET="your_razorpay_secret"
```

#### `client/.env.local`
```env
NEXT_PUBLIC_API_URL="http://localhost:3001"
```

### 3. Run Development Servers
From the root workspace directory:
```bash
npm run dev
```

- **Frontend Application**: [http://localhost:3000](http://localhost:3000)
- **Backend Express API**: [http://localhost:3001](http://localhost:3001)

---

## 🧪 Automated Test Suites & Verification

AgentStorm includes a comprehensive test harness covering concurrency, order lifecycles, token efficiency, and analytics:

```bash
# 1. Type & Build Validation
cd server && npx tsc --noEmit && npx prisma validate
cd ../client && npm run build

# 2. Token-Optimized Buyer Engine Test (25 assertions)
npx tsx scratch/test_token_optimized_engine.ts

# 3. Order Lifecycle & Chaos Recovery Test (38 assertions)
npx tsx scratch/test_order_lifecycle_and_chaos.ts

# 4. Dynamic Budget & Utilization Test (35 assertions)
npx tsx scratch/test_dynamic_budget_calculation.ts

# 5. Day 8 Buyer Intelligence Analytics Test (34 assertions)
npx tsx scratch/test_day8_buyer_analytics.ts

# 6. Day 9 Simulation Intelligence Analytics Test (38 assertions)
npx tsx scratch/test_day9_simulation_analytics.ts

# 7. Full Concurrency & Chaos Storm Regression (14 assertions)
bash scratch/verify_day7.sh
```

---

## 🏁 Final Verification Status

**`AGENTSTORM FINAL VERIFICATION: READY`**

- **184 / 184 Automated Assertions Passed** across all test suites.
- **0 Build Errors**: Next.js production build and TypeScript compiler pass with 0 errors.
- **0 Oversell Events**: Verified across all high-concurrency simulation scenarios.
- **0 Negative Stock Events**: Strict atomic conditional updates prevent inventory underflow.
- **Payment Lifecycle Verified**: State machine transitions (`PENDING`, `PAID`, `CANCELLED`) tested with idempotent inventory recovery.
- **Dynamic Analytics Verified**: All metrics derive dynamically from database ledgers without hardcoded values.
- **Security Checks Verified**: Server secrets (`GROQ_API_KEY`, `RAZORPAY_KEY_SECRET`, `DATABASE_URL`) are strictly server-side with zero client exposure.

*All automated and end-to-end verification tests passed. AgentStorm is ready for demonstration and hackathon evaluation.*

---

## 📄 License
MIT License. Built for the Google DeepMind & Agentic Commerce Hackathon.
