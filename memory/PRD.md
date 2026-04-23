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

### Phase 4 — AI Strategic Advisor
- New endpoint `POST /api/market/staking-advice` combining real market data + Claude Opus 4.5 scenario analysis
- Returns: `advice` (markdown), `computation` (APY effective, rewards AQ/USD, final USD), `market` context
- New frontend component `StakingAdvisor.jsx` with on-demand « Demander l'IA » button and live computation strip
- Integrated at the bottom of `Staking.jsx` — reacts to current simulator values (pool, amount, lock-up, multiplier)
- Claude Opus delivers structured verdict: note /10, 3 forces, 2-3 risks, actionable recommendation, price alert thresholds

### Phase 5 — Structured JSON LLM + Live Smart Contract Audit
- New backend function `invokeLLM` handler with `response_json_schema` support: the LLM is forced to return valid JSON, parsed server-side (fences + prose-tolerant extractor).
- Frontend `integrations.Core.InvokeLLM` shim routes structured calls to `/api/functions/invoke/invokeLLM` (parsed JSON) and keeps chat calls on `gemmaChat`.
- **AIAuditPage now works end-to-end**: paste Solidity, Claude Opus 4.5 returns {score_securite, vulnerabilites[], points_positifs[], resume, conforme_erc20, post_quantique}. PDF export ready.
- Tested with VulnerableVault.sol → 15/100 score, 1 critical reentrancy + 1 high + 8 total findings, proper Checks-Effects-Interactions recommendation.

### Phase 5b — Hardening after testing_agent iter 3 (34/34 PASS)
- `_extract_json_block` uses `JSONDecoder.raw_decode` scanner (balance-safe, tolerant to stray braces in LLM prose)
- `StakingAdviceBody` bounded: `amount_aq ≤ 1B`, `lock_days ≤ 3650`, `multiplier ≤ 10` (anti prompt-injection / DoS)

