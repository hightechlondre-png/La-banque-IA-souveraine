"""
AEGIS-Q Core Net — FastAPI backend
Replicates base44 SDK surface:
  - JWT auth (/api/auth/register, /api/auth/login, /api/auth/me)
  - Generic entity CRUD (/api/entities/<Name>/...)
  - Function dispatcher (/api/functions/invoke/<name>)
  - Claude Opus 4.5 cognitive chat via emergentintegrations
"""

from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import math
import asyncio
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

import jwt
import hmac
import hashlib
import time as _time
import httpx
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, Field

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ.get("JWT_SECRET", "aegis-q-sovereign-secret-change-me")
JWT_ALGO = "HS256"
JWT_EXP_DAYS = 14
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL", "claude-opus-4-5-20251101")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("aegis")

# ---------------------------------------------------------------------------
# Entity registry
# ---------------------------------------------------------------------------
ENTITY_COLLECTIONS = {
    "Agent": "agents",
    "AgentExecution": "agent_executions",
    "AuditEvent": "audit_events",
    "FactionResonance": "faction_resonances",
    "KnowledgeDocument": "knowledge_documents",
    "MemoryNode": "memory_nodes",
    "MonetaryProposal": "monetary_proposals",
    "Skill": "skills",
    "SkillExecution": "skill_executions",
    "UserPriceAlert": "user_price_alerts",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def clean_doc(doc: Optional[dict]) -> Optional[dict]:
    if not doc:
        return None
    doc.pop("_id", None)
    return doc


# ---------------------------------------------------------------------------
# Auth models
# ---------------------------------------------------------------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: Optional[str] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class AuthOut(BaseModel):
    access_token: str
    user: Dict[str, Any]


def make_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_EXP_DAYS),
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


