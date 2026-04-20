"""
🐝 LA RUCHE — Hybrid Federated Cognitive AI Swarm
=================================================
9 abeilles spécialisées, router Qwen (superviseur), Gemini reine (N-MEM-B).
Fallback Claude Opus 4.5 via Emergent LLM si une abeille payante manque de crédits.
"""
from __future__ import annotations
import os
import logging
from typing import Any, Dict, List, Optional
import httpx

logger = logging.getLogger("ruche")

OPENROUTER_BASE = "https://openrouter.ai/api/v1"
OPENROUTER_KEY = os.environ.get("OPENROUTER_API_KEY", "")
SITE_URL = os.environ.get("OPENROUTER_SITE_URL", "https://aegis-q.io")
SITE_NAME = os.environ.get("OPENROUTER_SITE_NAME", "AEGIS-Q")

# Slug canoniques (OpenRouter). `free_tier=True` = pas de crédit nécessaire.
BEES: Dict[str, Dict[str, Any]] = {
    "grade_fou":   {"model": "mistralai/mistral-large",               "label": "Mistral Large",         "icon": "🎖️", "tier": "paid"},
    "llm1":        {"model": "meta-llama/llama-4-maverick",           "label": "Llama 4 Maverick",      "icon": "⚡", "tier": "paid"},
    "llm2":        {"model": "deepseek/deepseek-r1:free",             "label": "DeepSeek R1",           "icon": "⚡", "tier": "free"},
    "memoire1":    {"model": "google/gemma-4-31b-it",                 "label": "Gemma 4 31B",           "icon": "💭", "tier": "paid"},
    "memoire2":    {"model": "minimax/minimax-m2.5:free",             "label": "MiniMax M2.5",          "icon": "💭", "tier": "free"},
    "mem0_1":      {"model": "nvidia/nemotron-3-super-120b-a12b:free","label": "Nemotron Super 120B",   "icon": "🧠", "tier": "free"},
    "mem0_2":      {"model": "nvidia/nemotron-3-nano-30b-a3b:free",   "label": "Nemotron Nano 30B",     "icon": "🧠", "tier": "free"},
    "superviseur": {"model": "qwen/qwen3-embedding-8b",               "label": "Qwen3 Embedding 8B",    "icon": "🎯", "tier": "paid", "embedding": True},
    "reine":       {"model": "google/gemini-embedding-2-preview",     "label": "Gemini Embedding 2",    "icon": "👑", "tier": "paid", "embedding": True},
}

# Routing AEGIS-Q usecases → bee role (primary) + fallback chain
USECASE_ROUTING: Dict[str, Dict[str, Any]] = {
    "cognitive_chat":  {"primary": "grade_fou", "fallback": ["mem0_1", "llm2", "mem0_2", "memoire2"]},
    "agent_orchestr":  {"primary": "mem0_1",    "fallback": ["llm2", "mem0_2", "grade_fou"]},
    "staking_advisor": {"primary": "llm2",      "fallback": ["mem0_1", "mem0_2", "grade_fou"]},
    "contract_audit":  {"primary": "llm1",      "fallback": ["grade_fou", "mem0_1", "llm2"]},
    "skill_test":      {"primary": "mem0_2",    "fallback": ["mem0_1", "llm2", "grade_fou"]},
    "generic":         {"primary": "grade_fou", "fallback": ["mem0_1", "llm2", "mem0_2"]},
}


def is_ruche_enabled() -> bool:
    return bool(OPENROUTER_KEY) and os.environ.get("LLM_BACKEND", "ruche") == "ruche"


def _headers() -> Dict[str, str]:
    return {
        "Authorization": f"Bearer {OPENROUTER_KEY}",
        "HTTP-Referer": SITE_URL,
        "X-Title": SITE_NAME,
        "Content-Type": "application/json",
    }