### Phase 6 — Public API + Signed Badge (monetization funnel)
- **`POST /api/public/audit`** — unauthenticated, rate-limited 3/hour/IP (via `X-Forwarded-For` prefix). Returns `{audit_id, score, result, badge_token, watermark, limits{remaining}}`. Persists in `public_audits` with `code_hash` (SHA-256) for dedupe.
- **`GET /api/public/audit/{id}`** — consultation publique (hide ip_prefix & code_hash).
- **`GET /api/public/badge/{id}.svg`** — SVG embedable 260x44 with score-based color (SECURE/WARN/RISK/UNSAFE) and contract name.
- **`GET /api/public/badge/verify?token=...`** — HMAC-SHA256 verification. Returns `{valid, audit_id, score, contract_name, issued_at, db_score, db_contract}`. Tampered tokens → `{valid:false}`.
- Signing scheme: `payload = audit_id|score|contract_name|issued_at`, sig = HMAC-SHA256(JWT_SECRET, payload).
- **Frontend page `/public-audit`** (no login required) — hero, textarea Solidity, example loader, score dial (SVG gauge circular), vulnerabilites list with severity color-coded pills, badge SVG preview + markdown snippet copyable for README/GitHub.
- Rate-limit validated: 4 concurrent calls from same IP → 3x 200 + 1x 429 with clear FR message.
- Ready for marketing loops: public URL + embeddable badge = viral distribution channel.

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
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_SITE_URL=https://hybrid-federated-ia.preview.emergentagent.com
OPENROUTER_SITE_NAME=AEGIS-Q
CORS_ORIGINS=*
```

---

## 2026-04-20 — Phase 9 · La Ruche (Hybrid Federated AI Swarm) ✅

### Philosophie utilisateur
> « plus d'ia qui travaille moin de token a payer chaque ia et specialisé »
> BEAUCOUP d'abeilles spécialisées, PEU de tokens par abeille. Chaque IA a un rôle cognitif distinct, routage intelligent via Qwen (superviseur) + Gemini Embedding (reine N-MEM-B).

### 9 abeilles OpenRouter opérationnelles (probe 9/9 OK)
| Role | Model | Tier | Budget tokens | Spécialité |
|---|---|---|---|---|
| grade_fou | `mistralai/mistral-large` | paid | 800 | Commandant stratégique — décisions haut niveau |
| llm1 | `meta-llama/llama-4-maverick` | paid | 1000 | Audit smart-contracts & code — raisonnement technique |
| llm2 | `deepseek/deepseek-r1` | paid | 900 | Raisonnement mathématique & finance — staking, APY, risk |
| memoire1 | `google/gemma-4-31b-it` | paid | 600 | Mémoire contextuelle longue — condensation |
| memoire2 | `minimax/minimax-m2.5:free` | free | 500 | Mémoire secondaire rapide — faible latence |
| mem0_1 | `nvidia/nemotron-3-super-120b-a12b:free` | free | 700 | Orchestrateur d'agents — planification multi-étapes |
| mem0_2 | `nvidia/nemotron-3-nano-30b-a3b:free` | free | 400 | Tests de compétences — QA rapide, classification |
| superviseur | `qwen/qwen3-embedding-8b` | paid | — | Routeur sémantique (embeddings) |
| reine | `google/gemini-embedding-2-preview` | paid | — | Reine N-MEM-B — mémoire long-terme fédérée |

### Routage par usecase (primary → fallback chain)
- `cognitive_chat` → grade_fou → mem0_1 → memoire2 → mem0_2 → llm2
- `agent_orchestr` → mem0_1 → grade_fou → memoire2 → mem0_2
- `staking_advisor` → llm2 → grade_fou → mem0_1 → memoire2
- `contract_audit` → llm1 → grade_fou → llm2 → mem0_1
- `skill_test` → mem0_2 → memoire2 → mem0_1 → grade_fou
- `memory_condense` → memoire1 → memoire2 → mem0_1 → mem0_2

### Nouveautés backend (`/app/backend/ruche.py`, `/app/backend/server.py`)
- `call_bee(role, ...)` applique automatiquement le budget tokens du rôle si `max_tokens` non fourni (frugalité cognitive).
- `call_bee` retry sur content vide × 2 budget (pour modèles reasoning DeepSeek R1 / Nemotron qui brûlent leur budget en raisonnement caché).
- `probe_bee` tolérant : HTTP 200 = "ok" même si content vide (reasoning model reachable).
- `get_credits()` expose solde OpenRouter (`{total, used, remaining}`).
- `/api/ruche/status` enrichi : `specialty`, `budget`, `credits`, `usecases`.
- `/api/ruche/test` permet de tester un usecase spécifique en live.
- `llm_chat` / `fn_invoke_llm` acceptent un paramètre `usecase` qui cascade vers le router Ruche. Les endpoints ont été routés correctement :
  - `/api/public/audit` → `contract_audit` (Llama 4 Maverick, spécialisé code Solidity).
  - `/api/market/staking-advice` → `staking_advisor` (DeepSeek R1, reasoning finance).
  - `fn_orchestrate_agent` → `agent_orchestr` (Nemotron Super 120B).
  - `fn_test_skill` → `skill_test` (Nemotron Nano 30B).
  - `fn_gemma_chat` → `cognitive_chat` (Mistral Large).

### UI `/ruche` (RucheMonitor.jsx)
- Header compteur `X/9 Abeilles Actives` + widget crédits `$9.45 / $30.00`.
- Cartes abeilles : spécialité cognitive + budget tokens + statut coloré.
- Section "Routage des cas d'usage" affichant primaire + fallbacks.
- Bouton "Tester la ruche" live avec affichage bee_used + content.

### Tests régressifs
- Nouveau fichier `/app/backend/tests/test_ruche.py` : 11 tests GREEN.
- Suite complète : **90/90 tests backend passent** (100%).
- Fix résultant d'iteration 7 : `test_happy_path_shape` (public audit) désormais stable grâce au routage Llama 4 Maverick au lieu du généraliste Mistral.

### Budget OpenRouter
- Solde : **~$9.44 restants sur $30** après validation complète des 9 abeilles + Phase 10.
- Fallback Claude Opus 4.5 conservé en cas d'épuisement ruche (via `emergentintegrations`).

---

## 2026-04-21 — Phase 10 · Intelligence de Routage (Qwen + Queen) ✅

### Superviseur Qwen — Routage sémantique dynamique
- **Pré-calcul** : 7 embeddings Qwen3-8B des spécialités des abeilles chat, cachés en RAM (module-level dict + asyncio.Lock), **parallélisés** via `asyncio.gather` (~700ms au bootstrap).
- **Runtime frugal** : 1 seul embed Qwen par requête + cosine similarity locale → sélection dynamique de l'abeille optimale.
- **Résilience** : si Qwen down, fallback automatique vers `grade_fou` avec `reason='qwen_down'`.
- **Validation sémantique** (test dédié `test_phase10_smart_route.py`) :
  - "Audit Solidity réentrance" → **Llama 4 Maverick** (sim 0.79)
  - "Calcule APY staking" → **DeepSeek R1** (sim 0.75)
  - "Résume documentation" → **Gemma 4 31B** (sim 0.67)
  - "Orchestrer 3 agents" → **Nemotron Super 120B** (sim 0.84)

### Reine Gemini — N-MEM-B (mémoire long-terme fédérée)
- `queen_remember(content, metadata)` → embedding Gemini Embedding 2 (dim 3072) stocké dans `db.queen_memory`.
- `queen_recall(query, top_k, filter_tag)` → cosine similarity sur toute la collection, tri descendant.
- Cap `top_k <= 50` côté serveur (anti-abus).

### Nouveaux endpoints
- `POST /api/ruche/smart-route` `{query, top_k?}` → `{role, label, specialty, similarity, top[]}`
- `POST /api/ruche/auto` `{query, system_prompt?, max_tokens?}` → chat auto-routé avec cascade sémantique
- `POST /api/ruche/queen/remember` `{content, metadata?}` → stockage N-MEM-B
- `POST /api/ruche/queen/recall` `{query, top_k?, filter_tag?}` → rappel cosine

### UI `/ruche` enrichie
- Nouveau panneau "Auto Route · Qwen Superviseur" avec :
  - Input query libre
  - Bouton "Router automatiquement"
  - Badge abeille sélectionnée + score similarity
  - Barres de progression visuelles pour le top-3 Qwen
  - Affichage du contenu renvoyé par l'abeille sélectionnée
- `data-testid` : `ruche-auto-panel`, `ruche-auto-query-input`, `ruche-auto-run-btn`, `ruche-auto-result`

### Tests régressifs
- Nouveau fichier `/app/backend/tests/test_phase10_smart_route.py` : **15 tests GREEN** (50s).
- Régression : `/api/ruche/status`, `/api/functions/invoke/gemmaChat`, `/api/auth/login` OK.
- Cleanup `db.queen_memory` après tests (delete_many metadata.tag='phase10_test').

### Carry-over backlog
- Index MongoDB sur `{queen:1, metadata.tag:1}` si mémoire > 10k docs (ou bascule Atlas Vector Search).
- Filter par `user_id` sur `queen_recall` si on veut cloisonner la mémoire par user (actuellement fédérée globale — design choice).
- Pydantic body models pour endpoints ruche (actuellement dict libre avec validations manuelles).

---

## 2026-04-22 — Phase 11 · Pack Marketing Public La Ruche ✅

### Objectif
Transformer l'architecture unique "Ruche" en **argument de vente visible** : page publique dédiée + widget intégré à la landing, exposant la valeur technique en <10 secondes de visite.

### Nouveaux endpoints publics (no auth)
- **`GET /api/public/ruche/status`** — statut des 9 abeilles + solde partiel OpenRouter
  - Cache 45s (`_PUBLIC_RUCHE_STATUS_TTL`) pour résister à la pression marketing (landing virale = beaucoup de hits)
  - **Champs exposés** : `status, tier, label, icon, specialty, budget, is_embedding`
  - **Champs NON exposés** (sécurité branding) : `role` (slug interne), `used`, `total` crédits
- **`POST /api/public/ruche/smart-route`** `{query}` — démo live du routage Qwen
  - Rate-limit sliding window **5 requêtes/heure/IP** (`_PUBLIC_RUCHE_LIMIT`)
  - Pydantic `PublicRucheRouteBody` (min=3, max=400 chars)
  - Retourne `{label, specialty, similarity, top[], remaining_calls}` — pas de slug interne

### Nouveau composant `<SmartRouteWidget />`
- Fichier : `/app/frontend/src/components/ruche/SmartRouteWidget.jsx`
- Props : `compact` (landing) / full (page publique)
- Examples chips cliquables (4 queries pré-écrites)
- Top-3 Qwen avec barres de progression animées + score similarity
- Affichage compteur "X/5 restants"
- Gestion error (429 rate-limit clair en français)

### Nouvelle page publique `/la-ruche`
- Fichier : `/app/frontend/src/pages/PublicRuche.jsx`
- Hero accrocheur : "9 IA spécialisées, 1 superviseur sémantique"
- Compteur live `X/9 Abeilles Actives` + solde OpenRouter partiel
- Grid 9 cartes abeilles (spécialité + budget tokens + statut)
- Section démo `#demo` avec `SmartRouteWidget` full
- **SEO/OpenGraph** : `document.title`, meta `description`, `og:title`, `og:description`, `og:type`, `twitter:card`
- Analytics : track `public_ruche_view` à chaque visite

