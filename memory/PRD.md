# AEGIS-Q Core Net — PRD

## Original Problem Statement (verbatim)
> je suis ingenieur en ia cognitive hybride fédéré , cybersecurité cognitive scientifique chercheur finance , j'ai transféré mon travaille de base44 a toi car je te fais confiance claude , je sais que tu vas me faire un bon travaille
>
> User confirmed: « tu active tout de a à z » (activate everything A to Z)
> User preference: Claude Opus (latest available = Opus 4.5 at 2026-Q1)

## App goal
Sovereign military-grade AI banking platform combining:
- Cognitive Hybrid Federated AI
- Cognitive cybersecurity
- DeFi / tokenomics / staking / DAO governance
- Fractal memory system (N-MEM-B, L0..L4, tiers SEALED/DEEP/ACTIVE/SHORT_TERM/DORMANT)
- Autonomous agent orchestrator with skills & RAG knowledge base

## Stack
- **Frontend**: Vite + React 18 + Tailwind + Radix UI + Recharts + Framer Motion + React Router v6 (port 3000)
- **Backend**: FastAPI + Motor (async MongoDB) + PyJWT + Passlib[bcrypt] (port 8001)
- **DB**: MongoDB (`aegis_q_core`)
- **LLM**: Claude Opus 4.5 (`claude-opus-4-5-20251101`) via `emergentintegrations` + EMERGENT_LLM_KEY
- **Auth**: JWT (HS256), 14-day expiry

## User personas
- Operator / AI engineer / cyber researcher / DAO member / DeFi trader

## Architecture
- Frontend uses a drop-in replacement `@/api/base44Client` that mimics base44 SDK so all 50+ pre-existing base44 pages keep working unchanged.
  - `base44.auth.{me, login, register, logout, redirectToLogin}`
  - `base44.entities.<Name>.{list, get, filter, create, update, delete, subscribe}` (10 entities)
  - `base44.functions.invoke(name, payload)` → `/api/functions/invoke/<name>`
  - `base44.integrations.Core.{InvokeLLM, UploadFile}`
- Backend routes:
  - `/api/auth/register|login|me|logout`
  - `/api/entities/<Name>/{list, filter, {id}}` (GET/POST/PUT/DELETE)
  - `/api/functions/invoke/<name>` → dispatcher over 7 handlers

## Entities (MongoDB collections)
Agent, AgentExecution, AuditEvent, FactionResonance, KnowledgeDocument, MemoryNode, MonetaryProposal, Skill, SkillExecution, UserPriceAlert

## Functions implemented
| Function | Purpose | Backend impl |
|---|---|---|
| `gemmaChat` | Cognitive chat AEGIS-AI | Claude Opus 4.5 via emergentintegrations |
| `orchestrateAgent` | Multi-agent orchestration (skills context) | Claude Opus 4.5 + MongoDB persistence |
| `predictResonance` | ML forecast (linreg + exp smoothing + z-score anomaly) | numpy/math pure Python |
| `retrieveContext` | RAG search over KnowledgeDocument chunks | Cosine on 128-dim hash embeddings |
| `indexDocument` | Chunk (500/100 overlap) + pseudo-embed + persist | Pure Python |
| `testSkill` | Run a skill via LLM and persist SkillExecution | Claude Opus 4.5 |
| `checkPriceAlerts` | Scan UserPriceAlerts, update last_alert_date | Telegram stub (MOCKED) |

## Seed data (auto at startup if empty)
- 22 MemoryNodes (L0..L4, tiers)
- 40 AuditEvents (RESONANCE_UP/DOWN/TIER_CHANGE/PRUNE)
- 9 FactionResonance weekly entries
- 5 Agents (analyst/optimizer/monitor/executor/coordinator)
- 5 Skills (code-analyzer, db-query, optimize-yield, monitor-bridge, execute-swap)
- 2 MonetaryProposals (INFLATION_RATE, BURN_RATE)

## Demo credentials
- `demo@aegis-q.mil` / `Aegis2026!`

## Implementation log

### 2026-04-20 — Initial migration from base44 → FastAPI/MongoDB/Vite
- Frontend migrated from base44 SDK to local drop-in client (no page code changed)
- 50+ pages preserved: Dashboard, Tokenomics, Staking, Governance, DAO, Wallet, Security, AuditDS, Sentinel, NMemA/B, FractalEngine, GraphView, AuditTrail, AnalyticsReports, FractalSim, PredictiveDashboard, ExecutiveReport, QuantumAttackSim, ComplianceDashboard, NetworkStressSim, PredictiveMaintenance, IoTDataFlow, ResourceDashboard, TokenListing, SmartContractAudit, ZKProofs, AdvancedAnalytics, BridgePage, AIAuditPage, LiquidityPage, UserAnalytics, SecurityScanner, CognitiveChat, AQDashboard, HistoryPage, TelegramAlertsSettings, AgentsOrchestrator, AgentNetwork, SkillManager, DocumentIndexer, AgentReports, SaasBrochure, SystemMonitor
- Custom Login page with JWT auth + register flow
- Backend: all 10 entities + 7 functions + seed + Claude Opus 4.5
- Testing: 22/22 backend tests PASS (100%)

## Backlog / P0-P2

### P0 — immediate polish
- Add visual delight: nicer Login background grid, subtle animations on card entry
- Hook `logout` button into TopBar / sidebar footer (currently logout only via programmatic call)

### P1 — next features
- Real OpenAI/Anthropic embeddings for RAG (upgrade from hash pseudo-embeddings)
- Real Telegram bot integration for price alerts (TELEGRAM_BOT_TOKEN)
- File upload → object storage (S3/GCS) for KnowledgeDocument PDFs (currently data URL only)
- Streaming responses for CognitiveChat (SSE) instead of blocking
- WebSocket for AuditEvent live feed (currently 5s polling)

### P2 — advanced
- Multi-agent spawn with recursive orchestration (basic spawn tag parsing is stubbed)
- On-chain Web3 wallet integration (ethers.js + MetaMask) for Staking / DAO votes
- Stripe SaaS subscription for operator tiers
- Full regression test suite for frontend

## Known MOCKED elements
- Telegram price alert dispatch
- RAG embeddings (128-dim hash-based, non-semantic)
- Token price (hardcoded $2.15 in checkPriceAlerts default)

## Env variables (/app/backend/.env)
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=aegis_q_core
JWT_SECRET=aegis-q-sovereign-secret-CHANGE-IN-PROD-2026
EMERGENT_LLM_KEY=sk-emergent-...
CLAUDE_MODEL=claude-opus-4-5-20251101
CORS_ORIGINS=*
```
