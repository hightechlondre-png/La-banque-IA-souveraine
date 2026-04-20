"""
Iteration 7 — La Ruche (9 abeilles OpenRouter) backend tests.
Couvre: /api/ruche/status (enabled, 9 bees ok, credits, métadonnées),
/api/ruche/test (4 usecases routing + fallback),
/api/functions/invoke/gemmaChat (Ruche-backed cognitive chat),
/api/market/staking-advice (DeepSeek R1 via Ruche).
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://hybrid-federated-ia.preview.emergentagent.com").rstrip("/")
DEMO_EMAIL = "demo@aegis-q.mil"
DEMO_PASS = "Aegis2026!"

EXPECTED_BEES = {
    "grade_fou", "llm1", "llm2", "memoire1", "memoire2",
    "mem0_1", "mem0_2", "superviseur", "reine",
}
EMBEDDING_ROLES = {"superviseur", "reine"}


@pytest.fixture(scope="module")
def token():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": DEMO_EMAIL, "password": DEMO_PASS},
        timeout=20,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    tok = r.json().get("access_token")
    assert tok, "no access_token in login response"
    return tok


@pytest.fixture(scope="module")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ------------------------------------------------------------------
# /api/ruche/status — health + métadonnées + crédits
# ------------------------------------------------------------------
class TestRucheStatus:
    def test_status_enabled_and_9_bees_ok(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/ruche/status", headers=auth_headers, timeout=90)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["enabled"] is True
        bees = data["bees"]
        assert len(bees) == 9, f"expected 9 bees, got {len(bees)}"
        roles = {b["role"] for b in bees}
        assert roles == EXPECTED_BEES, f"missing/unexpected roles: {roles ^ EXPECTED_BEES}"
        for b in bees:
            assert b["status"] == "ok", f"bee {b['role']} not ok: {b}"

    def test_status_each_bee_metadata(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/ruche/status", headers=auth_headers, timeout=90)
        assert r.status_code == 200
        for b in r.json()["bees"]:
            for field in ("role", "status", "tier", "label", "icon", "model", "specialty", "is_embedding"):
                assert field in b, f"bee {b.get('role')} missing field {field}"
            assert b["tier"] in ("paid", "free")
            assert isinstance(b["is_embedding"], bool)
            if b["role"] in EMBEDDING_ROLES:
                assert b["is_embedding"] is True
                assert b["budget"] is None, f"embedding bee {b['role']} should have null budget"
            else:
                assert b["is_embedding"] is False
                assert isinstance(b["budget"], int) and b["budget"] > 0

    def test_status_credits_object(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/ruche/status", headers=auth_headers, timeout=90)
        assert r.status_code == 200
        credits = r.json().get("credits")
        assert credits is not None, "credits object missing"
        for k in ("total", "used", "remaining"):
            assert k in credits
            assert isinstance(credits[k], (int, float))
        assert credits["remaining"] == pytest.approx(credits["total"] - credits["used"], abs=0.01)

    def test_status_usecases_routing_table(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/ruche/status", headers=auth_headers, timeout=90)
        assert r.status_code == 200
        uc = r.json().get("usecases", {})
        for name in ("cognitive_chat", "contract_audit", "staking_advisor", "memory_condense", "generic"):
            assert name in uc, f"usecase {name} missing"
            assert "primary" in uc[name] and "fallback" in uc[name]

    def test_status_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/ruche/status", timeout=15)
        assert r.status_code in (401, 403)


# ------------------------------------------------------------------
# /api/ruche/test — usecase routing
# ------------------------------------------------------------------
class TestRucheUsecases:
    def _invoke(self, headers, usecase, query=None):
        body = {"usecase": usecase}
        if query:
            body["query"] = query
        return requests.post(
            f"{BASE_URL}/api/ruche/test", headers=headers, json=body, timeout=120,
        )

    def test_cognitive_chat_routes_to_grade_fou(self, auth_headers):
        r = self._invoke(auth_headers, "cognitive_chat", "Dis OK en un mot.")
        assert r.status_code == 200, r.text
        d = r.json()
        # bee_used can be primary or fallback; primary expected when bee is healthy
        assert d.get("content"), f"empty content: {d}"
        # Must have used SOME bee (primary preferred)
        assert d.get("bee_used") in EXPECTED_BEES - EMBEDDING_ROLES
        # If primary worked, it should be grade_fou
        attempts = d.get("attempts", [])
        first = attempts[0] if attempts else {}
        assert first.get("role") == "grade_fou", f"primary should be grade_fou, got {first}"

    def test_contract_audit_routes_to_llm1(self, auth_headers):
        r = self._invoke(auth_headers, "contract_audit", "Audit en 1 phrase: function transfer(...)")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("content"), f"empty content: {d}"
        attempts = d.get("attempts", [])
        assert attempts and attempts[0].get("role") == "llm1"

    def test_staking_advisor_routes_to_llm2(self, auth_headers):
        r = self._invoke(auth_headers, "staking_advisor", "1000 AQ, 90 jours, risque moyen — APY?")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("content"), f"empty content: {d}"
        attempts = d.get("attempts", [])
        assert attempts and attempts[0].get("role") == "llm2"

    def test_memory_condense_routes_to_memoire1(self, auth_headers):
        r = self._invoke(auth_headers, "memory_condense", "Condense: l'utilisateur veut staker 1000 AQ.")
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("content"), f"empty content: {d}"
        attempts = d.get("attempts", [])
        assert attempts and attempts[0].get("role") == "memoire1"


# ------------------------------------------------------------------
# /api/functions/invoke/gemmaChat — chat cognitif via Ruche
# ------------------------------------------------------------------
class TestGemmaChat:
    def test_gemma_chat_works_via_ruche(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/functions/invoke/gemmaChat",
            headers=auth_headers,
            json={"messages": [{"role": "user", "content": "Réponds: pong."}]},
            timeout=120,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        # Accept multiple possible response shapes
        content = d.get("content") or d.get("text") or d.get("response") or d.get("message")
        if isinstance(content, dict):
            content = content.get("content")
        assert content, f"gemmaChat empty content: {d}"


# ------------------------------------------------------------------
# /api/market/staking-advice — DeepSeek R1 via Ruche
# ------------------------------------------------------------------
class TestStakingAdvice:
    def test_staking_advice_returns_analysis(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/market/staking-advice",
            headers=auth_headers,
            json={"amount_aq": 1000, "duration_days": 90, "risk_tolerance": "medium"},
            timeout=120,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        # Expect some textual analysis field
        keys = set(d.keys())
        assert keys, "empty staking-advice response"
        text_field = (
            d.get("advice") or d.get("analysis") or d.get("content")
            or d.get("recommendation") or d.get("text") or d.get("message")
        )
        assert text_field, f"no advisory content found in: {keys}"
