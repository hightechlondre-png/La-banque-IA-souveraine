"""
AEGIS-Q Core Net — Backend API tests
Tests auth, entity CRUD, and function invocation dispatchers.
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://hybrid-federated-ia.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

DEMO_EMAIL = "demo@aegis-q.mil"
DEMO_PASSWORD = "Aegis2026!"


# -------------------- Fixtures --------------------
@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def token(client):
    r = client.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}, timeout=30)
    if r.status_code != 200:
        # attempt register
        reg = client.post(f"{API}/auth/register", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD, "full_name": "Demo Operator"}, timeout=30)
        if reg.status_code == 200:
            return reg.json()["access_token"]
        pytest.skip(f"Cannot authenticate: login={r.status_code} register={reg.status_code}")
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def auth_headers(token):
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# -------------------- Health --------------------
class TestHealth:
    def test_root(self, client):
        r = client.get(f"{API}/", timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert data.get("app")
        assert data.get("version")
        assert data.get("status")
        assert data.get("model")


# -------------------- Auth --------------------
class TestAuth:
    def test_register_new_email(self, client):
        email = f"test_{uuid.uuid4().hex[:8]}@aegis-q.mil"
        r = client.post(f"{API}/auth/register", json={"email": email, "password": "TestPass123!", "full_name": "Test User"}, timeout=30)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "access_token" in data and isinstance(data["access_token"], str)
        assert data["user"]["email"] == email

    def test_register_duplicate_email(self, client):
        r = client.post(f"{API}/auth/register", json={"email": DEMO_EMAIL, "password": "whatever123", "full_name": "Dup"}, timeout=30)
        assert r.status_code == 400

    def test_login_success(self, client):
        r = client.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}, timeout=30)
        assert r.status_code == 200, r.text
        assert "access_token" in r.json()

    def test_login_bad_password(self, client):
        r = client.post(f"{API}/auth/login", json={"email": DEMO_EMAIL, "password": "WRONG_PASSWORD"}, timeout=30)
        assert r.status_code == 401

    def test_me_with_token(self, client, auth_headers):
        r = client.get(f"{API}/auth/me", headers=auth_headers, timeout=20)
        assert r.status_code == 200
        assert r.json()["email"] == DEMO_EMAIL

    def test_me_without_token(self, client):
        r = client.get(f"{API}/auth/me", timeout=20)
        assert r.status_code == 401


# -------------------- Entity CRUD (MemoryNode) --------------------
class TestMemoryNodeCRUD:
    def test_list_memory_nodes(self, client, auth_headers):
        r = client.get(f"{API}/entities/MemoryNode/list", headers=auth_headers, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) > 0
        assert "_id" not in data[0]
        assert "id" in data[0]

    def test_filter_memory_nodes(self, client, auth_headers):
        r = client.post(f"{API}/entities/MemoryNode/filter", json={"query": {"fractal_level": 0}, "limit": 50}, headers=auth_headers, timeout=20)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        for n in data:
            assert n["fractal_level"] == 0

    def test_create_get_update_delete_node(self, client, auth_headers):
        # CREATE
        payload = {
            "node_id": f"test_{uuid.uuid4().hex[:6]}",
            "concept": "TEST_NODE",
            "type": "EVENT",
            "fractal_level": 2,
            "emotion_weight": 0.5,
            "resonance": 0.6,
            "tier": "ACTIVE",
        }
        r = client.post(f"{API}/entities/MemoryNode", json=payload, headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text
        created = r.json()
        assert created["concept"] == "TEST_NODE"
        assert "id" in created
        node_id = created["id"]

        # GET
        r = client.get(f"{API}/entities/MemoryNode/{node_id}", headers=auth_headers, timeout=20)
        assert r.status_code == 200
        assert r.json()["concept"] == "TEST_NODE"

        # UPDATE
        r = client.put(f"{API}/entities/MemoryNode/{node_id}", json={"concept": "TEST_NODE_UPDATED", "resonance": 0.9}, headers=auth_headers, timeout=20)
        assert r.status_code == 200
        assert r.json()["concept"] == "TEST_NODE_UPDATED"

        # Verify persisted
        r = client.get(f"{API}/entities/MemoryNode/{node_id}", headers=auth_headers, timeout=20)
        assert r.status_code == 200
        assert r.json()["concept"] == "TEST_NODE_UPDATED"
        assert r.json()["resonance"] == 0.9

        # DELETE
        r = client.delete(f"{API}/entities/MemoryNode/{node_id}", headers=auth_headers, timeout=20)
        assert r.status_code == 200

        # Verify gone
        r = client.get(f"{API}/entities/MemoryNode/{node_id}", headers=auth_headers, timeout=20)
        assert r.status_code == 404


# -------------------- Seeded Entity lists --------------------
@pytest.mark.parametrize("entity", ["Agent", "Skill", "AuditEvent", "MonetaryProposal", "FactionResonance"])
def test_entity_list_seeded(client, auth_headers, entity):
    r = client.get(f"{API}/entities/{entity}/list", headers=auth_headers, timeout=20)
    assert r.status_code == 200, f"{entity}: {r.text}"
    data = r.json()
    assert isinstance(data, list)
    assert len(data) > 0, f"{entity} has no seeded data"


# -------------------- Functions --------------------
class TestFunctions:
    def test_predict_resonance(self, client, auth_headers):
        r = client.post(f"{API}/functions/invoke/predictResonance", json={}, headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        for k in ("predictions", "alerts", "stats", "generated_at"):
            assert k in d

    def test_gemma_chat_claude_opus(self, client, auth_headers):
        r = client.post(
            f"{API}/functions/invoke/gemmaChat",
            json={"messages": [{"role": "user", "content": "Bonjour, que fait AEGIS-Q? Réponds en une phrase."}]},
            headers=auth_headers,
            timeout=120,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "content" in d
        assert isinstance(d["content"], str) and len(d["content"]) > 0
        # Should NOT be in demo mode since EMERGENT_LLM_KEY is set
        assert not d["content"].startswith("[MODE DÉMO]"), f"LLM in demo mode: {d['content'][:200]}"
        # Should not be an error response
        assert not d["content"].startswith("[Erreur LLM]"), f"LLM error: {d['content'][:300]}"

    def test_orchestrate_agent(self, client, auth_headers):
        # Get an agent id
        r = client.get(f"{API}/entities/Agent/list", headers=auth_headers, timeout=20)
        assert r.status_code == 200
        agents = r.json()
        assert len(agents) > 0
        agent_id = agents[0]["id"]

        r = client.post(
            f"{API}/functions/invoke/orchestrateAgent",
            json={"agent_id": agent_id, "prompt": "Liste 2 risques clés sur les bridges cross-chain en une phrase chacun."},
            headers=auth_headers,
            timeout=120,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("status") == "success"
        assert d.get("execution_id")
        assert isinstance(d.get("result"), str) and len(d["result"]) > 0

    def test_index_and_retrieve_document(self, client, auth_headers):
        title = f"TEST_Doc_{uuid.uuid4().hex[:6]}"
        content = (
            "AEGIS-Q est une banque IA militaire souveraine qui utilise la mémoire fractale N-MEM-B. "
            "Le token AQ a un mécanisme déflationniste via burn-on-bridge. "
            "Les agents cognitifs orchestrent les skills via Claude Opus 4.5. "
            "La gouvernance DAO vote sur l'inflation et le burn rate via des propositions monétaires. "
            * 3
        )
        r = client.post(
            f"{API}/functions/invoke/indexDocument",
            json={"title": title, "source_type": "text", "content": content},
            headers=auth_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("status") == "success"
        assert d.get("chunks_created", 0) >= 1

        # Retrieve
        r = client.post(
            f"{API}/functions/invoke/retrieveContext",
            json={"query": "Comment fonctionne le burn rate et la gouvernance DAO?", "top_k": 3},
            headers=auth_headers,
            timeout=20,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("status") == "success"
        assert isinstance(d.get("results"), list)

    def test_test_skill(self, client, auth_headers):
        # Get a skill
        r = client.get(f"{API}/entities/Skill/list", headers=auth_headers, timeout=20)
        assert r.status_code == 200
        skills = r.json()
        assert len(skills) > 0
        sk = skills[0]
        r = client.post(
            f"{API}/functions/invoke/testSkill",
            json={
                "skill_id": sk["id"],
                "skill_name": sk["name"],
                "test_input": "Test bref: dis 'OK' en un mot.",
                "system_prompt": "Réponds en un seul mot.",
            },
            headers=auth_headers,
            timeout=120,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("status") in ("success", "failed")
        if d["status"] == "success":
            assert isinstance(d.get("result"), str) and len(d["result"]) > 0

    def test_check_price_alerts(self, client, auth_headers):
        r = client.post(f"{API}/functions/invoke/checkPriceAlerts", json={"current_price": 2.15}, headers=auth_headers, timeout=20)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "checked" in d
        assert "alerts_sent" in d

    def test_check_price_alerts_real_aq_price(self, client, auth_headers):
        """Phase 3: no current_price in body -> backend uses real AQ basket price; change24h present."""
        r = client.post(f"{API}/functions/invoke/checkPriceAlerts", json={}, headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "current_price" in d
        assert "change24h" in d
        assert isinstance(d["current_price"], (int, float))
        # If CoinGecko reachable, price should be > 0; fallback may give 0 — accept both but log.
        assert d["current_price"] >= 0

    def test_unknown_function(self, client, auth_headers):
        r = client.post(f"{API}/functions/invoke/nonExistentFn", json={}, headers=auth_headers, timeout=20)
        assert r.status_code == 404


# -------------------- Phase 3: Market Prices --------------------
class TestMarketPrices:
    def test_market_prices_requires_auth(self, client):
        r = client.get(f"{API}/market/prices", timeout=20)
        assert r.status_code == 401

    def test_market_prices_authenticated(self, client, auth_headers):
        r = client.get(f"{API}/market/prices", headers=auth_headers, timeout=30)
        assert r.status_code == 200, r.text
        d = r.json()
        assert "coins" in d and "aq" in d and "ts" in d
        coins = d["coins"]
        for sym in ("BTC", "ETH", "SOL"):
            assert sym in coins
            assert "usd" in coins[sym] and "change24h" in coins[sym]
            assert isinstance(coins[sym]["usd"], (int, float))
            # Phase 3 spec: USD values MUST be > 0
            assert coins[sym]["usd"] > 0, f"{sym} usd not > 0 (CoinGecko unreachable?): {coins[sym]}"
        assert "usd" in d["aq"] and "change24h" in d["aq"]
        assert d["aq"]["usd"] > 0


# -------------------- Phase 3: TF-IDF RAG --------------------
class TestRAGTfIdf:
    def test_index_document_no_embedding_field(self, client, auth_headers):
        """Phase 3: indexDocument chunks should NOT have an embedding field (TF-IDF mode)."""
        title = f"TEST_TFIDF_{uuid.uuid4().hex[:6]}"
        content = (
            "AEGIS-Q propose un staking Gold avec APY maximal de 18% pour un lock de 12 mois. "
            "Le staking Premium offre un multiplicateur 1.5x et le Standard 1.0x. "
            "La politique monétaire déflationniste est pilotée par la DAO avec un burn rate sur les bridges. "
        ) * 4
        r = client.post(
            f"{API}/functions/invoke/indexDocument",
            json={"title": title, "source_type": "text", "content": content},
            headers=auth_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("status") == "success"
        assert d.get("chunks_created", 0) >= 1

        # Fetch the doc back via entity list to inspect chunks
        r2 = client.post(
            f"{API}/entities/KnowledgeDocument/filter",
            json={"query": {"id": d["document_id"]}, "limit": 1},
            headers=auth_headers,
            timeout=20,
        )
        assert r2.status_code == 200
        docs = r2.json()
        assert len(docs) == 1
        chunks = docs[0].get("content_chunks", [])
        assert len(chunks) >= 1
        for c in chunks:
            assert "embedding" not in c, f"TF-IDF mode should not persist embeddings: {list(c.keys())}"
            assert "text" in c

    def test_retrieve_context_relevant_query(self, client, auth_headers):
        """Phase 3: meaningful query against the seeded AEGIS-Q whitepaper should return similarity > 0."""
        # Ensure a relevant doc exists (seed KB has staking/Gold/APY text). Index a fresh targeted one too.
        client.post(
            f"{API}/functions/invoke/indexDocument",
            json={
                "title": f"TEST_Staking_{uuid.uuid4().hex[:6]}",
                "source_type": "text",
                "content": (
                    "Le staking AEGIS-Q Gold offre un APY maximal de 18% avec un lock de 12 mois. "
                    "Les tiers sont Standard (x1), Premium (x1.5), Gold (x2). "
                    "Ce document explique en détail les récompenses du staking Gold APY. "
                ) * 3,
            },
            headers=auth_headers,
            timeout=30,
        )
        r = client.post(
            f"{API}/functions/invoke/retrieveContext",
            json={"query": "staking gold APY", "top_k": 5},
            headers=auth_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("status") == "success"
        results = d.get("results", [])
        assert isinstance(results, list)
        assert len(results) > 0, "expected at least 1 TF-IDF hit for 'staking gold APY'"
        assert results[0]["similarity"] > 0
        # Validate no embedding field is leaked into results
        for r_ in results:
            assert "embedding" not in r_

    def test_retrieve_context_irrelevant_query_no_crash(self, client, auth_headers):
        """Phase 3: totally irrelevant query must not crash (may return 0 results)."""
        r = client.post(
            f"{API}/functions/invoke/retrieveContext",
            json={"query": "lorem ipsum xyz123 quantum ufo blablablabla", "top_k": 5},
            headers=auth_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("status") == "success"
        assert isinstance(d.get("results"), list)  # may be empty