async def get_current_user(
    cred: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> Dict[str, Any]:
    if cred is None or cred.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(cred.credentials, JWT_SECRET, algorithms=[JWT_ALGO])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ---------------------------------------------------------------------------
# FastAPI app & router
# ---------------------------------------------------------------------------
app = FastAPI(title="AEGIS-Q Core Net API", version="1.0.0")
api = APIRouter(prefix="/api")


@api.get("/")
async def root():
    return {
        "app": "AEGIS-Q Core Net",
        "version": "1.0.0",
        "status": "operational",
        "model": CLAUDE_MODEL,
    }


# ---------------------------------------------------------------------------
# Market prices (CoinGecko)
# ---------------------------------------------------------------------------
_COIN_CACHE: Dict[str, Any] = {"ts": 0.0, "data": None}
_COIN_CACHE_TTL = 30  # seconds


async def _fetch_coingecko() -> Dict[str, Any]:
    """Fetch BTC / ETH / SOL prices from CoinGecko (simple, no auth).
    Returns a dict with {symbol: {usd, change24h}}.
    """
    import time

    if _COIN_CACHE["data"] and (time.time() - _COIN_CACHE["ts"]) < _COIN_CACHE_TTL:
        return _COIN_CACHE["data"]
    url = (
        "https://api.coingecko.com/api/v3/simple/price?"
        "ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true"
    )
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(url)
            r.raise_for_status()
            raw = r.json()
        data = {
            "BTC": {"usd": raw["bitcoin"]["usd"], "change24h": raw["bitcoin"].get("usd_24h_change", 0)},
            "ETH": {"usd": raw["ethereum"]["usd"], "change24h": raw["ethereum"].get("usd_24h_change", 0)},
            "SOL": {"usd": raw["solana"]["usd"], "change24h": raw["solana"].get("usd_24h_change", 0)},
        }
        _COIN_CACHE["data"] = data
        _COIN_CACHE["ts"] = time.time()
        return data
    except Exception as e:
        logger.warning("CoinGecko fetch failed: %s", e)
        # Fallback to cached or last-known values
        return _COIN_CACHE["data"] or {
            "BTC": {"usd": 0, "change24h": 0},
            "ETH": {"usd": 0, "change24h": 0},
            "SOL": {"usd": 0, "change24h": 0},
        }


async def _compute_aq_price() -> Dict[str, float]:
    """AQ is an internal token: derive a synthetic price from a weighted basket
    of BTC/ETH/SOL so the dashboard shows real-ish live movement.
    """
    coins = await _fetch_coingecko()
    btc = coins["BTC"]["usd"] or 1
    eth = coins["ETH"]["usd"] or 1
    sol = coins["SOL"]["usd"] or 1
    # Arbitrary basket (keeps AQ around ~$2-$5 range)
    aq_usd = round(btc * 0.00002 + eth * 0.0004 + sol * 0.005, 4)
    # 24h change = weighted mean of components
    chg = (
        0.5 * coins["BTC"]["change24h"]
        + 0.3 * coins["ETH"]["change24h"]
        + 0.2 * coins["SOL"]["change24h"]
    )
    return {"usd": aq_usd, "change24h": round(chg, 2)}


@api.get("/market/prices")
async def market_prices(user: Dict[str, Any] = Depends(get_current_user)):
    coins = await _fetch_coingecko()
    aq = await _compute_aq_price()
    upstream_status = coins.get("_upstream_status", "ok") if isinstance(coins, dict) else "ok"
    # Strip internal marker from returned coins dict
    clean_coins = {k: v for k, v in coins.items() if not k.startswith("_")}
    return {
        "coins": clean_coins,
        "aq": aq,
        "upstream_status": upstream_status,
        "ts": now_iso(),
    }


class StakingAdviceBody(BaseModel):
    amount_aq: float = Field(gt=0, le=1_000_000_000)  # cap at 1B AQ (total supply = 100M so this is permissive)
    pool_name: str = Field(default="Gold", max_length=40)
    pool_apy_pct: float = Field(gt=0, le=1000, default=25)
    lock_days: int = Field(gt=0, le=3650, default=180)  # max 10 years
    multiplier: float = Field(gt=0, le=10, default=1.5)


@api.post("/market/staking-advice")
async def staking_advice(
    body: StakingAdviceBody,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Combine real market data + Claude Opus 4.5 to analyze a staking scenario."""
    aq = await _compute_aq_price()
    coins = await _fetch_coingecko()

    effective_apy = (body.pool_apy_pct * body.multiplier) / 100
    daily_rate = effective_apy / 365
    reward_aq = body.amount_aq * (((1 + daily_rate) ** body.lock_days) - 1)
    reward_usd = reward_aq * aq["usd"]
    principal_usd = body.amount_aq * aq["usd"]
    final_usd = principal_usd + reward_usd

    context = (
        f"Scénario de staking AEGIS-Q:\n"
        f"- Pool: {body.pool_name} (APY base {body.pool_apy_pct}%)\n"
        f"- Multiplicateur lock-up: ×{body.multiplier} ({body.lock_days} jours)\n"
        f"- APY effectif: {effective_apy*100:.2f}%\n"
        f"- Montant staké: {body.amount_aq:,.0f} AQ ≈ ${principal_usd:,.2f} USD\n"
        f"- Récompense estimée: {reward_aq:,.2f} AQ ≈ ${reward_usd:,.2f} USD\n"
        f"- Valeur finale estimée: ${final_usd:,.2f} USD\n\n"
        f"Contexte marché temps réel:\n"
        f"- BTC: ${coins['BTC']['usd']:,} ({coins['BTC']['change24h']:+.2f}% 24h)\n"
        f"- ETH: ${coins['ETH']['usd']:,} ({coins['ETH']['change24h']:+.2f}% 24h)\n"
        f"- SOL: ${coins['SOL']['usd']:,} ({coins['SOL']['change24h']:+.2f}% 24h)\n"
        f"- AQ synthétique: ${aq['usd']} ({aq['change24h']:+.2f}% 24h)\n"
    )

    system = (
        "Tu es AEGIS-ADVISOR, conseiller IA stratégique en staking DeFi pour AEGIS-Q. "
        "Tu réponds EXCLUSIVEMENT en français, en markdown structuré concis (max 300 mots). "
        "Fournis: (1) Verdict synthétique en 1 phrase avec note /10, "
        "(2) 3 forces, (3) 2-3 risques concrets, (4) 1 recommandation actionnable. "
        "Tiens compte du contexte marché fourni. Sois direct et chiffré."
    )
    prompt = (
        f"Analyse ce scénario de staking et donne ton verdict stratégique:\n\n{context}"
    )
    advice = await llm_chat(
        session_id=f"advice-{user['id']}-{uuid.uuid4()}",
        system_prompt=system,
        messages=[{"role": "user", "content": prompt}],
        usecase="staking_advisor",
        user_id=user["id"],
    )
    return {
        "advice": advice,
        "computation": {
            "effective_apy_pct": round(effective_apy * 100, 2),
            "reward_aq": round(reward_aq, 2),
            "reward_usd": round(reward_usd, 2),
            "principal_usd": round(principal_usd, 2),
            "final_usd": round(final_usd, 2),
            "aq_price_usd": aq["usd"],
            "aq_change24h": aq["change24h"],
        },
        "market": {"coins": coins, "aq": aq},
        "generated_at": now_iso(),
    }


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------
@api.post("/auth/register", response_model=AuthOut)
async def register(body: RegisterIn):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email déjà enregistré")
    uid = str(uuid.uuid4())
    user_doc = {
        "id": uid,
        "email": body.email.lower(),
        "full_name": body.full_name or body.email.split("@")[0],
        "role": "operator",
        "password_hash": pwd_ctx.hash(body.password),
        "created_at": now_iso(),
    }
    await db.users.insert_one(user_doc)
    public = {k: v for k, v in user_doc.items() if k != "password_hash"}
    public.pop("_id", None)
    await _track("signup", user_id=uid, properties={"email": body.email.lower()})
    return {"access_token": make_token(uid), "user": public}


@api.post("/auth/login", response_model=AuthOut)
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not pwd_ctx.verify(body.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Email ou mot de passe invalide")
    public = {k: v for k, v in user.items() if k not in ("password_hash", "_id")}
    return {"access_token": make_token(user["id"]), "user": public}


@api.get("/auth/me")
async def me(user: Dict[str, Any] = Depends(get_current_user)):
    return user


@api.post("/auth/logout")
async def logout(user: Dict[str, Any] = Depends(get_current_user)):
    return {"ok": True}


@api.patch("/auth/onboarding")
async def update_onboarding(
    body: Dict[str, Any],
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Met à jour l'état d'onboarding du user (step number ou completed flag)."""
    update = {}
    if "step" in body:
        update["onboarding_step"] = max(0, min(int(body["step"] or 0), 10))
    if "completed" in body:
        update["onboarding_completed"] = bool(body["completed"])
        if update["onboarding_completed"]:
            update["onboarding_completed_at"] = now_iso()
    if not update:
        raise HTTPException(status_code=400, detail="step or completed required")
    await db.users.update_one({"id": user["id"]}, {"$set": update})
    return {"ok": True, **update}


# ---------------------------------------------------------------------------
# Entity CRUD
# ---------------------------------------------------------------------------
def _collection(entity_name: str):
    col_name = ENTITY_COLLECTIONS.get(entity_name)
    if not col_name:
        raise HTTPException(status_code=404, detail=f"Unknown entity: {entity_name}")
    return db[col_name]


def _parse_sort(sort: Optional[str]):
    if not sort:
        return [("created_at", -1)]
    field = sort
    direction = 1
    if sort.startswith("-"):
        field = sort[1:]
        direction = -1
    elif sort.startswith("+"):
        field = sort[1:]
    return [(field, direction)]


@api.get("/entities/{entity_name}/list")
async def entity_list(
    entity_name: str,
    sort: Optional[str] = None,
    limit: int = 100,
    user: Dict[str, Any] = Depends(get_current_user),
):
    col = _collection(entity_name)
    cursor = col.find({}, {"_id": 0}).sort(_parse_sort(sort)).limit(min(limit, 500))
    return [doc async for doc in cursor]


class FilterBody(BaseModel):
    query: Dict[str, Any] = Field(default_factory=dict)
    sort: Optional[str] = None
    limit: int = 100


@api.post("/entities/{entity_name}/filter")
async def entity_filter(
    entity_name: str,
    body: FilterBody,
    user: Dict[str, Any] = Depends(get_current_user),
):
    col = _collection(entity_name)
    cursor = (
        col.find(body.query or {}, {"_id": 0})
        .sort(_parse_sort(body.sort))
        .limit(min(body.limit, 500))
    )
    return [doc async for doc in cursor]


@api.get("/entities/{entity_name}/{item_id}")
async def entity_get(
    entity_name: str,
    item_id: str,
    user: Dict[str, Any] = Depends(get_current_user),
):
    col = _collection(entity_name)
    doc = await col.find_one({"id": item_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return doc


@api.post("/entities/{entity_name}")
async def entity_create(
    entity_name: str,
    body: Dict[str, Any],
    user: Dict[str, Any] = Depends(get_current_user),
):
    col = _collection(entity_name)
    doc = dict(body)
    doc["id"] = doc.get("id") or str(uuid.uuid4())
    doc.setdefault("created_at", now_iso())
    doc["updated_at"] = now_iso()
    doc["created_by"] = user["id"]
    # Avoid mongo mutation of original dict
    await col.insert_one(dict(doc))
    return clean_doc(dict(doc))


@api.put("/entities/{entity_name}/{item_id}")
async def entity_update(
    entity_name: str,
    item_id: str,
    body: Dict[str, Any],
    user: Dict[str, Any] = Depends(get_current_user),
):
    col = _collection(entity_name)
    patch = dict(body)
    patch["updated_at"] = now_iso()
    res = await col.find_one_and_update(
        {"id": item_id},
        {"$set": patch},
        projection={"_id": 0},
        return_document=True,
    )
    if not res:
        raise HTTPException(status_code=404, detail="Not found")
    return res


@api.delete("/entities/{entity_name}/{item_id}")
async def entity_delete(
    entity_name: str,
    item_id: str,
    user: Dict[str, Any] = Depends(get_current_user),
):
    col = _collection(entity_name)
    res = await col.delete_one({"id": item_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    return {"ok": True, "deleted": item_id}


# ---------------------------------------------------------------------------
# LLM helper (Claude Opus 4.5)
# ---------------------------------------------------------------------------
async def llm_chat(
    session_id: str,
    system_prompt: str,
    messages: List[Dict[str, str]],
    usecase: str = "cognitive_chat",
    user_id: Optional[str] = None,
) -> str:
    """Multi-turn chat. Route via La Ruche first, fallback to Claude Opus 4.5 if all bees fail.
    Enregistre l'usage dans db.ruche_usage pour le Token Savings Dashboard."""
    # 1) Try La Ruche (OpenRouter)
    try:
        import ruche as _ruche
        if _ruche.is_ruche_enabled():
            result = await _ruche.call_usecase(
                usecase=usecase,
                messages=messages,
                system_prompt=system_prompt,
                max_tokens=1500,
            )
            if result.get("content"):
                logger.info("[Ruche] %s → %s OK", usecase, result.get("bee_used"))
                # Fire-and-forget: log usage pour savings dashboard
                try:
                    bee_role = result.get("bee_used")
                    budget = _ruche.BEES.get(bee_role, {}).get("budget") or 800
                    asyncio.create_task(db.ruche_usage.insert_one({
                        "id": str(uuid.uuid4()),
                        "bee_role": bee_role,
                        "bee_label": result.get("bee_label"),
                        "usecase": usecase,
                        "tokens_budget": int(budget),
                        "user_id": user_id,
                        "created_at": now_iso(),
                    }))
                except Exception as e:
                    logger.warning("ruche_usage log failed: %s", e)
                return result["content"]
            logger.warning("[Ruche] %s all bees failed, falling back to Claude Opus", usecase)
    except Exception as e:
        logger.warning("[Ruche] module error, falling back to Claude Opus: %s", e)

    # 2) Fallback: Claude Opus 4.5 via emergentintegrations
    if not EMERGENT_LLM_KEY:
        return (
            "[MODE DÉMO] Aucun backend IA disponible. Ajoutez des crédits sur OpenRouter "
            "(https://openrouter.ai/settings/credits) ou configurez EMERGENT_LLM_KEY."
        )
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage

        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=system_prompt,
        ).with_model("anthropic", CLAUDE_MODEL)

        last = messages[-1] if messages else {"role": "user", "content": ""}
        for m in messages[:-1]:
            if m.get("role") == "user":
                await chat.send_message(UserMessage(text=m["content"]))
        reply = await chat.send_message(UserMessage(text=last.get("content", "")))
        return reply if isinstance(reply, str) else str(reply)
    except Exception as e:
        logger.exception("Claude Opus fallback failed")
        return f"[Erreur LLM] {type(e).__name__}: {str(e)[:200]}"


# ---------------------------------------------------------------------------
# Function: gemmaChat (cognitive chat)
# ---------------------------------------------------------------------------
AEGIS_SYSTEM_PROMPT = (
    "Tu es AEGIS-AI, l'intelligence cognitive souveraine de la plateforme AEGIS-Q — "
    "banque IA militaire souveraine. Tu réponds en français, avec un style précis, "
    "analytique et stratégique. Tu es expert en: DeFi, smart contracts Solidity/Rust, "
    "tokenomique déflationniste, gouvernance DAO, mémoire fractale N-MEM-B, "
    "cryptographie post-quantique, sécurité cognitive, IA cognitive hybride fédérée, "
    "finance de marché et cybersécurité cognitive. Utilise du markdown structuré."
)


async def fn_gemma_chat(body: Dict[str, Any], user: Dict[str, Any]) -> Dict[str, Any]:
    messages = body.get("messages", [])
    session_id = body.get("session_id", f"chat-{user['id']}")
    reply = await llm_chat(session_id, AEGIS_SYSTEM_PROMPT, messages, usecase="cognitive_chat", user_id=user["id"])
    return {"content": reply, "reply": reply}


# ---------------------------------------------------------------------------
# Function: invokeLLM (generic LLM call, optional structured JSON output)
# ---------------------------------------------------------------------------
import json as _json_mod


def _extract_json_block(text: str) -> Optional[Any]:
    """Try to parse a JSON object/array from an LLM response.
    Handles ```json fences, bare JSON, and leading/trailing prose using a
    balanced-brace / bracket scanner (robust to stray braces in prose).
    """
    if not text:
        return None
    stripped = text.strip()
    # Strip markdown fences
    if stripped.startswith("```"):
        lines = stripped.splitlines()
        lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        stripped = "\n".join(lines).strip()

    # First: try direct parse
    try:
        return _json_mod.loads(stripped)
    except Exception:
        pass

    # Second: use JSONDecoder.raw_decode, scanning for the first '{' or '['.
    decoder = _json_mod.JSONDecoder()
    for i, ch in enumerate(stripped):
        if ch in ("{", "["):
            try:
                obj, _ = decoder.raw_decode(stripped[i:])
                return obj
            except Exception:
                continue
    return None


async def fn_invoke_llm(body: Dict[str, Any], user: Dict[str, Any]) -> Dict[str, Any]:
    """Generic LLM invocation used by base44.integrations.Core.InvokeLLM shim.
    - prompt: string (will be wrapped into a single user message if messages not provided)
    - messages: optional list of {role, content}
    - system_prompt: optional override
    - response_json_schema: if present, LLM is instructed to return JSON and we parse it.
    Returns either {content: str} or the parsed JSON object directly when schema requested.
    """
    prompt = body.get("prompt", "")
    messages = body.get("messages")
    system = body.get("system_prompt") or AEGIS_SYSTEM_PROMPT
    wants_json = bool(body.get("response_json_schema"))

    if not messages:
        messages = [{"role": "user", "content": str(prompt)}]

    if wants_json:
        # Reinforce JSON-only output in the system prompt
        system = (
            (system or "") +
            "\n\nIMPORTANT: Tu DOIS répondre EXCLUSIVEMENT avec un JSON valide, "
            "sans texte avant ni après, sans balises markdown ``` ni commentaires."
        )
        # Append schema reminder to the user's last message
        if messages and messages[-1].get("role") == "user":
            messages = list(messages)
            messages[-1] = {
                **messages[-1],
                "content": messages[-1]["content"]
                + "\n\nRéponds UNIQUEMENT avec le JSON structuré demandé, sans ```.",
            }

    reply = await llm_chat(
        session_id=f"invoke-{user['id']}-{uuid.uuid4()}",
        system_prompt=system,
        messages=messages,
        usecase=body.get("usecase") or "cognitive_chat",
        user_id=user.get("id"),
    )

    if wants_json:
        parsed = _extract_json_block(reply)
        if parsed is not None:
            # Return the parsed object directly so the JS caller can access fields.
            return parsed
        # Fallback: return an error-ish structure matching expected shape if possible
        return {"_llm_raw": reply, "_parse_error": "Impossible de parser le JSON"}

    return {"content": reply, "reply": reply}


# ---------------------------------------------------------------------------
# Function: orchestrateAgent
# ---------------------------------------------------------------------------
async def fn_orchestrate_agent(body: Dict[str, Any], user: Dict[str, Any]) -> Dict[str, Any]:
    agent_id = body.get("agent_id")
    prompt = body.get("prompt")
    parent_execution_id = body.get("parent_execution_id")
    depth = body.get("depth", 1)

    if not agent_id or not prompt:
        raise HTTPException(status_code=400, detail="Missing agent_id or prompt")

    agents_col = _collection("Agent")
    agent = await agents_col.find_one({"id": agent_id}, {"_id": 0})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    if depth > agent.get("max_depth", 3):
        raise HTTPException(status_code=400, detail="Max depth exceeded")

    start = datetime.now(timezone.utc)
    exec_id = str(uuid.uuid4())

    exec_doc = {
        "id": exec_id,
        "agent_id": agent_id,
        "agent_name": agent["name"],
        "prompt": prompt,
        "parent_execution_id": parent_execution_id,
        "depth": depth,
        "status": "running",
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "created_by": user["id"],
    }
    await _collection("AgentExecution").insert_one(dict(exec_doc))

    # Build skills context
    skill_ids = agent.get("skills", []) or []
    skills = []
    if skill_ids:
        async for s in _collection("Skill").find({"id": {"$in": skill_ids}}, {"_id": 0}):
            if s.get("enabled", True):
                skills.append(s)
    skill_desc = "\n".join(f"- {s['name']}: {s.get('description', '')}" for s in skills) or "(aucun)"

    sys_prompt = (
        f"Tu es un agent autonome IA nommé '{agent['name']}'.\n"
        f"Rôle: {agent['role']}\n"
        f"Description: {agent.get('description', '')}\n\n"
        f"Skills disponibles:\n{skill_desc}\n\n"
        "Réponds de manière structurée et actionnable, en français."
    )

    try:
        result = await llm_chat(
            session_id=f"agent-{agent_id}-{exec_id}",
            system_prompt=sys_prompt,
            messages=[{"role": "user", "content": prompt}],
            usecase="agent_orchestr",
            user_id=user["id"],
        )
    except Exception as e:  # pragma: no cover
        result = f"Erreur: {e}"

    exec_time_ms = int((datetime.now(timezone.utc) - start).total_seconds() * 1000)
    tokens = int(len(prompt) / 4 + len(result) / 4)

    await _collection("AgentExecution").update_one(
        {"id": exec_id},
        {
            "$set": {
                "status": "success",
                "result": result,
                "execution_time_ms": exec_time_ms,
                "tokens_used": tokens,
                "spawned_agents": [],
                "updated_at": now_iso(),
            }
        },
    )
    await agents_col.update_one(
        {"id": agent_id},
        {
            "$inc": {"total_executions": 1},
            "$set": {"last_execution": now_iso()},
        },
    )

    return {
        "execution_id": exec_id,
        "status": "success",
        "result": result,
        "spawned_agents": [],
        "time_ms": exec_time_ms,
    }


# ---------------------------------------------------------------------------
# Function: predictResonance
# ---------------------------------------------------------------------------
def _linreg(values):
    n = len(values)
    if n < 2:
        return 0.0, (values[0] if values else 0.0), 0.0
    x_mean = (n - 1) / 2
    y_mean = sum(values) / n
    ss_xy = sum((i - x_mean) * (v - y_mean) for i, v in enumerate(values))
    ss_xx = sum((i - x_mean) ** 2 for i in range(n))
    ss_yy = sum((v - y_mean) ** 2 for v in values)
    slope = 0.0 if ss_xx == 0 else ss_xy / ss_xx
    intercept = y_mean - slope * x_mean
    r2 = 1.0 if ss_yy == 0 else max(0.0, min(1.0, (ss_xy ** 2) / (ss_xx * ss_yy)))
    return slope, intercept, r2


def _exp_smooth(values, alpha=0.3):
    if not values:
        return 0.0
    s = values[0]
    for v in values[1:]:
        s = alpha * v + (1 - alpha) * s
    return s


def _predict_next(values, steps=5):
    slope, intercept, r2 = _linreg(values)
    smoothed = _exp_smooth(values)
    n = len(values)
    preds = []
    for i in range(1, steps + 1):
        lin = slope * (n + i - 1) + intercept
        blended = r2 * lin + (1 - r2) * (smoothed + slope * i)
        preds.append(max(0.0, min(1.0, blended)))
    return preds, slope, r2, smoothed


async def fn_predict_resonance(body: Dict[str, Any], user: Dict[str, Any]) -> Dict[str, Any]:
    nodes = [
        n async for n in _collection("MemoryNode")
        .find({}, {"_id": 0})
        .sort([("resonance", -1)])
        .limit(100)
    ]
    if not nodes:
        return {"predictions": [], "alerts": [], "stats": {}, "generated_at": now_iso()}

    events = [
        e async for e in _collection("AuditEvent")
        .find({}, {"_id": 0})
        .sort([("ts", -1)])
        .limit(200)
    ]

    node_history: Dict[str, List[float]] = {}
    for e in events:
        if e.get("type") in ("RESONANCE_UP", "RESONANCE_DOWN") and e.get("to_val") is not None:
            node_history.setdefault(e["node_id"], []).append(e["to_val"])

    resonances = [n["resonance"] for n in nodes]
    mean = sum(resonances) / len(resonances)
    std = math.sqrt(sum((v - mean) ** 2 for v in resonances) / len(resonances))

    predictions = []
    alerts = []

    for node in nodes:
        hist = node_history.get(node["node_id"], [])
        series = hist[-10:] if len(hist) >= 3 else [node["resonance"]]
        preds, slope, r2, smoothed = _predict_next(series, 5)
        max_pred = max(preds)
        z = 0.0 if std == 0 else (node["resonance"] - mean) / std
        anomaly = min(
            1.0,
            (0.4 if node["resonance"] > 0.8 else 0)
            + (min(0.4, slope * 4) if slope > 0.05 else 0)
            + (min(0.3, (z - 2) * 0.15) if z > 2 else 0),
        )
        trend = "rising" if slope > 0.02 else "falling" if slope < -0.02 else "stable"
        entry = {
            "node_id": node["node_id"],
            "concept": node["concept"],
            "fractal_level": node["fractal_level"],
            "tier": node["tier"],
            "current": node["resonance"],
            "predicted_5steps": preds,
            "max_predicted": max_pred,
            "slope": round(slope, 4),
            "r2": round(r2, 3),
            "trend": trend,
            "anomaly_score": round(anomaly, 3),
            "z_score": round(z, 2),
        }
        predictions.append(entry)

        if max_pred > 0.9 and slope > 0:
            alerts.append({
                "severity": "critical",
                "node_id": node["node_id"],
                "concept": node["concept"],
                "message": f"Surcharge imminente prédite: {int(max_pred * 100)}% dans ~5 cycles",
                "current": node["resonance"],
                "predicted_peak": max_pred,
                "recommendation": "Déclencher pruning préventif ou réduire propagation vers ce nœud",
            })
        elif max_pred > 0.78 and slope > 0.01:
            alerts.append({
                "severity": "warning",
                "node_id": node["node_id"],
                "concept": node["concept"],
                "message": f"Tendance haussière: {int(node['resonance'] * 100)}% → {int(max_pred * 100)}%",
                "current": node["resonance"],
                "predicted_peak": max_pred,
                "recommendation": "Surveiller et préparer une intervention si dépassement de 85%",
            })
        elif anomaly > 0.5:
            alerts.append({
                "severity": "anomaly",
                "node_id": node["node_id"],
                "concept": node["concept"],
                "message": f"Anomalie élevée: {int(anomaly * 100)}% (z={z:.1f})",
                "current": node["resonance"],
                "predicted_peak": max_pred,
                "recommendation": "Vérifier les connexions du nœud et son contexte fractal",
            })

    predictions.sort(key=lambda p: p["anomaly_score"], reverse=True)
    sev_order = {"critical": 0, "warning": 1, "anomaly": 2}
    alerts.sort(key=lambda a: sev_order.get(a["severity"], 3))

    stats = {
        "total_nodes": len(nodes),
        "rising_nodes": sum(1 for p in predictions if p["trend"] == "rising"),
        "critical_predicted": sum(1 for a in alerts if a["severity"] == "critical"),
        "warning_predicted": sum(1 for a in alerts if a["severity"] == "warning"),
        "anomaly_detected": sum(1 for a in alerts if a["severity"] == "anomaly"),
        "population_mean": round(mean, 3),
        "population_std": round(std, 3),
    }

    return {
        "predictions": predictions[:20],
        "alerts": alerts[:15],
        "stats": stats,
        "generated_at": now_iso(),
    }


# ---------------------------------------------------------------------------
# Function: retrieveContext (TF-IDF based RAG)
# ---------------------------------------------------------------------------
import re
from collections import Counter

_STOP_WORDS = {
    "le","la","les","un","une","des","de","du","et","ou","a","à","au","aux","en","dans","pour",
    "sur","par","avec","sans","ce","cet","cette","ces","il","elle","ils","elles","on","nous",
    "vous","je","tu","qui","que","quoi","est","sont","ete","été","être","avoir","y","ne","pas",
    "plus","moins","the","a","an","of","in","on","for","to","is","are","and","or","but","not",
    "as","by","at","from","with","this","that","it","its","be","been","was","were","has","have",
    "d","l","s","t","m","n","c","j","qu"
}


def _tokenize(text: str) -> List[str]:
    # lowercase, keep letters/digits, split on non-word
    tokens = re.findall(r"[A-Za-zÀ-ÿ0-9]+", (text or "").lower())
    return [t for t in tokens if len(t) > 1 and t not in _STOP_WORDS]


def _build_tfidf_vector(tokens: List[str], idf: Dict[str, float]) -> Dict[str, float]:
    tf = Counter(tokens)
    if not tf:
        return {}
    max_tf = max(tf.values())
    return {t: (0.5 + 0.5 * (c / max_tf)) * idf.get(t, 0.0) for t, c in tf.items()}


def _sparse_cosine(a: Dict[str, float], b: Dict[str, float]) -> float:
    if not a or not b:
        return 0.0
    common = set(a) & set(b)
    if not common:
        return 0.0
    dot = sum(a[t] * b[t] for t in common)
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    return dot / (na * nb) if na and nb else 0.0


async def fn_retrieve_context(body: Dict[str, Any], user: Dict[str, Any]) -> Dict[str, Any]:
    query = body.get("query")
    top_k = body.get("top_k", 5)
    if not query:
        raise HTTPException(status_code=400, detail="Query required")

    docs = [d async for d in _collection("KnowledgeDocument").find({}, {"_id": 0}).limit(200)]
    # Collect all chunks across docs
    all_chunks = []  # (doc, chunk_text)
    for doc in docs:
        for chunk in doc.get("content_chunks", []) or []:
            txt = chunk.get("text", "")
            if txt:
                all_chunks.append((doc, txt))
    if not all_chunks:
        return {"status": "success", "query": query, "results": [], "context": ""}

    # Build IDF over the whole corpus at query time (small corpora are fine; cache if needed)
    N = len(all_chunks)
    df: Counter = Counter()
    chunk_tokens = []
    for _, txt in all_chunks:
        toks = _tokenize(txt)
        chunk_tokens.append(toks)
        df.update(set(toks))
    idf = {t: math.log((N + 1) / (c + 1)) + 1.0 for t, c in df.items()}

    q_vec = _build_tfidf_vector(_tokenize(query), idf)
    results = []
    for (doc, txt), toks in zip(all_chunks, chunk_tokens):
        c_vec = _build_tfidf_vector(toks, idf)
        sim = _sparse_cosine(q_vec, c_vec)
        if sim <= 0:
            continue
        results.append({
            "text": txt,
            "similarity": round(sim, 4),
            "document_title": doc.get("title", ""),
            "document_id": doc.get("id"),
            "source_type": doc.get("source_type", ""),
        })
    results.sort(key=lambda r: r["similarity"], reverse=True)
    top = results[:top_k]
    return {
        "status": "success",
        "query": query,
        "results": top,
        "context": "\n\n---\n\n".join(r["text"] for r in top),
    }


# ---------------------------------------------------------------------------
# Function: indexDocument
# ---------------------------------------------------------------------------
async def fn_index_document(body: Dict[str, Any], user: Dict[str, Any]) -> Dict[str, Any]:
    title = body.get("title")
    source_type = body.get("source_type")
    content = body.get("content")
    source_url = body.get("source_url")
    metadata = body.get("metadata") or {}

    if not title or not source_type or not content:
        raise HTTPException(status_code=400, detail="Missing required fields")

    chunk_size = 500
    overlap = 100
    chunks = []
    i = 0
    while i < len(content):
        piece = content[i : i + chunk_size]
        if len(piece.strip()) > 50:
            chunks.append(piece)
        i += chunk_size - overlap

    # Chunks no longer store embeddings (TF-IDF computed at query time).
    content_chunks = [
        {"text": t, "chunk_index": idx}
        for idx, t in enumerate(chunks)
    ]

    doc = {
        "id": str(uuid.uuid4()),
        "title": title,
        "source_type": source_type,
        "content": content,
        "source_url": source_url,
        "content_chunks": content_chunks,
        "metadata": metadata,
        "indexed_at": now_iso(),
        "is_indexed": True,
        "chunk_count": len(content_chunks),
        "created_at": now_iso(),
        "created_by": user["id"],
    }
    await _collection("KnowledgeDocument").insert_one(dict(doc))
    return {
        "status": "success",
        "document_id": doc["id"],
        "chunks_created": len(content_chunks),
        "title": title,
    }


# ---------------------------------------------------------------------------
# Function: testSkill
# ---------------------------------------------------------------------------
async def fn_test_skill(body: Dict[str, Any], user: Dict[str, Any]) -> Dict[str, Any]:
    skill_id = body.get("skill_id")
    skill_name = body.get("skill_name")
    test_input = body.get("test_input")
    system_prompt = body.get("system_prompt", "Tu es un skill IA AEGIS-Q. Sois précis et structuré.")
    if not skill_id or not skill_name or not test_input:
        raise HTTPException(status_code=400, detail="Missing required fields")

    start = datetime.now(timezone.utc)
    try:
        result = await llm_chat(
            session_id=f"skill-{skill_id}-{uuid.uuid4()}",
            system_prompt=system_prompt,
            messages=[{"role": "user", "content": test_input}],
            usecase="skill_test",
            user_id=user["id"],
        )
        ms = int((datetime.now(timezone.utc) - start).total_seconds() * 1000)
        tokens = int(len(test_input) / 4 + len(result) / 4)
        await _collection("SkillExecution").insert_one({
            "id": str(uuid.uuid4()),
            "skill_id": skill_id,
            "skill_name": skill_name,
            "test_input": test_input,
            "test_output": result,
            "status": "success",
            "execution_time_ms": ms,
            "tokens_used": tokens,
            "system_prompt": system_prompt,
            "created_at": now_iso(),
            "created_by": user["id"],
        })
        return {"status": "success", "result": result, "time_ms": ms, "tokens": tokens}
    except Exception as e:
        ms = int((datetime.now(timezone.utc) - start).total_seconds() * 1000)
        await _collection("SkillExecution").insert_one({
            "id": str(uuid.uuid4()),
            "skill_id": skill_id,
            "skill_name": skill_name,
            "test_input": test_input,
            "test_output": None,
            "status": "failed",
            "error_message": str(e),
            "execution_time_ms": ms,
            "system_prompt": system_prompt,
            "created_at": now_iso(),
            "created_by": user["id"],
        })
        return {"status": "failed", "error": str(e), "time_ms": ms}


# ---------------------------------------------------------------------------
# Function: checkPriceAlerts (telegram simulated)
# ---------------------------------------------------------------------------
async def fn_check_price_alerts(body: Dict[str, Any], user: Dict[str, Any]) -> Dict[str, Any]:
    # Use real AQ synthetic price by default
    aq = await _compute_aq_price()
    current_price = body.get("current_price", aq["usd"])
    alerts_col = _collection("UserPriceAlert")
    alerts = [a async for a in alerts_col.find({"enabled": True}, {"_id": 0})]
    if not alerts:
        return {
            "message": "No alerts configured",
            "checked": 0,
            "alerts_sent": 0,
            "current_price": current_price,
            "change24h": aq["change24h"],
        }

    sent = 0
    for al in alerts:
        should_alert = False
        if al.get("upper_threshold") and current_price >= al["upper_threshold"]:
            should_alert = True
        if al.get("lower_threshold") and current_price <= al["lower_threshold"]:
            should_alert = True
        if should_alert:
            await alerts_col.update_one(
                {"id": al["id"]}, {"$set": {"last_alert_date": now_iso()}}
            )
            sent += 1
    return {
        "message": "Price check completed",
        "checked": len(alerts),
        "alerts_sent": sent,
        "current_price": current_price,
        "change24h": aq["change24h"],
    }


# ---------------------------------------------------------------------------
# Function dispatcher
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# La Ruche — swarm status monitor
# ---------------------------------------------------------------------------
@api.get("/ruche/status")
async def ruche_status(user: Dict[str, Any] = Depends(get_current_user)):
    """Probe all 9 bees of La Ruche and return their availability."""
    import ruche as _ruche
    if not _ruche.is_ruche_enabled():
        return {"enabled": False, "bees": [], "message": "OPENROUTER_API_KEY not configured"}
    bees = await _ruche.swarm_status()
    # Attach metadata from BEES dict
    enriched = []
    for b in bees:
        meta = _ruche.BEES.get(b.get("role"), {})
        enriched.append({
            **b,
            "label": meta.get("label"),
            "icon": meta.get("icon"),
            "model": meta.get("model"),
            "specialty": meta.get("role"),
            "budget": meta.get("budget"),
            "is_embedding": meta.get("embedding", False),
        })
    # Récupère le solde OpenRouter (non bloquant)
    credits = None
    try:
        credits = await _ruche.get_credits()
    except Exception as e:
        logger.warning("get_credits failed: %s", e)
    return {
        "enabled": True,
        "bees": enriched,
        "usecases": _ruche.USECASE_ROUTING,
        "credits": credits,
        "ts": now_iso(),
    }


@api.post("/ruche/test")
async def ruche_test_usecase(
    body: Dict[str, Any],
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Test a specific usecase routing against La Ruche."""
    import ruche as _ruche
    usecase = body.get("usecase", "cognitive_chat")
    query = body.get("query", "Réponds en 1 phrase : qu'est-ce que AEGIS-Q ?")
    result = await _ruche.call_usecase(
        usecase=usecase,
        messages=[{"role": "user", "content": query}],
        system_prompt="Réponds en français, brièvement.",
        max_tokens=300,
    )
    return result


# --- Phase 10: Superviseur Qwen — Smart semantic routing --------------------

@api.post("/ruche/smart-route")
async def ruche_smart_route(
    body: Dict[str, Any],
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Qwen superviseur : sélection sémantique de la meilleure abeille pour une query."""
    import ruche as _ruche
    query = (body.get("query") or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="query required")
    top_k = int(body.get("top_k", 3))
    return await _ruche.smart_route(query, top_k=top_k)


@api.post("/ruche/auto")
async def ruche_auto(
    body: Dict[str, Any],
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Chat auto-routé : Qwen choisit l'abeille, puis cascade de fallback."""
    import ruche as _ruche
    query = (body.get("query") or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="query required")
    system = body.get("system_prompt") or "Réponds en français, brièvement et précisément."
    max_tokens = body.get("max_tokens")
    return await _ruche.call_auto(query=query, system_prompt=system, max_tokens=max_tokens)


# --- Phase 10: Reine Gemini — N-MEM-B long-term memory ----------------------

@api.post("/ruche/queen/remember")
async def ruche_queen_remember(
    body: Dict[str, Any],
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Stocke un souvenir dans la mémoire N-MEM-B (embedding Gemini Queen)."""
    import ruche as _ruche
    content = (body.get("content") or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="content required")
    metadata = body.get("metadata") or {}
    metadata["user_id"] = user["id"]
    return await _ruche.queen_remember(db.queen_memory, content, metadata)


@api.post("/ruche/queen/recall")
async def ruche_queen_recall(
    body: Dict[str, Any],
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Recall top-k souvenirs similaires (cosine Gemini Queen)."""
    import ruche as _ruche
    query = (body.get("query") or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="query required")
    top_k = max(1, min(int(body.get("top_k", 3)), 50))  # cap anti-abus
    filter_tag = body.get("filter_tag")
    results = await _ruche.queen_recall(db.queen_memory, query, top_k=top_k, filter_tag=filter_tag)
    return {"query": query, "results": results, "count": len(results)}


# --- Phase 12: Token Savings Dashboard --------------------------------------
# Compare l'usage réel (budgets spécialisés) vs un modèle généraliste unique
# Mistral Large à 2000 tok/req (baseline "sans Ruche").
_BASELINE_TOKENS_PER_REQ = 2000  # hypothèse : sans Ruche, tout tapperait Mistral Large à max capacity
# Coût OpenRouter Mistral Large (input+output moyen ~$3/1M tok). Approximation.
_COST_PER_1K_TOKENS_USD = 0.003


@api.get("/ruche/savings")
async def ruche_savings(
    days: int = 30,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Statistiques d'économie pour le Token Savings Dashboard.
    - 'days' : fenêtre (default 30, max 365)
    - par défaut : stats du user connecté. Admin (si future-proof) verrait global.
    """
    days = max(1, min(int(days or 30), 365))
    from datetime import timedelta
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    # Pipeline agrégation par abeille pour l'utilisateur
    pipeline = [
        {"$match": {"user_id": user["id"], "created_at": {"$gte": since}}},
        {"$group": {
            "_id": "$bee_role",
            "count": {"$sum": 1},
            "tokens_used": {"$sum": "$tokens_budget"},
            "bee_label": {"$last": "$bee_label"},
        }},
        {"$sort": {"count": -1}},
    ]
    by_bee: List[Dict[str, Any]] = []
    async for row in db.ruche_usage.aggregate(pipeline):
        by_bee.append({
            "bee_role": row["_id"],
            "bee_label": row.get("bee_label"),
            "count": row["count"],
            "tokens_used": int(row["tokens_used"] or 0),
        })

    total_requests = sum(b["count"] for b in by_bee)
    total_tokens_ruche = sum(b["tokens_used"] for b in by_bee)
    baseline_tokens = total_requests * _BASELINE_TOKENS_PER_REQ
    tokens_saved = max(0, baseline_tokens - total_tokens_ruche)
    savings_ratio = (tokens_saved / baseline_tokens) if baseline_tokens > 0 else 0.0

    cost_ruche = round(total_tokens_ruche / 1000 * _COST_PER_1K_TOKENS_USD, 4)
    cost_baseline = round(baseline_tokens / 1000 * _COST_PER_1K_TOKENS_USD, 4)
    cost_saved = round(cost_baseline - cost_ruche, 4)

    return {
        "window_days": days,
        "total_requests": total_requests,
        "tokens": {
            "ruche_actual": total_tokens_ruche,
            "baseline_single_model": baseline_tokens,
            "saved": tokens_saved,
            "savings_ratio": round(savings_ratio, 4),
        },
        "cost_usd": {
            "ruche_actual": cost_ruche,
            "baseline_single_model": cost_baseline,
            "saved": cost_saved,
        },
        "by_bee": by_bee,
        "ts": now_iso(),
    }


@api.get("/ruche/savings/trend")
async def ruche_savings_trend(
    days: int = 14,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Tokens économisés par jour (pour sparkline). Default 14j."""
    days = max(1, min(int(days or 14), 90))
    from datetime import timedelta
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    # Agrège par jour (YYYY-MM-DD prefix de created_at)
    pipeline = [
        {"$match": {"user_id": user["id"], "created_at": {"$gte": since}}},
        {"$group": {
            "_id": {"$substr": ["$created_at", 0, 10]},
            "count": {"$sum": 1},
            "tokens_used": {"$sum": "$tokens_budget"},
        }},
        {"$sort": {"_id": 1}},
    ]
    series: List[Dict[str, Any]] = []
    async for row in db.ruche_usage.aggregate(pipeline):
        baseline = row["count"] * _BASELINE_TOKENS_PER_REQ
        series.append({
            "date": row["_id"],
            "requests": row["count"],
            "tokens_used": int(row["tokens_used"] or 0),
            "tokens_saved": max(0, baseline - int(row["tokens_used"] or 0)),
        })
    return {"window_days": days, "series": series}


FUNCTIONS = {
    "gemmaChat": fn_gemma_chat,
    "invokeLLM": fn_invoke_llm,
    "orchestrateAgent": fn_orchestrate_agent,
    "predictResonance": fn_predict_resonance,
    "retrieveContext": fn_retrieve_context,
    "indexDocument": fn_index_document,
    "testSkill": fn_test_skill,
    "checkPriceAlerts": fn_check_price_alerts,
}


@api.post("/functions/invoke/{name}")
async def invoke_function(
    name: str,
    body: Dict[str, Any],
    user: Dict[str, Any] = Depends(get_current_user),
):
    handler = FUNCTIONS.get(name)
    if not handler:
        raise HTTPException(status_code=404, detail=f"Function '{name}' not found")
    return await handler(body or {}, user)


# ---------------------------------------------------------------------------
# Stripe payments (tiered SaaS subscriptions)
# ---------------------------------------------------------------------------
STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")

# Fixed server-side packages — NEVER trust prices from the frontend
PAYMENT_PACKAGES = {
    "starter": {"name": "Starter", "amount": 299.0, "currency": "usd"},
    "professional": {"name": "Professional", "amount": 999.0, "currency": "usd"},
    # "enterprise" is contact-sales, not a direct checkout
}


class CheckoutSessionBody(BaseModel):
    package_id: str = Field(pattern=r"^[a-z_]+$")
    origin_url: str = Field(min_length=10, max_length=500)


@api.post("/payments/checkout/session")
async def create_checkout_session(
    body: CheckoutSessionBody,
    request: Request,
    user: Dict[str, Any] = Depends(get_current_user),
):
    if body.package_id == "enterprise":
        raise HTTPException(status_code=400, detail="Contactez le service commercial pour l'offre Enterprise")
    pkg = PAYMENT_PACKAGES.get(body.package_id)
    if not pkg:
        raise HTTPException(status_code=400, detail="Package invalide")
    if not (body.origin_url.startswith("https://") or body.origin_url.startswith("http://")):
        raise HTTPException(status_code=400, detail="origin_url doit commencer par http(s)://")
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Stripe non configuré")

    from emergentintegrations.payments.stripe.checkout import (
        StripeCheckout, CheckoutSessionRequest,
    )

    origin = body.origin_url.rstrip("/")
    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    success_url = f"{origin}/payments/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/brochure"
    metadata = {
        "user_id": user["id"],
        "user_email": user.get("email", ""),
        "package_id": body.package_id,
        "source": "saas_brochure",
    }

    req = CheckoutSessionRequest(
        amount=pkg["amount"],
        currency=pkg["currency"],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    )
    session = await stripe_checkout.create_checkout_session(req)

    # Persist a pending transaction BEFORE redirecting
    tx = {
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "user_id": user["id"],
        "user_email": user.get("email"),
        "package_id": body.package_id,
        "package_name": pkg["name"],
        "amount": pkg["amount"],
        "currency": pkg["currency"],
        "status": "initiated",
        "payment_status": "pending",
        "metadata": metadata,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.payment_transactions.insert_one(dict(tx))
    await _track(
        "checkout_initiated",
        user_id=user["id"],
        properties={"package_id": body.package_id, "amount": pkg["amount"]},
    )

    return {"url": session.url, "session_id": session.session_id}


@api.get("/payments/checkout/status/{session_id}")
async def get_checkout_status(
    session_id: str,
    request: Request,
    user: Dict[str, Any] = Depends(get_current_user),
):
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Stripe non configuré")
    tx = await db.payment_transactions.find_one(
        {"session_id": session_id}, {"_id": 0}
    )
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction introuvable")
    # Only the initiating user can poll its own status
    if tx.get("user_id") and tx["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Accès refusé")

    # If already completed, return cached status (idempotent; no double-credit)
    if tx.get("payment_status") == "paid":
        return {
            "status": tx["status"],
            "payment_status": "paid",
            "amount_total": int(tx["amount"] * 100),
            "currency": tx["currency"],
            "metadata": tx.get("metadata", {}),
        }

    from emergentintegrations.payments.stripe.checkout import StripeCheckout

    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)
    try:
        status = await stripe_checkout.get_checkout_status(session_id)
    except Exception as e:
        # Fallback: the proxied Stripe key may not retain sessions between create & retrieve.
        # Return the DB-cached transaction so the frontend can still show 'pending'.
        logger.warning("Stripe status fetch failed for %s: %s — returning cached DB row", session_id, e)
        return {
            "status": tx.get("status", "initiated"),
            "payment_status": tx.get("payment_status", "pending"),
            "amount_total": int(tx["amount"] * 100),
            "currency": tx["currency"],
            "metadata": tx.get("metadata", {}),
            "_source": "db_cache",
        }

    # Update DB once
    update = {
        "status": status.status,
        "payment_status": status.payment_status,
        "updated_at": now_iso(),
    }
    result = await db.payment_transactions.update_one(
        {"session_id": session_id, "payment_status": {"$ne": "paid"}},
        {"$set": update},
    )

    # If just transitioned to paid, grant subscription tier to user (idempotent via modified_count check)
    if (
        status.payment_status == "paid"
        and result.modified_count > 0
        and tx.get("user_id")
        and tx.get("package_id")
    ):
        await db.users.update_one(
            {"id": tx["user_id"]},
            {
                "$set": {
                    "subscription_tier": tx["package_id"],
                    "subscription_activated_at": now_iso(),
                    "subscription_session_id": session_id,
                }
            },
        )
        await _track(
            "checkout_paid",
            user_id=tx["user_id"],
            properties={
                "package_id": tx["package_id"],
                "amount": tx["amount"],
                "session_id": session_id,
            },
        )
        logger.info("Granted tier %s to user %s via session %s", tx["package_id"], tx["user_id"], session_id)

    return {
        "status": status.status,
        "payment_status": status.payment_status,
        "amount_total": status.amount_total,
        "currency": status.currency,
        "metadata": status.metadata,
    }


@app.post("/api/webhook/stripe")
async def stripe_webhook(request: Request):
    if not STRIPE_API_KEY:
        raise HTTPException(status_code=503, detail="Stripe non configuré")

    from emergentintegrations.payments.stripe.checkout import StripeCheckout

    host_url = str(request.base_url).rstrip("/")
    webhook_url = f"{host_url}/api/webhook/stripe"
    stripe_checkout = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    body_bytes = await request.body()
    sig = request.headers.get("Stripe-Signature", "")
    try:
        event = await stripe_checkout.handle_webhook(body_bytes, sig)
    except Exception as e:
        logger.warning("Stripe webhook verify failed: %s", e)
        raise HTTPException(status_code=400, detail="Invalid webhook")

    if event.session_id:
        # Fetch the tx to know which user/package to grant
        tx = await db.payment_transactions.find_one(
            {"session_id": event.session_id}, {"_id": 0}
        )
        # Idempotent update of payment_transaction
        result = await db.payment_transactions.update_one(
            {"session_id": event.session_id, "payment_status": {"$ne": "paid"}},
            {
                "$set": {
                    "payment_status": event.payment_status or "unknown",
                    "last_event": event.event_type,
                    "last_event_id": event.event_id,
                    "updated_at": now_iso(),
                }
            },
        )
        # At-least-once tier grant on first transition to 'paid'
        if (
            event.payment_status == "paid"
            and result.modified_count > 0
            and tx
            and tx.get("user_id")
            and tx.get("package_id")
        ):
            await db.users.update_one(
                {"id": tx["user_id"]},
                {
                    "$set": {
                        "subscription_tier": tx["package_id"],
                        "subscription_activated_at": now_iso(),
                        "subscription_session_id": event.session_id,
                    }
                },
            )
            logger.info("[webhook] Granted tier %s to user %s", tx["package_id"], tx["user_id"])
    return {"ok": True}


# ---------------------------------------------------------------------------
# Public API — unauthenticated smart-contract audit + signed badge
# ---------------------------------------------------------------------------
_PUBLIC_IP_RATE: Dict[str, List[float]] = {}
_PUBLIC_RATE_LOCK = asyncio.Lock()
_PUBLIC_RATE_LIMIT = 3            # audits per window
_PUBLIC_RATE_WINDOW = 3600        # 1 hour
_PUBLIC_AUDIT_MAX_CHARS = 12000


def _client_ip(request: Request) -> str:
    xf = request.headers.get("x-forwarded-for")
    if xf:
        return xf.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def _check_public_rate(ip: str):
    """Concurrency-safe sliding-window rate limiter with periodic TTL pruning."""
    now = _time.time()
    async with _PUBLIC_RATE_LOCK:
        # Prune stale IPs (any IP whose most-recent call is older than the window)
        # Run a sweep at most ~1/1000 calls to keep cost low.
        if len(_PUBLIC_IP_RATE) > 0 and hash(ip) % 1000 == 0:
            stale = [
                key for key, ts_list in _PUBLIC_IP_RATE.items()
                if not ts_list or ts_list[-1] < now - _PUBLIC_RATE_WINDOW
            ]
            for key in stale:
                _PUBLIC_IP_RATE.pop(key, None)

        recent = [t for t in _PUBLIC_IP_RATE.get(ip, []) if t > now - _PUBLIC_RATE_WINDOW]
        if len(recent) >= _PUBLIC_RATE_LIMIT:
            _PUBLIC_IP_RATE[ip] = recent
            raise HTTPException(
                status_code=429,
                detail=f"Limite atteinte: {_PUBLIC_RATE_LIMIT} audits/heure par IP. Créez un compte pour auditer sans limite.",
            )
        recent.append(now)
        _PUBLIC_IP_RATE[ip] = recent


def _sign_badge(audit_id: str, score: int, contract_name: str) -> str:
    """HMAC-SHA256 signed badge token. Compact, URL-safe."""
    payload = f"{audit_id}|{score}|{contract_name}|{now_iso()}"
    sig = hmac.new(JWT_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}|{sig}"


def _verify_badge(token: str) -> Optional[Dict[str, Any]]:
    try:
        parts = token.split("|")
        if len(parts) != 5:
            return None
        audit_id, score, contract_name, issued_at, sig = parts
        expected_payload = f"{audit_id}|{score}|{contract_name}|{issued_at}"
        expected_sig = hmac.new(
            JWT_SECRET.encode(), expected_payload.encode(), hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(expected_sig, sig):
            return None
        return {
            "audit_id": audit_id,
            "score": int(score),
            "contract_name": contract_name,
            "issued_at": issued_at,
            "valid": True,
        }
    except Exception:
        return None


class PublicAuditBody(BaseModel):
    code: str = Field(min_length=20, max_length=_PUBLIC_AUDIT_MAX_CHARS)
    name: str = Field(default="Contract.sol", max_length=80, pattern=r"^[^|\n\r\t]*$")


@api.post("/public/audit")
async def public_audit(body: PublicAuditBody, request: Request):
    ip = _client_ip(request)

    # Detect optional premium bearer — premium users bypass rate-limit & get no watermark
    premium_user = None
    auth_hdr = request.headers.get("authorization") or ""
    if auth_hdr.lower().startswith("bearer "):
        token = auth_hdr.split(" ", 1)[1].strip()
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
            uid = payload.get("sub")
            if uid:
                candidate = await db.users.find_one(
                    {"id": uid, "subscription_tier": {"$in": list(PAYMENT_PACKAGES.keys())}},
                    {"_id": 0, "password_hash": 0},
                )
                if candidate:
                    premium_user = candidate
        except Exception:
            pass  # treat as anonymous

    if not premium_user:
        await _check_public_rate(ip)

    prompt = (
        f"Tu es un auditeur de sécurité expert en smart contracts Solidity.\n"
        f"Analyse ce contrat et retourne un rapport JSON structuré.\n\n"
        f"Contrat à auditer ({body.name}):\n```solidity\n{body.code}\n```\n\n"
        "Retourne UNIQUEMENT un JSON valide avec cette structure exacte:\n"
        '{"score_securite":<0-100>,"vulnerabilites":[{"titre":"...","severite":"CRITIQUE|ÉLEVÉE|MOYENNE|FAIBLE|INFO","categorie":"...","ligne":<n|null>,"description":"...","recommandation":"..."}],"points_positifs":["..."],"resume":"..."}'
    )

    pseudo_user = {"id": f"public-{ip}"}
    result = await fn_invoke_llm(
        {"prompt": prompt, "response_json_schema": {"type": "object"}, "usecase": "contract_audit"},
        pseudo_user,
    )

    if not isinstance(result, dict) or "score_securite" not in result:
        raise HTTPException(status_code=502, detail="L'IA n'a pas produit un audit structuré.")

    try:
        score = int(round(float(result.get("score_securite", 0))))
    except Exception:
        score = 0
    score = max(0, min(100, score))

    audit_id = str(uuid.uuid4())
    badge_token = _sign_badge(audit_id, score, body.name)

    watermark = (
        f"AEGIS-Q · {premium_user['subscription_tier'].upper()} · Rapport institutionnel"
        if premium_user
        else "SAMPLE · AEGIS-Q Public API · Non institutionnel"
    )

    doc = {
        "id": audit_id,
        "contract_name": body.name,
        "code": body.code,  # Stocké pour Sentinel (admin-only viewing)
        "code_hash": hashlib.sha256(body.code.encode()).hexdigest(),
        "score": score,
        "result": result,
        "badge_token": badge_token,
        "ip_prefix": ip.split(".")[0] if "." in ip else ip[:4],
        "ip_full": ip,  # full IP for Sentinel admin (anonymized in public APIs)
        "owner_id": premium_user["id"] if premium_user else None,
        "owner_tier": premium_user["subscription_tier"] if premium_user else None,
        "created_at": now_iso(),
        "watermark": watermark,
    }
    await db.public_audits.insert_one(dict(doc))

    # Funnel: record the audit run (distinct by IP + UA to approximate a visitor)
    try:
        ua = request.headers.get("user-agent", "")[:120]
        sk = hashlib.sha256(f"{ip}|{ua}".encode()).hexdigest()[:16]
        await _track(
            "public_audit_run",
            session_key=sk,
            user_id=premium_user["id"] if premium_user else None,
            properties={"score": score, "premium": bool(premium_user), "contract_name": body.name},
        )
    except Exception:
        pass

    return {
        "audit_id": audit_id,
        "score": score,
        "result": result,
        "badge_token": badge_token,
        "watermark": watermark,
        "premium": bool(premium_user),
        "created_at": doc["created_at"],
        "limits": {
            "per_ip_per_hour": _PUBLIC_RATE_LIMIT,
            "remaining": (
                999 if premium_user
                else _PUBLIC_RATE_LIMIT - len(_PUBLIC_IP_RATE.get(ip, []))
            ),
        },
    }


@api.get("/public/audit/{audit_id}")
async def get_public_audit(audit_id: str):
    doc = await db.public_audits.find_one(
        {"id": audit_id},
        {"_id": 0, "ip_prefix": 0, "ip_full": 0, "code": 0, "code_hash": 0},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Audit introuvable")
    return doc


@api.get("/public/badge/verify")
async def verify_badge(token: str):
    info = _verify_badge(token)
    if not info:
        return {"valid": False, "reason": "Signature invalide ou format incorrect"}
    doc = await db.public_audits.find_one(
        {"id": info["audit_id"]},
        {"_id": 0, "score": 1, "contract_name": 1},
    )
    if not doc:
        return {"valid": False, "reason": "Audit supprimé ou introuvable", **info}
    info["db_score"] = doc.get("score")
    info["db_contract"] = doc.get("contract_name")
    return info


@api.get("/public/badge/{audit_id}.svg")
async def badge_svg(audit_id: str):
    from fastapi.responses import Response as _Response

    doc = await db.public_audits.find_one(
        {"id": audit_id},
        {"_id": 0, "score": 1, "contract_name": 1},
    )
    if not doc:
        raise HTTPException(status_code=404, detail="Audit introuvable")

    score = int(doc["score"])
    contract = (doc["contract_name"] or "Contract.sol")[:30]
    if score >= 80:
        color, label = "#10b981", "SECURE"
    elif score >= 60:
        color, label = "#f59e0b", "WARN"
    elif score >= 40:
        color, label = "#f97316", "RISK"
    else:
        color, label = "#ef4444", "UNSAFE"

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="260" height="44" role="img">
  <title>Audited by AEGIS-Q · {score}/100</title>
  <linearGradient id="g" x2="0" y2="100%">
    <stop offset="0" stop-color="#1a1f2c"/>
    <stop offset="1" stop-color="#0b0e14"/>
  </linearGradient>
  <rect width="260" height="44" rx="6" fill="url(#g)"/>
  <rect x="1" y="1" width="258" height="42" rx="5" fill="none" stroke="{color}" stroke-opacity="0.5"/>
  <g font-family="Verdana,Geneva,sans-serif" fill="#e5e7eb">
    <text x="14" y="17" font-size="11" font-weight="600">AEGIS-Q · {label}</text>
    <text x="14" y="32" font-size="9" fill="#9ca3af">{contract}</text>
    <text x="246" y="28" text-anchor="end" font-size="18" font-weight="700" fill="{color}">{score}/100</text>
  </g>
</svg>"""
    return _Response(content=svg, media_type="image/svg+xml")




# ---------------------------------------------------------------------------
# Seed data
# ---------------------------------------------------------------------------
async def seed_data():
    # Seed only if empty
    if await db.memory_nodes.count_documents({}) > 0:
        return
    logger.info("Seeding AEGIS-Q demo data…")

    import random

    concepts_l0 = ["CORE_TRUST", "NETWORK_ROOT", "GENESIS", "AEGIS_PRIME"]
    concepts_l1 = ["SOVEREIGN_LEDGER", "QUANTUM_SHIELD", "DAO_NEXUS", "BRIDGE_ALPHA"]
    concepts_l2 = ["STAKE_POOL", "BURN_ENGINE", "RESONANCE_HUB", "AUDIT_WATCH"]
    concepts_l3 = ["FACTION_A", "FACTION_B", "FACTION_C", "FACTION_D", "NODE_GUARD"]
    concepts_l4 = ["TX_WAVE_1", "TX_WAVE_2", "SIGNAL_77", "ECHO_DELTA", "SENTINEL_RHO"]

    levels = [concepts_l0, concepts_l1, concepts_l2, concepts_l3, concepts_l4]
    tiers = ["SEALED", "DEEP", "ACTIVE", "SHORT_TERM", "DORMANT"]
    types_ = ["EVENT", "RELATION", "ENTITY", "PATTERN"]

    nodes = []
    for lvl, names in enumerate(levels):
        for i, c in enumerate(names):
            nid = f"n{lvl}{i}"
            nodes.append({
                "id": str(uuid.uuid4()),
                "node_id": nid,
                "concept": c,
                "type": random.choice(types_),
                "fractal_level": lvl,
                "emotion_weight": round(random.uniform(0.1, 0.9), 2),
                "resonance": round(random.uniform(0.2, 0.85), 2),
                "tier": tiers[min(lvl, 4)],
                "parent_id": None if lvl == 0 else f"n{lvl-1}{i % len(levels[lvl-1])}",
                "context_id": f"faction_{['a','b','c','d'][i % 4]}",
                "relation_ids": [],
                "last_activated": now_iso(),
                "created_at": now_iso(),
            })
    await db.memory_nodes.insert_many([dict(n) for n in nodes])

    # Audit events
    events = []
    for i in range(40):
        n = random.choice(nodes)
        ev_type = random.choice(["RESONANCE_UP", "RESONANCE_DOWN", "TIER_CHANGE", "PRUNE"])
        from_v = round(random.uniform(0.2, 0.8), 2)
        delta = round(random.uniform(-0.2, 0.2), 2)
        events.append({
            "id": str(uuid.uuid4()),
            "event_id": f"ev{i:04d}",
            "ts": (datetime.now(timezone.utc) - timedelta(hours=i)).isoformat(),
            "type": ev_type,
            "node_id": n["node_id"],
            "concept": n["concept"],
            "fractal_level": n["fractal_level"],
            "delta": delta,
            "from_val": from_v,
            "to_val": round(max(0, min(1, from_v + delta)), 2),
            "tier": n["tier"],
            "trigger": random.choice(["user_query", "auto_prune", "propagation", "external_signal"]),
            "created_at": now_iso(),
        })
    await db.audit_events.insert_many([dict(e) for e in events])

    # Faction resonance weekly
    factions = []
    for w in range(9):
        factions.append({
            "id": str(uuid.uuid4()),
            "week": f"S-{8 - w}",
            "week_index": w,
            "faction_a": round(random.uniform(0.3, 0.9), 2),
            "faction_b": round(random.uniform(0.3, 0.9), 2),
            "faction_c": round(random.uniform(0.3, 0.9), 2),
            "faction_d": round(random.uniform(0.3, 0.9), 2),
            "level_l0": round(random.uniform(0.4, 0.9), 2),
            "level_l1": round(random.uniform(0.4, 0.9), 2),
            "level_l2": round(random.uniform(0.3, 0.8), 2),
            "level_l3": round(random.uniform(0.3, 0.7), 2),
            "level_l4": round(random.uniform(0.2, 0.6), 2),
            "events_up": random.randint(5, 40),
            "events_down": random.randint(3, 25),
            "events_prune": random.randint(0, 10),
            "events_tier": random.randint(0, 8),
            "created_at": now_iso(),
        })
    await db.faction_resonances.insert_many([dict(f) for f in factions])

    # Skills
    skills = [
        {"name": "code-analyzer", "description": "Analyse statique de smart contracts Solidity", "category": "analysis", "function_name": "analyzeCode", "risk_level": "low"},
        {"name": "db-query", "description": "Interroge la base de connaissances AEGIS", "category": "data", "function_name": "queryDB", "risk_level": "low"},
        {"name": "optimize-yield", "description": "Optimise les stratégies de yield farming DeFi", "category": "optimization", "function_name": "optimizeYield", "risk_level": "medium"},
        {"name": "monitor-bridge", "description": "Surveille la santé des bridges cross-chain", "category": "monitoring", "function_name": "monitorBridge", "risk_level": "low"},
        {"name": "execute-swap", "description": "Exécute un swap sur DEX", "category": "execution", "function_name": "executeSwap", "risk_level": "high"},
    ]
    skill_docs = [
        {**s, "id": str(uuid.uuid4()), "parameters": {}, "returns": "JSON result", "enabled": True, "created_at": now_iso()}
        for s in skills
    ]
    await db.skills.insert_many([dict(s) for s in skill_docs])
    skill_ids = [s["id"] for s in skill_docs]

    # Agents
    agents_raw = [
        ("Sentinel-Alpha", "Analyste sécurité cognitive", "analyst"),
        ("Forge-Optim", "Optimiseur yield & tokenomics", "optimizer"),
        ("Watch-Delta", "Monitoring bridges & liquidité", "monitor"),
        ("Exec-Omega", "Exécuteur de transactions on-chain", "executor"),
        ("Coord-Prime", "Coordinateur multi-agents", "coordinator"),
    ]
    agents = [
        {
            "id": str(uuid.uuid4()),
            "name": name,
            "description": desc,
            "role": role,
            "skills": random.sample(skill_ids, k=min(3, len(skill_ids))),
            "model": "claude_sonnet_4_6",
            "spawn_enabled": role in ("coordinator", "analyst"),
            "max_depth": 3,
            "status": "idle",
            "total_executions": random.randint(5, 120),
            "last_execution": now_iso(),
            "created_at": now_iso(),
        }
        for name, desc, role in agents_raw
    ]
    await db.agents.insert_many([dict(a) for a in agents])

    # Monetary proposals
    proposals = [
        {
            "id": str(uuid.uuid4()),
            "title": "Réduction du taux d'inflation annuel",
            "description": "Passer le taux d'inflation AQ de 2.0% à 1.2% pour renforcer la rareté.",
            "parameter": "INFLATION_RATE",
            "current_value": 2.0,
            "proposed_value": 1.2,
            "unit": "%",
            "status": "active",
            "votes_for": 412,
            "votes_against": 87,
            "votes_for_aq": 1_850_000,
            "votes_against_aq": 220_000,
            "quorum_required": 51,
            "ends_at": (datetime.now(timezone.utc) + timedelta(days=3)).isoformat(),
            "author": "DAO-Core",
            "rationale": "Modèle déflationniste plus robuste en marché baissier.",
            "created_at": now_iso(),
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Augmentation du Burn Rate",
            "description": "Porter le burn rate de 0.5% à 1.0% sur chaque transaction bridge.",
            "parameter": "BURN_RATE",
            "current_value": 0.5,
            "proposed_value": 1.0,
            "unit": "%",
            "status": "pending",
            "votes_for": 120,
            "votes_against": 310,
            "votes_for_aq": 480_000,
            "votes_against_aq": 920_000,
            "quorum_required": 51,
            "ends_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
            "author": "Sentinel-Alpha",
            "rationale": "Accélérer la déflation via les flux cross-chain.",
            "created_at": now_iso(),
        },
    ]
    await db.monetary_proposals.insert_many([dict(p) for p in proposals])

    # Seed a demo knowledge document so RAG has content out of the box.
    aegis_kb = (
        "AEGIS-Q est une plateforme bancaire IA souveraine de niveau militaire. "
        "Le token natif AQ a un supply total de 100 millions, avec une politique "
        "monétaire déflationniste pilotée par la DAO (taux d'inflation cible 1.2%, "
        "burn rate sur chaque bridge cross-chain). Le staking AQ propose trois "
        "tiers: Standard (×1), Premium (×1.5) et Gold (×2). Le Gold requiert un "
        "lock de 12 mois minimum et offre un APY maximal de 18%. "
        "La mémoire fractale N-MEM-B organise les connaissances en cinq niveaux "
        "(L0 racine, L1 entités souveraines, L2 hubs de résonance, L3 factions, "
        "L4 signaux) et cinq tiers (SEALED, DEEP, ACTIVE, SHORT_TERM, DORMANT). "
        "La résonance d'un nœud mesure son activation courante entre 0 et 1. "
        "Un pruning est déclenché automatiquement si la résonance dépasse 90%. "
        "La sécurité est assurée par trois couches: audit IA des smart contracts "
        "via Claude Opus, Zero-Knowledge Proofs (zk-SNARKs) pour les transactions "
        "sensibles, et cryptographie post-quantique (Kyber / Dilithium) pour la "
        "résistance aux attaques quantiques simulées par le module Quantum Attack Sim. "
        "Le bridge cross-chain Lock & Mint relie Ethereum et Solana avec une latence "
        "cible inférieure à 30 secondes et un mécanisme de fraud proofs. "
        "La gouvernance DAO utilise un vote pondéré par montant AQ staké, avec un "
        "quorum requis de 51% et un délai minimal de délibération de 72 heures. "
        "Les agents autonomes (analyst, optimizer, monitor, executor, coordinator) "
        "peuvent spawner d'autres agents jusqu'à une profondeur max configurable "
        "pour éviter les boucles infinies. Chaque exécution est loggée dans "
        "AgentExecution avec métriques tokens_used et execution_time_ms."
    )
    # Chunk it like indexDocument does
    chunk_size, overlap = 500, 100
    chunks = []
    i = 0
    while i < len(aegis_kb):
        piece = aegis_kb[i : i + chunk_size]
        if len(piece.strip()) > 50:
            chunks.append(piece)
        i += chunk_size - overlap
    await db.knowledge_documents.insert_one({
        "id": str(uuid.uuid4()),
        "title": "AEGIS-Q Whitepaper — Synthèse v1",
        "source_type": "text",
        "content": aegis_kb,
        "content_chunks": [{"text": t, "chunk_index": idx} for idx, t in enumerate(chunks)],
        "metadata": {"author": "AEGIS Core", "version": "1.0"},
        "indexed_at": now_iso(),
        "is_indexed": True,
        "chunk_count": len(chunks),
        "created_at": now_iso(),
    })

    logger.info("Seed done: %d nodes, %d events, %d agents, %d skills, 1 KB doc", len(nodes), len(events), len(agents), len(skill_docs))


@app.on_event("startup")
async def on_startup():
    await seed_data()
    # Indexes for scale & retention
    try:
        await db.payment_transactions.create_index("session_id", unique=True)
    except Exception as e:
        logger.warning("payment_transactions unique index: %s", e)
    try:
        # 180 days TTL on analytics_events.created_at — requires BSON datetime, not ISO string
        # Fallback: keep events but no auto-expire (acceptable for now)
        await db.analytics_events.create_index("created_at")
    except Exception as e:
        logger.warning("analytics_events index: %s", e)
    try:
        await db.public_audits.create_index("created_at")
    except Exception as e:
        logger.warning("public_audits index: %s", e)
    logger.info("AEGIS-Q backend ready (indexes ensured)")





# ---------------------------------------------------------------------------
# Analytics — funnel tracking (server-authoritative events + frontend beacons)
# ---------------------------------------------------------------------------
FUNNEL_STAGES = [
    "landing_view",        # visitor hits /
    "public_audit_run",    # someone ran the free audit
    "signup",              # account created
    "brochure_view",       # authenticated user looked at pricing
    "checkout_initiated",  # Stripe session created
    "checkout_paid",       # payment confirmed (webhook OR polling)
]


async def _track(
    event: str,
    session_key: Optional[str] = None,
    user_id: Optional[str] = None,
    properties: Optional[Dict[str, Any]] = None,
):
    """Fire-and-forget event insertion. Safe to await."""
    try:
        await db.analytics_events.insert_one({
            "id": str(uuid.uuid4()),
            "event": event,
            "session_key": session_key,
            "user_id": user_id,
            "properties": properties or {},
            "created_at": now_iso(),
        })
    except Exception as e:
        logger.warning("track event failed: %s", e)


# Simple IP-based rate limiter for /api/analytics/track to prevent funnel pollution.
_TRACK_IP_RATE: Dict[str, List[float]] = {}
_TRACK_RATE_LIMIT = 100          # events per IP per window
_TRACK_RATE_WINDOW = 60          # 1 minute
_TRACK_RATE_LOCK = asyncio.Lock()


async def _check_track_rate(ip: str) -> bool:
    """Return True if allowed, False if rate-limited."""
    now = _time.time()
    async with _TRACK_RATE_LOCK:
        recent = [t for t in _TRACK_IP_RATE.get(ip, []) if t > now - _TRACK_RATE_WINDOW]
        if len(recent) >= _TRACK_RATE_LIMIT:
            _TRACK_IP_RATE[ip] = recent
            return False
        recent.append(now)
        _TRACK_IP_RATE[ip] = recent
        # Cheap pruning every ~1000 calls
        if len(_TRACK_IP_RATE) > 0 and hash(ip) % 1000 == 0:
            stale = [k for k, ts in _TRACK_IP_RATE.items() if not ts or ts[-1] < now - _TRACK_RATE_WINDOW]
            for k in stale:
                _TRACK_IP_RATE.pop(k, None)
        return True


class TrackBody(BaseModel):
    event: str = Field(min_length=1, max_length=80, pattern=r"^[a-z_]+$")
    session_key: Optional[str] = Field(default=None, max_length=80)
    properties: Optional[Dict[str, Any]] = None


# ---------------------------------------------------------------------------
# 🌐 PUBLIC RUCHE DEMO — marketing page (no auth, IP rate-limited)
# ---------------------------------------------------------------------------
_PUBLIC_RUCHE_IP_RATE: Dict[str, List[float]] = {}
_PUBLIC_RUCHE_LOCK = asyncio.Lock()
_PUBLIC_RUCHE_LIMIT = 5          # smart-routes per hour per IP
_PUBLIC_RUCHE_WINDOW = 3600
_PUBLIC_RUCHE_QUERY_MAX = 400


async def _check_public_ruche_rate(ip: str):
    now = _time.time()
    async with _PUBLIC_RUCHE_LOCK:
        recent = [t for t in _PUBLIC_RUCHE_IP_RATE.get(ip, []) if t > now - _PUBLIC_RUCHE_WINDOW]
        if len(recent) >= _PUBLIC_RUCHE_LIMIT:
            _PUBLIC_RUCHE_IP_RATE[ip] = recent
            raise HTTPException(
                status_code=429,
                detail=f"Limite atteinte: {_PUBLIC_RUCHE_LIMIT} démos/heure. Créez un compte pour accéder à la Ruche complète.",
            )
        recent.append(now)
        _PUBLIC_RUCHE_IP_RATE[ip] = recent


_PUBLIC_RUCHE_STATUS_CACHE: Dict[str, Any] = {"ts": 0, "payload": None}
_PUBLIC_RUCHE_STATUS_TTL = 45  # seconds


@api.get("/public/ruche/status")
async def public_ruche_status():
    """Statut public de La Ruche — pas d'auth, pour page marketing.
    Cache 45s pour réduire la pression OpenRouter sur endpoint viral.
    """
    import ruche as _ruche
    now = _time.time()
    cached = _PUBLIC_RUCHE_STATUS_CACHE
    if cached["payload"] and (now - cached["ts"]) < _PUBLIC_RUCHE_STATUS_TTL:
        return cached["payload"]
    if not _ruche.is_ruche_enabled():
        payload = {"enabled": False, "bees": [], "message": "La Ruche n'est pas configurée."}
        _PUBLIC_RUCHE_STATUS_CACHE.update({"ts": now, "payload": payload})
        return payload
    bees = await _ruche.swarm_status()
    enriched = []
    for b in bees:
        meta = _ruche.BEES.get(b.get("role"), {})
        # NOTE: on n'expose PAS 'role' (slug interne). Seul 'label' est publique.
        enriched.append({
            "status": b.get("status"),
            "tier": meta.get("tier"),
            "label": meta.get("label"),
            "icon": meta.get("icon"),
            "specialty": meta.get("role"),
            "budget": meta.get("budget"),
            "is_embedding": meta.get("embedding", False),
        })
    credits = None
    try:
        c = await _ruche.get_credits()
        credits = {"remaining": c.get("remaining")}
    except Exception:
        pass
    payload = {
        "enabled": True,
        "bees": enriched,
        "credits": credits,
        "ts": now_iso(),
    }
    _PUBLIC_RUCHE_STATUS_CACHE.update({"ts": now, "payload": payload})
    return payload


class PublicRucheRouteBody(BaseModel):
    query: str = Field(min_length=3, max_length=_PUBLIC_RUCHE_QUERY_MAX)


@api.post("/public/ruche/smart-route")
async def public_ruche_smart_route(body: PublicRucheRouteBody, request: Request):
    """Démo publique du routage Qwen — pas d'auth, rate-limited par IP."""
    ip = _client_ip(request)
    await _check_public_ruche_rate(ip)
    import ruche as _ruche
    route = await _ruche.smart_route(body.query, top_k=3)
    # N'expose pas les noms techniques internes (grade_fou, mem0_1...), juste le label
    return {
        "label": route.get("label"),
        "specialty": route.get("specialty"),
        "similarity": route.get("similarity"),
        "top": [
            {"label": t.get("label"), "specialty": t.get("specialty"), "similarity": t.get("similarity")}
            for t in route.get("top", [])
        ],
        "remaining_calls": max(0, _PUBLIC_RUCHE_LIMIT - len(_PUBLIC_RUCHE_IP_RATE.get(ip, []))),
    }


_PUBLIC_RUCHE_STATS_CACHE: Dict[str, Any] = {"ts": 0, "payload": None}
_PUBLIC_RUCHE_STATS_TTL = 60
_PUBLIC_RUCHE_RECENT_CACHE: Dict[str, Any] = {"ts": 0, "payload": None}
_PUBLIC_RUCHE_RECENT_TTL = 12  # short pour effet "live"


@api.get("/public/ruche/recent")
async def public_ruche_recent(limit: int = 10):
    """Activité récente anonymisée pour ticker live. Pas de PII (pas de user_id, pas de contenu)."""
    limit = max(1, min(int(limit or 10), 25))
    now = _time.time()
    cached = _PUBLIC_RUCHE_RECENT_CACHE
    if cached["payload"] and (now - cached["ts"]) < _PUBLIC_RUCHE_RECENT_TTL:
        return cached["payload"]

    items: List[Dict[str, Any]] = []
    cursor = db.ruche_usage.find(
        {},
        {"_id": 0, "bee_label": 1, "usecase": 1, "created_at": 1},
    ).sort("created_at", -1).limit(limit)
    async for d in cursor:
        items.append({
            "bee_label": d.get("bee_label"),
            "usecase": d.get("usecase"),
            "created_at": d.get("created_at"),
        })
    payload = {"items": items, "ts": now_iso()}
    _PUBLIC_RUCHE_RECENT_CACHE.update({"ts": now, "payload": payload})
    return payload


@api.get("/public/ruche/stats")
async def public_ruche_stats():
    """Stats collectives anonymisées — aucune PII exposée. Preuve sociale."""
    now = _time.time()
    cached = _PUBLIC_RUCHE_STATS_CACHE
    if cached["payload"] and (now - cached["ts"]) < _PUBLIC_RUCHE_STATS_TTL:
        return cached["payload"]

    from datetime import timedelta
    week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    month_ago = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()

    # Stats all-time + cette semaine + unique users (anonymisé = juste le count)
    pipeline_total = [
        {"$group": {
            "_id": None,
            "total_requests": {"$sum": 1},
            "total_tokens": {"$sum": "$tokens_budget"},
            "unique_users": {"$addToSet": "$user_id"},
        }},
    ]
    totals = {"total_requests": 0, "total_tokens": 0, "unique_users": 0}
    async for row in db.ruche_usage.aggregate(pipeline_total):
        totals["total_requests"] = row["total_requests"]
        totals["total_tokens"] = int(row["total_tokens"] or 0)
        # Filter out None user_ids
        totals["unique_users"] = len([u for u in (row.get("unique_users") or []) if u])

    # By bee (this month, top N)
    pipeline_bee = [
        {"$match": {"created_at": {"$gte": month_ago}}},
        {"$group": {
            "_id": "$bee_role",
            "count": {"$sum": 1},
            "bee_label": {"$last": "$bee_label"},
        }},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    by_bee: List[Dict[str, Any]] = []
    async for row in db.ruche_usage.aggregate(pipeline_bee):
        by_bee.append({
            "bee_label": row.get("bee_label") or row["_id"],
            "count": row["count"],
        })

    # This week snapshot
    pipeline_week = [
        {"$match": {"created_at": {"$gte": week_ago}}},
        {"$group": {
            "_id": None,
            "requests": {"$sum": 1},
            "tokens": {"$sum": "$tokens_budget"},
        }},
    ]
    week = {"requests": 0, "tokens": 0}
    async for row in db.ruche_usage.aggregate(pipeline_week):
        week["requests"] = row["requests"]
        week["tokens"] = int(row["tokens"] or 0)

    baseline_tokens = totals["total_requests"] * _BASELINE_TOKENS_PER_REQ
    tokens_saved = max(0, baseline_tokens - totals["total_tokens"])
    savings_ratio = (tokens_saved / baseline_tokens) if baseline_tokens > 0 else 0.0
    cost_saved = round(tokens_saved / 1000 * _COST_PER_1K_TOKENS_USD, 4)

    payload = {
        "all_time": {
            "total_requests": totals["total_requests"],
            "tokens_saved": tokens_saved,
            "savings_ratio": round(savings_ratio, 4),
            "cost_saved_usd": cost_saved,
            "unique_users": totals["unique_users"],
        },
        "this_week": week,
        "by_bee_30d": by_bee,
        "ts": now_iso(),
    }
    _PUBLIC_RUCHE_STATS_CACHE.update({"ts": now, "payload": payload})
    return payload


@api.get("/public/ruche/card.svg")
async def public_ruche_social_card():
    """Carte sociale Twitter/LinkedIn/OpenGraph pour La Ruche.
    1200x630 SVG. Inclut le compteur live d'abeilles actives (cached).
    """
    from fastapi.responses import Response as _Response
    import ruche as _ruche
    # Try cache first (même cache que /status)
    ok_count = 9
    try:
        cached = _PUBLIC_RUCHE_STATUS_CACHE.get("payload")
        if cached and cached.get("bees"):
            ok_count = sum(1 for b in cached["bees"] if b.get("status") == "ok")
    except Exception:
        pass

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0b0e14"/>
      <stop offset="0.5" stop-color="#0f1420"/>
      <stop offset="1" stop-color="#0b0e14"/>
    </linearGradient>
    <radialGradient id="glow1" cx="0.85" cy="0.15" r="0.5">
      <stop offset="0" stop-color="#60a5fa" stop-opacity="0.25"/>
      <stop offset="1" stop-color="#60a5fa" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0.1" cy="0.9" r="0.5">
      <stop offset="0" stop-color="#8b5cf6" stop-opacity="0.2"/>
      <stop offset="1" stop-color="#8b5cf6" stop-opacity="0"/>
    </radialGradient>
    <pattern id="grid" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
      <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#60a5fa" stroke-width="1" stroke-opacity="0.05"/>
    </pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <rect width="1200" height="630" fill="url(#glow1)"/>
  <rect width="1200" height="630" fill="url(#glow2)"/>

  <!-- Top-left brand -->
  <g transform="translate(72,72)">
    <rect x="0" y="0" width="44" height="44" rx="10" fill="#60a5fa" fill-opacity="0.12" stroke="#60a5fa" stroke-opacity="0.4"/>
    <text x="22" y="29" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-weight="700" font-size="20" fill="#60a5fa">⬡</text>
    <text x="60" y="19" font-family="Inter,Arial,sans-serif" font-weight="700" font-size="16" fill="#f1f5f9" letter-spacing="2">AEGIS-Q</text>
    <text x="60" y="37" font-family="Menlo,monospace" font-size="9" fill="#94a3b8" letter-spacing="3">SOVEREIGN · MILITARY · AI</text>
  </g>

  <!-- Live pill top-right -->
  <g transform="translate(944,80)">
    <rect x="0" y="0" width="184" height="30" rx="15" fill="#60a5fa" fill-opacity="0.1" stroke="#60a5fa" stroke-opacity="0.4"/>
    <circle cx="18" cy="15" r="4" fill="#10b981"/>
    <text x="32" y="20" font-family="Menlo,monospace" font-size="11" fill="#60a5fa" letter-spacing="2">LIVE · HYBRID FEDERATED</text>
  </g>

  <!-- Hero heading -->
  <g transform="translate(72,210)">
    <text font-family="Inter,Arial,sans-serif" font-weight="800" fill="#f1f5f9">
      <tspan x="0" y="0" font-size="84">🐝 La Ruche</tspan>
    </text>
    <text x="0" y="104" font-family="Inter,Arial,sans-serif" font-weight="800" font-size="72" fill="#f1f5f9">
      <tspan fill="#60a5fa">9 IA spécialisées</tspan>,
    </text>
    <text x="0" y="188" font-family="Inter,Arial,sans-serif" font-weight="800" font-size="72" fill="#f1f5f9">1 superviseur Qwen.</text>
  </g>

  <!-- Bottom strip: stats -->
  <g transform="translate(72,500)">
    <rect x="0" y="0" width="1056" height="88" rx="18" fill="#0f1725" stroke="#1e293b"/>

    <g transform="translate(28,22)">
      <text font-family="Menlo,monospace" font-size="11" fill="#94a3b8" letter-spacing="3">ABEILLES ACTIVES</text>
      <text y="34" font-family="Inter,Arial,sans-serif" font-weight="800" font-size="30" fill="#10b981">{ok_count}<tspan fill="#64748b">/9</tspan></text>
    </g>

    <line x1="210" y1="18" x2="210" y2="70" stroke="#1e293b"/>

    <g transform="translate(230,22)">
      <text font-family="Menlo,monospace" font-size="11" fill="#94a3b8" letter-spacing="3">ROUTAGE SÉMANTIQUE</text>
      <text y="34" font-family="Inter,Arial,sans-serif" font-weight="800" font-size="30" fill="#f1f5f9">&lt;3s <tspan fill="#64748b" font-size="18">Qwen3</tspan></text>
    </g>

    <line x1="470" y1="18" x2="470" y2="70" stroke="#1e293b"/>

    <g transform="translate(490,22)">
      <text font-family="Menlo,monospace" font-size="11" fill="#94a3b8" letter-spacing="3">MÉMOIRE FÉDÉRÉE</text>
      <text y="34" font-family="Inter,Arial,sans-serif" font-weight="800" font-size="30" fill="#f1f5f9">N-MEM-B <tspan fill="#64748b" font-size="18">Gemini</tspan></text>
    </g>

    <line x1="770" y1="18" x2="770" y2="70" stroke="#1e293b"/>

    <g transform="translate(790,22)">
      <text font-family="Menlo,monospace" font-size="11" fill="#94a3b8" letter-spacing="3">CTA</text>
      <text y="34" font-family="Inter,Arial,sans-serif" font-weight="700" font-size="22" fill="#60a5fa">→ aegis-q.io/la-ruche</text>
    </g>
  </g>
</svg>"""
    return _Response(
        content=svg,
        media_type="image/svg+xml",
        headers={"Cache-Control": "public, max-age=300, s-maxage=300"},
    )


@api.post("/analytics/track")
async def analytics_track(body: TrackBody, request: Request):
    """Public endpoint — the frontend calls this on landing/brochure view.
    Unauthenticated but rate-limited (100/min/IP) to avoid funnel pollution."""
    ip = _client_ip(request)
    if not await _check_track_rate(ip):
        raise HTTPException(status_code=429, detail="Too many tracking events")
    # Only accept known funnel events to avoid noise / abuse
    if body.event not in FUNNEL_STAGES:
        # Still accept but flag — can be tightened later
        pass
    # Derive a session_key when none provided (from client IP prefix + UA hash)
    sk = body.session_key
    if not sk:
        ip = _client_ip(request)
        ua = request.headers.get("user-agent", "")[:120]
        sk = hashlib.sha256(f"{ip}|{ua}".encode()).hexdigest()[:16]
    # Attach optional Bearer user if present (no error on failure)
    uid = None
    auth_hdr = request.headers.get("authorization") or ""
    if auth_hdr.lower().startswith("bearer "):
        try:
            payload = jwt.decode(auth_hdr.split(" ", 1)[1].strip(), JWT_SECRET, algorithms=[JWT_ALGO])
            uid = payload.get("sub")
        except Exception:
            pass
    await _track(body.event, session_key=sk, user_id=uid, properties=body.properties)
    return {"ok": True, "session_key": sk}


@api.get("/analytics/funnel")
async def analytics_funnel(
    days: int = 30,
    user: Dict[str, Any] = Depends(get_current_user),
):
    """Authenticated dashboard view — funnel counts over the last N days."""
    since = (datetime.now(timezone.utc) - timedelta(days=max(1, min(days, 365)))).isoformat()

    # Count unique users / sessions per funnel stage
    pipeline = [
        {"$match": {"created_at": {"$gte": since}}},
        {
            "$group": {
                "_id": "$event",
                "count": {"$sum": 1},
                "unique_users": {"$addToSet": "$user_id"},
                "unique_sessions": {"$addToSet": "$session_key"},
            }
        },
    ]
    raw = {doc["_id"]: doc async for doc in db.analytics_events.aggregate(pipeline)}

    stages = []
    for stage in FUNNEL_STAGES:
        doc = raw.get(stage, {"count": 0, "unique_users": [], "unique_sessions": []})
        uniq_users = [u for u in doc.get("unique_users", []) if u]
        uniq_sessions = [s for s in doc.get("unique_sessions", []) if s]
        stages.append({
            "stage": stage,
            "count": int(doc.get("count", 0)),
            "unique_users": len(uniq_users),
            "unique_sessions": len(uniq_sessions),
        })

    # Compute conversion ratios between consecutive stages (vs first stage)
    top = stages[0]["unique_sessions"] if stages[0]["unique_sessions"] else 0
    for st in stages:
        st["conversion_from_top_pct"] = (
            round(100.0 * st["unique_sessions"] / top, 2) if top else 0
        )

    # Actual paid revenue proxy
    paid_count = stages[-1]["count"]
    revenue = await db.payment_transactions.aggregate([
        {"$match": {"payment_status": "paid", "updated_at": {"$gte": since}}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}},
    ]).to_list(1)
    total_revenue = float(revenue[0]["total"]) if revenue else 0.0

    return {
        "since": since,
        "days": days,
        "stages": stages,
        "paid_sessions": paid_count,
        "estimated_revenue_usd": round(total_revenue, 2),
    }


# ---------------------------------------------------------------------------
# 🛡️ SENTINEL — Admin-only code source viewer (Code Source Militaire)
# ---------------------------------------------------------------------------
async def require_admin(user: Dict[str, Any] = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Accès admin requis")
    return user


@api.get("/admin/sentinel/codes")
async def sentinel_list_codes(
    limit: int = 50,
    severity: Optional[str] = None,
    user: Dict[str, Any] = Depends(require_admin),
):
    """Liste tous les codes sources soumis pour audit. Admin uniquement.
    Inclut le code source complet, l'IP, l'owner — données invisibles aux autres users.
    """
    limit = max(1, min(int(limit or 50), 200))
    items: List[Dict[str, Any]] = []
    cursor = db.public_audits.find({}, {"_id": 0}).sort("created_at", -1).limit(limit)
    async for d in cursor:
        result = d.get("result") or {}
        items.append({
            "audit_id": d.get("id"),
            "contract_name": d.get("contract_name"),
            "code": d.get("code"),  # Visible UNIQUEMENT en mode admin (cet endpoint)
            "code_hash": d.get("code_hash"),
            "ip_full": d.get("ip_full"),
            "ip_prefix": d.get("ip_prefix"),
            "owner_id": d.get("owner_id"),
            "owner_tier": d.get("owner_tier"),
            "score": d.get("score") or result.get("score_securite"),
            "severity_max": _max_severity(result.get("vulnerabilites") or []),
            "vulnerabilities_count": len(result.get("vulnerabilites") or []),
            "vulnerabilities": result.get("vulnerabilites") or [],
            "summary": result.get("resume"),
            "created_at": d.get("created_at"),
        })
    if severity:
        sev = severity.upper()
        items = [it for it in items if it.get("severity_max") == sev]
    return {"count": len(items), "items": items[:limit]}


@api.get("/admin/sentinel/code/{audit_id}")
async def sentinel_view_code(
    audit_id: str,
    user: Dict[str, Any] = Depends(require_admin),
):
    """Détail complet d'un audit incluant le code source. Admin uniquement."""
    d = await db.public_audits.find_one({"id": audit_id}, {"_id": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Audit introuvable")
    return d


def _max_severity(vulns: List[Dict[str, Any]]) -> Optional[str]:
    order = {"CRITIQUE": 4, "ÉLEVÉE": 3, "ELEVEE": 3, "MOYENNE": 2, "FAIBLE": 1, "INFO": 0}
    if not vulns:
        return None
    best = None
    best_v = -1
    for v in vulns:
        s = (v.get("severite") or "").upper()
        val = order.get(s, 0)
        if val > best_v:
            best_v = val
            best = s
    return best


# ---------------------------------------------------------------------------
# 📈 TRADING — Portfolio simulé + Signaux IA DeepSeek
# ---------------------------------------------------------------------------
TRADING_INITIAL_BALANCE_USD = 10000.0
TRADING_FEE_BPS = 10  # 0.10% de frais simulés


async def _get_or_init_portfolio(user_id: str) -> Dict[str, Any]:
    p = await db.portfolios.find_one({"user_id": user_id}, {"_id": 0})
    if p:
        return p
    p = {
        "user_id": user_id,
        "balance_usd": TRADING_INITIAL_BALANCE_USD,
        "holdings": {},  # {coin_id: qty}
        "created_at": now_iso(),
    }
    await db.portfolios.insert_one(dict(p))
    p.pop("_id", None)
    return p


async def _get_coin_price(coin_id: str) -> float:
    coins = await _fetch_coingecko()
    for c in coins:
        if c["id"] == coin_id:
            return float(c.get("current_price") or 0)
    raise HTTPException(status_code=404, detail=f"Coin '{coin_id}' indisponible")


@api.get("/trading/portfolio")
async def trading_portfolio(user: Dict[str, Any] = Depends(get_current_user)):
    p = await _get_or_init_portfolio(user["id"])
    coins = await _fetch_coingecko()
    price_map = {c["id"]: c for c in coins}
    holdings = []
    holdings_value = 0.0
    for coin_id, qty in (p.get("holdings") or {}).items():
        c = price_map.get(coin_id) or {}
        price = float(c.get("current_price") or 0)
        value = qty * price
        holdings_value += value
        holdings.append({
            "coin_id": coin_id,
            "symbol": (c.get("symbol") or coin_id).upper(),
            "name": c.get("name") or coin_id,
            "qty": qty,
            "current_price": price,
            "value_usd": round(value, 2),
            "change_24h": c.get("price_change_percentage_24h"),
        })
    total = round(p["balance_usd"] + holdings_value, 2)
    return {
        "balance_usd": round(p["balance_usd"], 2),
        "holdings_value_usd": round(holdings_value, 2),
        "total_value_usd": total,
        "pnl_usd": round(total - TRADING_INITIAL_BALANCE_USD, 2),
        "pnl_pct": round((total - TRADING_INITIAL_BALANCE_USD) / TRADING_INITIAL_BALANCE_USD * 100, 2),
        "holdings": sorted(holdings, key=lambda x: -x["value_usd"]),
    }


class TradeBody(BaseModel):
    coin_id: str = Field(min_length=1, max_length=40)
    side: str = Field(pattern=r"^(buy|sell)$")
    amount_usd: Optional[float] = None  # for buy
    qty: Optional[float] = None         # for sell


@api.post("/trading/trade")
async def trading_trade(body: TradeBody, user: Dict[str, Any] = Depends(get_current_user)):
    p = await _get_or_init_portfolio(user["id"])
    price = await _get_coin_price(body.coin_id)
    holdings = dict(p.get("holdings") or {})
    fee_rate = TRADING_FEE_BPS / 10000.0

    if body.side == "buy":
        if body.amount_usd is None or body.amount_usd <= 0:
            raise HTTPException(status_code=400, detail="amount_usd requis (>0)")
        cost = float(body.amount_usd) * (1 + fee_rate)
        if cost > p["balance_usd"]:
            raise HTTPException(status_code=400, detail="Solde insuffisant")
        qty = float(body.amount_usd) / price
        new_balance = p["balance_usd"] - cost
        holdings[body.coin_id] = (holdings.get(body.coin_id, 0)) + qty
        executed_qty = qty
        executed_usd = float(body.amount_usd)
    else:  # sell
        if body.qty is None or body.qty <= 0:
            raise HTTPException(status_code=400, detail="qty requis (>0)")
        held = float(holdings.get(body.coin_id, 0))
        if body.qty > held + 1e-9:
            raise HTTPException(status_code=400, detail="Quantité détenue insuffisante")
        gross = float(body.qty) * price
        net = gross * (1 - fee_rate)
        new_balance = p["balance_usd"] + net
        holdings[body.coin_id] = held - float(body.qty)
        if holdings[body.coin_id] < 1e-9:
            del holdings[body.coin_id]
        executed_qty = float(body.qty)
        executed_usd = round(net, 2)

    await db.portfolios.update_one(
        {"user_id": user["id"]},
        {"$set": {"balance_usd": new_balance, "holdings": holdings}},
    )
    trade = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "coin_id": body.coin_id,
        "side": body.side,
        "qty": executed_qty,
        "price": price,
        "amount_usd": executed_usd,
        "fee_bps": TRADING_FEE_BPS,
        "created_at": now_iso(),
    }
    await db.trades.insert_one(dict(trade))
    trade.pop("_id", None)
    return {"ok": True, "trade": trade, "balance_usd": round(new_balance, 2)}


@api.get("/trading/history")
async def trading_history(limit: int = 30, user: Dict[str, Any] = Depends(get_current_user)):
    limit = max(1, min(int(limit or 30), 200))
    cursor = db.trades.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).limit(limit)
    items = [d async for d in cursor]
    return {"count": len(items), "items": items}


_TRADING_SIGNALS_CACHE: Dict[str, Any] = {"ts": 0, "payload": None}
_TRADING_SIGNALS_TTL = 300  # 5 min cache to save tokens


@api.get("/trading/signals")
async def trading_signals(user: Dict[str, Any] = Depends(get_current_user)):
    """Signaux Buy/Sell/Hold générés par DeepSeek R1 (raisonnement financier)."""
    now = _time.time()
    cached = _TRADING_SIGNALS_CACHE
    if cached["payload"] and (now - cached["ts"]) < _TRADING_SIGNALS_TTL:
        return cached["payload"]

    coins = await _fetch_coingecko()
    top = coins[:5]
    market_summary = "\n".join(
        f"- {c['symbol'].upper()} ({c['name']}): ${c['current_price']:.2f} ({c.get('price_change_percentage_24h') or 0:+.2f}% 24h)"
        for c in top
    )
    system = (
        "Tu es DeepSeek R1, l'abeille raisonnement-finance d'AEGIS-Q. "
        "Tu produis des signaux courts en français STRICTEMENT au format JSON. "
        "Aucun texte hors JSON."
    )
    prompt = (
        f"Analyse ce snapshot marché crypto et génère un signal pour chaque coin :\n\n{market_summary}\n\n"
        "Réponds avec un JSON: {\"signals\": [{\"symbol\":\"BTC\",\"action\":\"BUY|HOLD|SELL\",\"confidence\":0-100,\"reason\":\"...\"}]}. "
        "Ne réponds que par le JSON, rien d'autre."
    )
    raw = await llm_chat(
        session_id=f"signals-{user['id']}",
        system_prompt=system,
        messages=[{"role": "user", "content": prompt}],
        usecase="staking_advisor",  # routes to DeepSeek R1
        user_id=user["id"],
    )
    # Parse JSON tolérant
    import re as _re
    import json as _json
    parsed = None
    if raw:
        m = _re.search(r"\{[\s\S]*\}", raw)
        if m:
            try:
                parsed = _json.loads(m.group(0))
            except Exception:
                parsed = None
    signals = (parsed or {}).get("signals") if isinstance(parsed, dict) else None
    if not isinstance(signals, list):
        signals = [
            {"symbol": c["symbol"].upper(), "action": "HOLD", "confidence": 50, "reason": "Analyse indisponible"}
            for c in top
        ]
    payload = {"signals": signals, "generated_at": now_iso(), "model": "DeepSeek R1"}
    _TRADING_SIGNALS_CACHE.update({"ts": now, "payload": payload})
    return payload


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