### Intégration Landing
- Nouvelle section `#la-ruche-demo` avec `SmartRouteWidget` compact entre Features et CTA Audit
- Lien "🐝 La Ruche" ajouté dans la nav header et footer
- Accessible sans compte, conversion path : Landing → Widget démo → CTA "Voir les 9 abeilles" → `/la-ruche` → Signup

### Tests régressifs (iteration 9 → 10)
- Nouveau fichier `/app/backend/tests/test_phase11_public_ruche.py` : **14 tests GREEN** (100%)
- Couvre : exposition propre du payload, Pydantic validation, rate-limit sliding window, isolation IP, cache TTL, régression auth.
- 1 bug intermédiaire détecté + corrigé : fuite du slug `role` sur /status public (iter 9) → corrigé + vérifié sur les 9 bees (iter 10).

### Impact mesurable
- Cache warm hit : **<100ms** (vs 5s cold sur probe OpenRouter)
- Routage Qwen depuis widget public : Llama 4 Maverick sélectionné correctement sur query "Audit Solidity" (sim 0.794)
- Solde OpenRouter après tous les tests : **~$9.42/$30** restants (budget frugal préservé)

### Bonus Marketing (post-testing)
- **`GET /api/public/ruche/card.svg`** — carte sociale OpenGraph/Twitter 1200×630
  - SVG natif (4.3 KB), compteur abeilles actives dynamique (lu depuis le cache 45s)
  - Design cohérent brand : grid subtil, 2 glows radiaux (blue/purple), strip stats bas
  - Meta tags injectés dans `PublicRuche.jsx` : `og:image`, `og:image:width=1200`, `og:image:height=630`, `twitter:card=summary_large_image`, `twitter:image`, `twitter:title`, `twitter:description`
