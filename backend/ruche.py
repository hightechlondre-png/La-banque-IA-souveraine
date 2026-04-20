"""
🐝 LA RUCHE — Hybrid Federated Cognitive AI Swarm
=================================================
9 abeilles spécialisées, router Qwen (superviseur), Gemini reine (N-MEM-B).
Philosophie : BEAUCOUP d'IA spécialisées, PEU de tokens par abeille.
Chaque abeille a un rôle cognitif distinct + un budget tokens frugal.
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

# 9 abeilles — slugs OpenRouter VALIDÉS (probe 2026-02)
# `budget` = max_tokens par défaut (frugalité cognitive, rôle-spécifique)
BEES: Dict[str, Dict[str, Any]] = {
    "grade_fou":   {"model": "mistralai/mistral-large",                "label": "Mistral Large",       "icon": "🎖️", "tier": "paid", "role": "Commandant stratégique — décisions haut niveau", "budget": 800},
    "llm1":        {"model": "meta-llama/llama-4-maverick",            "label": "Llama 4 Maverick",    "icon": "⚡",  "tier": "paid", "role": "Audit smart-contracts & code — raisonnement technique", "budget": 1000},
    "llm2":        {"model": "deepseek/deepseek-r1",                   "label": "DeepSeek R1",         "icon": "🧮",  "tier": "paid", "role": "Raisonnement mathématique & finance — staking, APY, risk", "budget": 900},
    "memoire1":    {"model": "google/gemma-4-31b-it",                  "label": "Gemma 4 31B",         "icon": "💭",  "tier": "paid", "role": "Mémoire contextuelle longue — condensation", "budget": 600},
    "memoire2":    {"model": "minimax/minimax-m2.5:free",              "label": "MiniMax M2.5",        "icon": "💭",  "tier": "free", "role": "Mémoire secondaire rapide — faible latence", "budget": 500},
    "mem0_1":      {"model": "nvidia/nemotron-3-super-120b-a12b:free", "label": "Nemotron Super 120B", "icon": "🧠",  "tier": "free", "role": "Orchestrateur d'agents — planification multi-étapes", "budget": 700},
    "mem0_2":      {"model": "nvidia/nemotron-3-nano-30b-a3b:free",    "label": "Nemotron Nano 30B",   "icon": "🧠",  "tier": "free", "role": "Tests de compétences — QA rapide, classification", "budget": 400},
    "superviseur": {"model": "qwen/qwen3-embedding-8b",                "label": "Qwen3 Embedding 8B",  "icon": "🎯",  "tier": "paid", "role": "Routeur sémantique — sélection de l'abeille optimale", "embedding": True},
    "reine":       {"model": "google/gemini-embedding-2-preview",      "label": "Gemini Embedding 2",  "icon": "👑",  "tier": "paid", "role": "Reine N-MEM-B — mémoire long-terme fédérée", "embedding": True},
}

# Routing AEGIS-Q usecases → bee role (primary) + fallback chain
# Stratégie : modèle payant spécialisé → abeilles gratuites en cascade
USECASE_ROUTING: Dict[str, Dict[str, Any]] = {
    "cognitive_chat":  {"primary": "grade_fou", "fallback": ["mem0_1", "memoire2", "mem0_2", "llm2"]},
    "agent_orchestr":  {"primary": "mem0_1",    "fallback": ["grade_fou", "memoire2", "mem0_2"]},
    "staking_advisor": {"primary": "llm2",      "fallback": ["grade_fou", "mem0_1", "memoire2"]},
    "contract_audit":  {"primary": "llm1",      "fallback": ["grade_fou", "llm2", "mem0_1"]},
    "skill_test":      {"primary": "mem0_2",    "fallback": ["memoire2", "mem0_1", "grade_fou"]},
    "memory_condense": {"primary": "memoire1",  "fallback": ["memoire2", "mem0_1", "mem0_2"]},
    "generic":         {"primary": "grade_fou", "fallback": ["mem0_1", "memoire2", "mem0_2", "llm2"]},
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
    max_tokens: Optional[int] = None,
    temperature: float = 0.7,
) -> str:
    bee = BEES.get(role)
    if not bee:
        raise ValueError(f"Unknown bee role: {role}")
    if bee.get("embedding"):
        raise ValueError(f"Role '{role}' is an embedding model, use embed() instead")

    # Frugalité : si pas de max_tokens fourni, utiliser le budget spécialisé du rôle
    effective_max = max_tokens if max_tokens is not None else bee.get("budget", 800)

    msgs = list(messages)
    if system_prompt:
        msgs = [{"role": "system", "content": system_prompt}] + msgs

    payload = {
        "model": bee["model"],
        "messages": msgs,
        "max_tokens": effective_max,
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
        # Reasoning models peuvent brûler tout leur budget en raisonnement caché.
        # Augmente le budget et retry une fois si ça arrive.
        retry_payload = dict(payload)
        retry_payload["max_tokens"] = max(effective_max * 2, 1500)
        async with httpx.AsyncClient(timeout=60.0) as client:
            r2 = await client.post(f"{OPENROUTER_BASE}/chat/completions", headers=_headers(), json=retry_payload)
            if r2.status_code < 400:
                d2 = r2.json()
                content = d2.get("choices", [{}])[0].get("message", {}).get("content") or ""
    if not content.strip():
        raise RuntimeError(f"{role} returned empty content after retry")
    return content


async def call_usecase(
    usecase: str,
    messages: List[Dict[str, Any]],
    system_prompt: Optional[str] = None,
    max_tokens: Optional[int] = None,
    temperature: float = 0.7,
) -> Dict[str, Any]:
    """High-level entry: route a usecase to the right bee + auto-fallback."""
    route = USECASE_ROUTING.get(usecase, USECASE_ROUTING["generic"])
    chain = [route["primary"]] + [r for r in route["fallback"] if r != route["primary"]]
    tried: List[Dict[str, str]] = []
    for role in chain:
        try:
            content = await call_bee(role, messages, system_prompt=system_prompt, max_tokens=max_tokens, temperature=temperature)
            return {
                "content": content,
                "bee_used": role,
                "bee_label": BEES[role]["label"],
                "bee_role": BEES[role].get("role", ""),
                "attempts": tried + [{"role": role, "status": "ok"}],
            }
        except Exception as e:
            tried.append({"role": role, "status": "error", "reason": str(e)[:150]})
            continue
    return {"content": None, "bee_used": None, "bee_label": None, "attempts": tried, "error": "all_bees_failed"}


async def probe_bee(role: str) -> Dict[str, Any]:
    """Ping a single bee. Tolerant: reasoning models (DeepSeek R1, Nemotron) may
    burn their budget on hidden reasoning tokens and return empty visible text —
    this is NOT a failure as long as HTTP 200 was returned."""
    if BEES[role].get("embedding"):
        try:
            _ = await embed("ping", queen=(role == "reine"))
            return {"role": role, "status": "ok", "tier": BEES[role]["tier"]}
        except Exception as e:
            return {"role": role, "status": "error", "reason": str(e)[:200], "tier": BEES[role]["tier"]}
    payload = {
        "model": BEES[role]["model"],
        "messages": [{"role": "user", "content": "Reply with the single word: OK"}],
        "max_tokens": 256,
        "temperature": 0,
    }
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            r = await client.post(f"{OPENROUTER_BASE}/chat/completions", headers=_headers(), json=payload)
        if r.status_code >= 400:
            reason = r.text[:200]
            code = "rate_limited" if r.status_code == 429 else (
                   "no_credits" if r.status_code == 402 else
                   "unavailable" if r.status_code == 404 else "error")
            return {"role": role, "status": code, "reason": reason, "tier": BEES[role]["tier"]}
        # HTTP 200 → reachable, even if content empty (reasoning-only response)
        return {"role": role, "status": "ok", "tier": BEES[role]["tier"]}
    except Exception as e:
        return {"role": role, "status": "error", "reason": str(e)[:200], "tier": BEES[role]["tier"]}


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


async def get_credits() -> Dict[str, Any]:
    """Retourne le solde OpenRouter pour affichage dans /ruche-monitor."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        r = await client.get(f"{OPENROUTER_BASE}/credits", headers=_headers())
        r.raise_for_status()
        d = r.json().get("data", {})
    total = float(d.get("total_credits", 0))
    used = float(d.get("total_usage", 0))
    return {"total": total, "used": used, "remaining": round(total - used, 4)}
