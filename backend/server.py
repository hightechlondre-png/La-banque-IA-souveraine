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
# Function: retrieveContext (simple RAG)
# ---------------------------------------------------------------------------
def _simple_hash(s: str) -> int:
    h = 0
    for ch in s:
        h = ((h << 5) - h) + ord(ch)
        h = h & 0xFFFFFFFF
    return abs(h)


def _generate_embedding(text: str) -> List[float]:
    tokens = text.lower().split()
    emb = [0.0] * 128
    for tok in tokens:
        hv = _simple_hash(tok)
        for j in range(128):
            emb[j] += (hv ^ j) / 1000.0
    norm = math.sqrt(sum(v * v for v in emb))
    return [v / norm for v in emb] if norm > 0 else emb


def _cosine(a: List[float], b: List[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    return dot / (na * nb) if na and nb else 0.0


async def fn_retrieve_context(body: Dict[str, Any], user: Dict[str, Any]) -> Dict[str, Any]:
    query = body.get("query")
    top_k = body.get("top_k", 5)
    if not query:
        raise HTTPException(status_code=400, detail="Query required")

    docs = [d async for d in _collection("KnowledgeDocument").find({}, {"_id": 0}).limit(100)]
    q_emb = _generate_embedding(query)
    results = []
    for doc in docs:
        for chunk in doc.get("content_chunks", []) or []:
            if not chunk.get("embedding"):
                continue
            sim = _cosine(q_emb, chunk["embedding"])
            results.append({
                "text": chunk.get("text", ""),
                "similarity": sim,
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

    content_chunks = [
        {"text": t, "embedding": _generate_embedding(t), "chunk_index": idx}
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
    current_price = body.get("current_price", 2.15)
    alerts_col = _collection("UserPriceAlert")
    alerts = [a async for a in alerts_col.find({"enabled": True}, {"_id": 0})]
    if not alerts:
        return {"message": "No alerts configured", "checked": 0, "alerts_sent": 0, "current_price": current_price}

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
    }


# ---------------------------------------------------------------------------
# Function dispatcher
# ---------------------------------------------------------------------------
FUNCTIONS = {
    "gemmaChat": fn_gemma_chat,
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

    logger.info("Seed done: %d nodes, %d events, %d agents, %d skills", len(nodes), len(events), len(agents), len(skill_docs))


@app.on_event("startup")
async def on_startup():
    await seed_data()


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