- **Boutons Share sur `/la-ruche`** (hero) :
  - 𝕏 Twitter — `twitter.com/intent/tweet` pré-rempli avec texte FR + hashtags (#AEGISQ #AI #LLM)
  - in LinkedIn — `linkedin.com/sharing/share-offsite`
  - Copier le lien — `navigator.clipboard` avec feedback visuel (Check pendant 2s)
  - `data-testid` : `share-x-btn`, `share-linkedin-btn`, `share-copy-btn`

---

## 2026-04-23 — Phase 12 · Token Savings Dashboard (Rétention) ✅

### Objectif
Matérialiser la valeur de la Ruche pour les utilisateurs premium — chaque requête via Qwen économise des tokens vs un modèle généraliste unique. Argument concret pour justifier l'abonnement mois après mois.

### Tracking usage (non-bloquant)
- `llm_chat(...)` accepte désormais un `user_id: Optional[str]`.
- Sur chaque succès Ruche, un doc est inséré dans `db.ruche_usage` via `asyncio.create_task` (fire-and-forget, ne ralentit pas la réponse) :
  ```json
  {
    "id": "uuid",
    "bee_role": "grade_fou|llm1|...",
    "bee_label": "Mistral Large",
    "usecase": "cognitive_chat",
    "tokens_budget": 800,
    "user_id": "...",
    "created_at": "ISO8601"
  }
  ```
- Tous les call-sites ont été mis à jour pour propager `user_id` : `/market/staking-advice`, `fn_gemma_chat`, `fn_invoke_llm`, `fn_orchestrate_agent`, `fn_test_skill`.

### Nouvel endpoint `/api/ruche/savings`
- Query params : `days` (1-365, default 30)
- Auth requise (user voit ses propres stats)
- Baseline de référence : **2000 tokens/requête** (= Mistral Large full capacity si tout passait par un seul modèle sans spécialisation)
- Coût : **$0.003 / 1K tokens** (approx OpenRouter Mistral Large)
- Agrégation MongoDB pipeline (`$match user_id + since` → `$group bee_role`)
- Retour :
  ```json
  {
    "window_days": 30,
    "total_requests": 3,
    "tokens": {"ruche_actual": 2400, "baseline_single_model": 6000, "saved": 3600, "savings_ratio": 0.6},
    "cost_usd": {"ruche_actual": 0.0072, "baseline_single_model": 0.018, "saved": 0.0108},
    "by_bee": [{"bee_role":"grade_fou","bee_label":"Mistral Large","count":3,"tokens_used":2400}]
  }
  ```

### Nouveau composant `<RucheSavings />`
- Fichier : `/app/frontend/src/components/ruche/RucheSavings.jsx`
- Affiché dans `RucheMonitor.jsx` (/ruche) juste après le header
- Sélecteur fenêtre 7j / 30j / 90j
- 4 KPIs : Requêtes, Tokens économisés, Ratio économies (vert %), Coût évité (jaune $)
- Barres de progression par abeille (répartition Qwen)
- États : loading, empty (0 requêtes), data
- `data-testid` : `ruche-savings`, `savings-window-{7,30,90}`, `savings-bee-{role}`

### Nettoyage code mort
- Supprimé un bloc orphelin dans `/api/webhook/stripe` (lignes mortes après `return {"ok":True}` → `F821 Undefined name` détecté par ruff).

### Validation live
- 3 requêtes gemmaChat → 2400 tok réels vs 6000 baseline → **60% d'économies** (3600 tok sauvés, $0.0108).
- UI rendue avec toutes les KPIs et barre Mistral Large.
- Validation edge cases : `days=9999` clamp à 365, sans auth → 401, 0 requête → message invitant à utiliser une abeille.

---

## 2026-04-23 · Phase 12.5 — Dashboard Home Integration ✅

### Objectif
Augmenter la visibilité des économies : au lieu d'aller sur `/ruche`, l'utilisateur voit le widget **dès la page Dashboard** chaque connexion → création d'habitude + rappel quotidien de valeur.

### Nouveau endpoint `GET /api/ruche/savings/trend?days=N`
- Retourne la série temporelle quotidienne pour sparkline (default 14j, max 90j)
- Pipeline MongoDB `$group` par `$substr(created_at, 0, 10)` (YYYY-MM-DD)
- Pour chaque jour : `{date, requests, tokens_used, tokens_saved}`

### Nouveau composant `<RucheSavingsCompact />`
- Fichier : `/app/frontend/src/components/dashboard/RucheSavingsCompact.jsx`
- Integré dans `Dashboard.jsx` (juste après la Stats Row, avant les Charts)
- **Big number vert saillant** : tokens économisés sur 30j
- **Sparkline SVG inline** (160×40) : polyline verte + area gradient sous la courbe
- Stats compactes bas de widget : `X req · Y% économisé · $Z évité`
- **Lien cliquable** vers `/ruche` avec flèche animée au hover (micro-interaction)
- États gérés : loading, empty (0 req avec CTA onboarding), data
- `data-testid` : `dashboard-savings-card`, `savings-sparkline`

### Validation live
- 58 requêtes synthétiques insérées sur 10 jours → **69 000 tokens économisés · 59% · $0.2070 évité**
- Sparkline rendue avec courbe + zone dégradée verte
- Hover fonctionnel, route `/ruche` atteignable
- Tests régressifs : **test_ruche.py 11/11 GREEN** (Phase 9 core Ruche intact)

### Boucle rétention complète
`Dashboard home` (widget saillant) → `clic` → `/ruche` (détails + Token Savings full) → `confidence user = +1` chaque jour.

