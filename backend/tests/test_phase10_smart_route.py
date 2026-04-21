"""
Phase 10 — Routage sémantique Qwen (superviseur) + Reine N-MEM-B (Gemini).
Tests des 4 nouveaux endpoints :
- POST /api/ruche/smart-route
- POST /api/ruche/auto
- POST /api/ruche/queen/remember
- POST /api/ruche/queen/recall
+ régression rapide /api/ruche/status, /api/functions/invoke/gemmaChat, /api/auth/login.
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://hybrid-federated-ia.preview.emergentagent.com").rstrip("/")
DEMO_EMAIL = "demo@aegis-q.mil"
DEMO_PASS = "Aegis2026!"


@pytest.fixture(scope="module")
def auth_headers():
    r = requests.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": DEMO_EMAIL, "password": DEMO_PASS},
        timeout=20,
    )
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    tok = r.json()["access_token"]
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


# ------------------------------------------------------------------
# Régression rapide
# ------------------------------------------------------------------
class TestRegression:
    def test_login(self):
        r = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": DEMO_EMAIL, "password": DEMO_PASS},
            timeout=20,
        )
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_ruche_status_9_bees(self, auth_headers):
        r = requests.get(f"{BASE_URL}/api/ruche/status", headers=auth_headers, timeout=120)
        assert r.status_code == 200
        data = r.json()
        assert data["enabled"] is True
        bees = data["bees"]
        assert len(bees) == 9
        ok_count = sum(1 for b in bees if b["status"] == "ok")
        assert ok_count == 9, f"Only {ok_count}/9 bees OK: {bees}"
        assert "credits" in data and data["credits"] is not None
        assert "remaining" in data["credits"]

    def test_gemma_chat(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/functions/invoke/gemmaChat",
            headers=auth_headers,
            json={"messages": [{"role": "user", "content": "Dis 'OK' en un mot."}]},
            timeout=90,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("content"), f"empty content: {data}"


# ------------------------------------------------------------------
# /api/ruche/smart-route — Qwen sémantique routing
# ------------------------------------------------------------------
class TestSmartRoute:
    def _route(self, headers, query):
        r = requests.post(
            f"{BASE_URL}/api/ruche/smart-route",
            headers=headers,
            json={"query": query},
            timeout=60,
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        return r.json()

    def test_no_query_400(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/ruche/smart-route", headers=auth_headers, json={}, timeout=20)
        assert r.status_code == 400

    def test_top_structure(self, auth_headers):
        data = self._route(auth_headers, "Audit ce smart contract Solidity pour trouver des réentrances")
        assert "role" in data and "similarity" in data and "top" in data
        assert isinstance(data["top"], list) and len(data["top"]) == 3
        for entry in data["top"]:
            assert {"role", "label", "specialty", "similarity"}.issubset(entry.keys())

    def test_route_solidity_audit_to_llm1(self, auth_headers):
        data = self._route(auth_headers, "Audit ce smart contract Solidity pour trouver des réentrances")
        assert data["role"] == "llm1", f"Expected llm1, got {data['role']} (top={data['top']})"
        assert data["similarity"] > 0.6, f"similarity={data['similarity']}"

    def test_route_staking_to_llm2(self, auth_headers):
        data = self._route(auth_headers, "Calcule mon APY de staking pour 10000 AQ")
        assert data["role"] == "llm2", f"Expected llm2, got {data['role']} (top={data['top']})"

    def test_route_doc_summary_to_memoire1(self, auth_headers):
        data = self._route(auth_headers, "Résume cette longue documentation technique")
        assert data["role"] == "memoire1", f"Expected memoire1, got {data['role']} (top={data['top']})"

    def test_route_orchestration_to_mem0_1(self, auth_headers):
        data = self._route(auth_headers, "Plan multi-étapes pour orchestrer 3 agents autonomes")
        assert data["role"] == "mem0_1", f"Expected mem0_1, got {data['role']} (top={data['top']})"


# ------------------------------------------------------------------
# /api/ruche/auto — chat auto-routé
# ------------------------------------------------------------------
class TestAutoChat:
    def test_no_query_400(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/ruche/auto", headers=auth_headers, json={}, timeout=20)
        assert r.status_code == 400

    def test_auto_returns_content_and_routing(self, auth_headers):
        r = requests.post(
            f"{BASE_URL}/api/ruche/auto",
            headers=auth_headers,
            json={"query": "Dis bonjour en un mot."},
            timeout=120,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("content"), f"empty content: {data}"
        assert data.get("bee_used")
        assert "routing" in data
        routing = data["routing"]
        assert "top" in routing and len(routing["top"]) >= 1
        assert "similarity" in routing


# ------------------------------------------------------------------
# /api/ruche/queen/remember + /recall — N-MEM-B Gemini
# ------------------------------------------------------------------
class TestQueenMemory:
    MEMORIES = [
        "AEGIS-Q est une banque IA militaire souveraine basée sur N-MEM-B.",
        "Le token AQ utilise un modèle déflationniste avec staking pool Gold.",
        "La Ruche fédère 9 abeilles cognitives sous supervision Qwen embedding.",
    ]

    def test_remember_no_content_400(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/ruche/queen/remember", headers=auth_headers, json={}, timeout=20)
        assert r.status_code == 400

    def test_recall_no_query_400(self, auth_headers):
        r = requests.post(f"{BASE_URL}/api/ruche/queen/recall", headers=auth_headers, json={}, timeout=20)
        assert r.status_code == 400

    def test_remember_three_memories(self, auth_headers):
        for content in self.MEMORIES:
            r = requests.post(
                f"{BASE_URL}/api/ruche/queen/remember",
                headers=auth_headers,
                json={"content": content, "metadata": {"tag": "phase10_test"}},
                timeout=60,
            )
            assert r.status_code == 200, f"remember failed: {r.status_code} {r.text}"
            data = r.json()
            assert "id" in data and "dim" in data and "created_at" in data
            assert data["dim"] > 100, f"embedding dim too small: {data['dim']}"

    def test_recall_returns_sorted_by_similarity(self, auth_headers):
        # Make sure memories are seeded (idempotent: insert if not done)
        for content in self.MEMORIES:
            requests.post(
                f"{BASE_URL}/api/ruche/queen/remember",
                headers=auth_headers,
                json={"content": content, "metadata": {"tag": "phase10_test"}},
                timeout=60,
            )
        r = requests.post(
            f"{BASE_URL}/api/ruche/queen/recall",
            headers=auth_headers,
            json={"query": "abeilles cognitives Qwen", "top_k": 3, "filter_tag": "phase10_test"},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["count"] >= 1
        results = data["results"]
        # Sorted desc by similarity
        sims = [x["similarity"] for x in results]
        assert sims == sorted(sims, reverse=True), f"not sorted: {sims}"
        # Top result should mention 'abeilles' or 'Qwen'
        top_content = (results[0].get("content") or "").lower()
        assert "abeilles" in top_content or "qwen" in top_content or "ruche" in top_content
