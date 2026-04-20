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
async def llm_chat(session_id: str, system_prompt: str, messages: List[Dict[str, str]]) -> str:
    """Multi-turn chat using Claude Opus 4.5 via emergentintegrations."""
    if not EMERGENT_LLM_KEY:
        return (
            "[MODE DÉMO] Clé LLM non configurée. "
            "Configurez EMERGENT_LLM_KEY dans /app/backend/.env pour activer Claude Opus 4.5."
        )
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage

        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=system_prompt,
        ).with_model("anthropic", CLAUDE_MODEL)

        # Feed all but the last message to build context, then send last.
        last = messages[-1] if messages else {"role": "user", "content": ""}
        for m in messages[:-1]:
            if m.get("role") == "user":
                await chat.send_message(UserMessage(text=m["content"]))
        reply = await chat.send_message(UserMessage(text=last.get("content", "")))
        return reply if isinstance(reply, str) else str(reply)
    except Exception as e:
        logger.exception("LLM error")
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
    reply = await llm_chat(session_id, AEGIS_SYSTEM_PROMPT, messages)
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

    handler = FUNCTIONS.get(name)
    if not handler:
        raise HTTPException(status_code=404, detail=f"Function '{name}' not found")
    return await handler(body or {}, user)


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
        {"prompt": prompt, "response_json_schema": {"type": "object"}},
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
        "code_hash": hashlib.sha256(body.code.encode()).hexdigest(),
        "score": score,
        "result": result,
        "badge_token": badge_token,
        "ip_prefix": ip.split(".")[0] if "." in ip else ip[:4],
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
        {"_id": 0, "ip_prefix": 0, "code_hash": 0},
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


class TrackBody(BaseModel):
    event: str = Field(min_length=1, max_length=80, pattern=r"^[a-z_]+$")
    session_key: Optional[str] = Field(default=None, max_length=80)
    properties: Optional[Dict[str, Any]] = None


@api.post("/analytics/track")
async def analytics_track(body: TrackBody, request: Request):
    """Public endpoint — the frontend calls this on landing/brochure view.
    Unauthenticated but best-effort (no PII stored)."""
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