async def call_bee(
    role: str,
    messages: List[Dict[str, Any]],
    system_prompt: Optional[str] = None,
    max_tokens: int = 1500,
    temperature: float = 0.7,
) -> str:
    bee = BEES.get(role)
    if not bee:
        raise ValueError(f"Unknown bee role: {role}")
    if bee.get("embedding"):
        raise ValueError(f"Role '{role}' is an embedding model, use embed() instead")

    msgs = list(messages)
    if system_prompt:
        msgs = [{"role": "system", "content": system_prompt}] + msgs

    payload = {
        "model": bee["model"],
        "messages": msgs,
        "max_tokens": max_tokens,
        "temperature": temperature,
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        r = await client.post(f"{OPENROUTER_BASE}/chat/completions", headers=_headers(), json=payload)
        if r.status_code >= 400:
            err_body = r.text[:300]
            logger.warning("Bee %s HTTP %s: %s", role, r.status_code, err_body)
            raise RuntimeError(f"{role} {r.status_code}: {err_body}")
        data = r.json()
    content = data.get("choices", [{}])[0].get("message", {}).get("content") or ""
    if not content.strip():
        raise RuntimeError(f"{role} returned empty content")
    return content


async def call_usecase(
    usecase: str,
    messages: List[Dict[str, Any]],
    system_prompt: Optional[str] = None,
    max_tokens: int = 1500,
    temperature: float = 0.7,
) -> Dict[str, Any]:
    """High-level entry: route a usecase to the right bee + auto-fallback."""
    route = USECASE_ROUTING.get(usecase, USECASE_ROUTING["generic"])
    chain = [route["primary"]] + [r for r in route["fallback"] if r != route["primary"]]
    tried: List[Dict[str, str]] = []
    for role in chain:
        try:
            content = await call_bee(role, messages, system_prompt=system_prompt, max_tokens=max_tokens, temperature=temperature)
            return {"content": content, "bee_used": role, "bee_label": BEES[role]["label"], "attempts": tried + [{"role": role, "status": "ok"}]}
        except Exception as e:
            tried.append({"role": role, "status": "error", "reason": str(e)[:150]})
            continue
    return {"content": None, "bee_used": None, "bee_label": None, "attempts": tried, "error": "all_bees_failed"}


async def probe_bee(role: str) -> Dict[str, Any]:
    """Ping a single bee with a tiny request to check availability."""
    if BEES[role].get("embedding"):
        try:
            _ = await embed("ping", queen=(role == "reine"))
            return {"role": role, "status": "ok", "tier": BEES[role]["tier"]}
        except Exception as e:
            return {"role": role, "status": "error", "reason": str(e)[:200], "tier": BEES[role]["tier"]}
    try:
        _ = await call_bee(role, [{"role": "user", "content": "Say OK"}], max_tokens=10)
        return {"role": role, "status": "ok", "tier": BEES[role]["tier"]}
    except Exception as e:
        reason = str(e)
        code = "rate_limited" if "429" in reason else (
               "no_credits" if "402" in reason or "Insufficient credits" in reason else
               "unavailable" if "404" in reason else "error")
        return {"role": role, "status": code, "reason": reason[:200], "tier": BEES[role]["tier"]}


async def swarm_status() -> List[Dict[str, Any]]:
    """Probe all bees concurrently. Returns the health of each."""
    import asyncio
    tasks = [probe_bee(role) for role in BEES.keys()]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return [
        r if isinstance(r, dict) else {"role": "unknown", "status": "exception", "reason": str(r)[:200]}
        for r in results
    ]


async def embed(text: str, queen: bool = False) -> List[float]:
    role = "reine" if queen else "superviseur"
    bee = BEES[role]
    payload = {"model": bee["model"], "input": text, "encoding_format": "float"}
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.post(f"{OPENROUTER_BASE}/embeddings", headers=_headers(), json=payload)
        r.raise_for_status()
        data = r.json()
    return data["data"][0]["embedding"]
