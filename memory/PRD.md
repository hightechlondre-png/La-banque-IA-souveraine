# AEGIS-Q Core Net — PRD

## Original Problem Statement (verbatim)
> je suis ingenieur en ia cognitive hybride fédéré , cybersecurité cognitive scientifique chercheur finance , j'ai transféré mon travaille de base44 a toi car je te fais confiance claude , je sais que tu vas me faire un bon travaille
>
> User confirmed: « tu active tout de a à z » then « ok continue » then « ok feu vert »
> User preference: Claude Opus (latest available = Opus 4.5 at 2026-Q1)

## App goal
Sovereign military-grade AI banking platform combining cognitive hybrid federated AI, cognitive cybersecurity, DeFi/tokenomics/staking/DAO, fractal memory (N-MEM-B), autonomous agent orchestrator with skills & RAG knowledge base.

## Stack
- **Frontend**: Vite + React 18 + Tailwind + Radix UI + Recharts + Framer Motion + React Router v6 (port 3000)
- **Backend**: FastAPI + Motor (async MongoDB) + PyJWT + Passlib[bcrypt] + httpx (port 8001)
- **DB**: MongoDB (`aegis_q_core`)
- **LLM**: Claude Opus 4.5 (`claude-opus-4-5-20251101`) via `emergentintegrations` + EMERGENT_LLM_KEY
- **Market data**: CoinGecko public API (BTC/ETH/SOL) → synthetic AQ price basket
- **Auth**: JWT (HS256), 14-day expiry

## Architecture
Frontend uses a drop-in `@/api/base44Client` that mimics base44 SDK so all 50+ pre-existing base44 pages keep working unchanged.

## API surface

### Auth
- `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/me` · `POST /api/auth/logout`

### Generic entity CRUD (10 entities)
`/api/entities/<Name>/{list, filter, <id>}` — GET/POST/PUT/DELETE
- Agent, AgentExecution, AuditEvent, FactionResonance, KnowledgeDocument, MemoryNode, MonetaryProposal, Skill, SkillExecution, UserPriceAlert

### Market prices (Phase 3)
- `GET /api/market/prices` → `{coins:{BTC,ETH,SOL},aq,ts}` with 24h change. CoinGecko with 30s in-memory cache.

### Functions (dispatcher at `/api/functions/invoke/<name>`)
| Function | Purpose | Backend impl |
|---|---|---|
| `gemmaChat` | Cognitive chat AEGIS-AI | Claude Opus 4.5 via emergentintegrations |
| `orchestrateAgent` | Multi-agent orchestration (skills context) | Claude Opus 4.5 + MongoDB persistence |
| `predictResonance` | ML forecast (linreg + exp smoothing + z-score anomaly) | numpy/math pure Python |
| `retrieveContext` | RAG search over KnowledgeDocument chunks | **TF-IDF + cosine** (upgraded in Phase 3) |
| `indexDocument` | Chunk (500/100 overlap) + persist | Pure Python (no embeddings stored) |
| `testSkill` | Run a skill via LLM and persist SkillExecution | Claude Opus 4.5 |
| `checkPriceAlerts` | Scan UserPriceAlerts with **real AQ basket price** | Telegram stub (MOCKED) |

## Seed data (auto at startup if empty)
- 22 MemoryNodes · 40 AuditEvents · 9 FactionResonance weeks · 5 Agents · 5 Skills · 2 MonetaryProposals · 1 KnowledgeDocument (AEGIS-Q whitepaper synthesis)

## Demo credentials
- `demo@aegis-q.mil` / `Aegis2026!`

## Implementation log

### Phase 1 (2026-04-20) — Initial migration base44 → FastAPI/MongoDB/Vite
- Frontend drop-in client mimics base44 SDK (auth, entities.X, functions.invoke, integrations.Core)
- 50+ pages preserved unchanged
- Login/register JWT auth
- Backend: 10 entity CRUD + 7 functions + seed + Claude Opus 4.5
- **22/22 backend tests PASS**

### Phase 2 — UX polish
- TopBar user menu with avatar, role, email, ID, **Se déconnecter** button
- Client `subscribe` emits proper {type:'create'/'update'/'delete',data} events so realtime charts (ResonanceChart, NotificationCenter) work

### Phase 3 — Real data integrations
- **CoinGecko** integration `/api/market/prices` with 30s cache (BTC, ETH, SOL)
- **Synthetic AQ price** = 50% BTC + 30% ETH + 20% SOL basket
- **MarketPulse widget** on Dashboard (30s polling, live green pulse, 4 rows)
- **TF-IDF RAG** upgrade (replaces hash-based pseudo-embeddings). IDF recomputed per query.
- `checkPriceAlerts` now uses real AQ price (not hardcoded $2.15)
- **28/28 backend tests PASS**

## Known MOCKED elements
- Telegram notifications in checkPriceAlerts (stub — no real bot send)

## Backlog

### P1 — high-value next features
- Streaming SSE for CognitiveChat (progressive rendering)
- Cache IDF per-corpus-revision for RAG scalability
- Real Telegram bot (requires TELEGRAM_BOT_TOKEN from user)
- Stripe SaaS tiered subscriptions (Operator / Commander / Sovereign)
- Upload PDF → object storage (S3) for KnowledgeDocument

### P2 — advanced
- Multi-agent recursive spawn (currently stubbed)
- Web3 wallet (MetaMask + ethers.js) for Staking / DAO votes
- LLM-powered smart contract audit on `SmartContractAudit` page
- On-chain ZK proof anchoring for Executive Reports
- Split server.py into modules (auth, entities, functions/*, seed)

### Code review items (from testing_agent iter 2)
- `_fetch_coingecko` cache not concurrency-safe — add asyncio.Lock
- Upstream status flag on /api/market/prices when CoinGecko fails
- JWT_SECRET should fail fast if missing (currently has dev default)
- TF-IDF tokenizer: no stemming/lemmatization (staking vs stake = different tokens)

## Env variables (/app/backend/.env)
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=aegis_q_core
JWT_SECRET=aegis-q-sovereign-secret-CHANGE-IN-PROD-2026
EMERGENT_LLM_KEY=sk-emergent-...
CLAUDE_MODEL=claude-opus-4-5-20251101
CORS_ORIGINS=*
```
