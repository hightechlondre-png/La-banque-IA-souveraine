"""
Phase 11 — Public Ruche (marketing endpoints, no auth, IP rate-limited).

Covers:
- GET  /api/public/ruche/status       : schema, 9 bees, credits partial (no used/total)
- POST /api/public/ruche/smart-route  : routing response, `role` not leaked
- Pydantic validation (min=3, max=400)
- Rate-limit: 5/hour/IP, 6th => 429, different IPs independent
- Regression: /api/auth/login, /api/ruche/status (auth), /api/ruche/smart-route (auth)
"""
import os
import time
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not set"

EMAIL = "demo@aegis-q.mil"
PASSWORD = "Aegis2026!"


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def http():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def auth_token(http):
    r = http.post(f"{BASE_URL}/api/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"Login failed {r.status_code}: {r.text[:200]}")
    return r.json().get("access_token") or r.json().get("token")


def _unique_ip():
    """Return a random-ish IPv4 so each test starts with a fresh rate-limit bucket."""
    return f"10.{uuid.uuid4().int % 255}.{uuid.uuid4().int % 255}.{uuid.uuid4().int % 255}"


# ---------- PUBLIC STATUS ----------
class TestPublicStatus:
    def test_status_no_auth_ok(self, http):
        r = http.get(f"{BASE_URL}/api/public/ruche/status", timeout=90)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("enabled") is True, f"enabled!=true: {data}"
        assert "bees" in data and isinstance(data["bees"], list)
        assert len(data["bees"]) == 9, f"expected 9 bees, got {len(data['bees'])}"

    def test_status_bees_schema(self, http):
        r = http.get(f"{BASE_URL}/api/public/ruche/status", timeout=90)
        assert r.status_code == 200
        required = {"status", "tier", "label", "icon", "specialty", "budget", "is_embedding"}
        for b in r.json()["bees"]:
            missing = required - set(b.keys())
            assert not missing, f"bee missing fields {missing}: {b}"

    def test_status_credits_partial(self, http):
        r = http.get(f"{BASE_URL}/api/public/ruche/status", timeout=90)
        assert r.status_code == 200
        credits = r.json().get("credits")
        assert credits is not None, "credits missing"
        assert "remaining" in credits, f"remaining missing: {credits}"
        # Volontairement : used / total ne doivent PAS fuiter
        assert "used" not in credits, f"'used' leaked: {credits}"
        assert "total" not in credits, f"'total' leaked: {credits}"

    def test_status_role_slug_not_leaked(self, http):
        """Per spec note: 'role' (grade_fou, llm1, mem0_1...) = slug interne, NE doit PAS fuiter publiquement."""
        r = http.get(f"{BASE_URL}/api/public/ruche/status", timeout=90)
        assert r.status_code == 200
        leaks = [b for b in r.json().get("bees", []) if "role" in b]
        assert not leaks, (
            f"Internal slug 'role' leaked in /api/public/ruche/status for {len(leaks)} bee(s). "
            f"Example: {leaks[0] if leaks else None}"
        )


# ---------- PUBLIC SMART-ROUTE ----------
class TestPublicSmartRoute:
    def test_smart_route_ok_no_auth(self, http):
        headers = {"X-Forwarded-For": _unique_ip()}
        r = http.post(
            f"{BASE_URL}/api/public/ruche/smart-route",
            json={"query": "Audit Solidity réentrance"},
            headers=headers,
            timeout=60,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        for k in ("label", "specialty", "similarity", "top", "remaining_calls"):
            assert k in data, f"missing {k}: {data}"
        assert isinstance(data["top"], list) and len(data["top"]) > 0
        assert isinstance(data["remaining_calls"], int)

    def test_smart_route_role_not_leaked(self, http):
        """Le slug interne `role` ne doit pas fuiter (ni top-level, ni dans top[])."""
        headers = {"X-Forwarded-For": _unique_ip()}
        r = http.post(
            f"{BASE_URL}/api/public/ruche/smart-route",
            json={"query": "Audit Solidity réentrance"},
            headers=headers,
            timeout=60,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "role" not in data, f"'role' leaked top-level: {data}"
        for t in data["top"]:
            assert "role" not in t, f"'role' leaked in top[]: {t}"

    def test_smart_route_query_too_short(self, http):
        headers = {"X-Forwarded-For": _unique_ip()}
        r = http.post(
            f"{BASE_URL}/api/public/ruche/smart-route",
            json={"query": "ab"},
            headers=headers,
            timeout=15,
        )
        assert r.status_code in (400, 422), f"expected 400/422, got {r.status_code}: {r.text}"

    def test_smart_route_query_too_long(self, http):
        headers = {"X-Forwarded-For": _unique_ip()}
        r = http.post(
            f"{BASE_URL}/api/public/ruche/smart-route",
            json={"query": "x" * 401},
            headers=headers,
            timeout=15,
        )
        assert r.status_code == 422, f"expected 422, got {r.status_code}: {r.text}"


# ---------- RATE LIMIT ----------
class TestRateLimit:
    def test_rate_limit_triggers_on_6th(self, http):
        """5 requêtes OK, 6e => 429 avec detail contenant 'Limite atteinte'."""
        ip = _unique_ip()
        headers = {"X-Forwarded-For": ip}
        ok = 0
        for i in range(5):
            r = http.post(
                f"{BASE_URL}/api/public/ruche/smart-route",
                json={"query": f"Audit Solidity réentrance pass {i}"},
                headers=headers,
                timeout=60,
            )
            assert r.status_code == 200, f"call {i+1} failed: {r.status_code} {r.text[:200]}"
            ok += 1
        assert ok == 5
        # 6e doit échouer
        r6 = http.post(
            f"{BASE_URL}/api/public/ruche/smart-route",
            json={"query": "Audit Solidity réentrance call 6"},
            headers=headers,
            timeout=15,
        )
        assert r6.status_code == 429, f"expected 429, got {r6.status_code}: {r6.text}"
        detail = (r6.json().get("detail") or "")
        assert "Limite atteinte" in detail, f"detail missing 'Limite atteinte': {detail}"

    def test_rate_limit_independent_per_ip(self, http):
        """Different IPs have independent buckets — pas de cross-contamination."""
        ip_a = _unique_ip()
        ip_b = _unique_ip()
        # burn 5 on ip_a
        for i in range(5):
            r = http.post(
                f"{BASE_URL}/api/public/ruche/smart-route",
                json={"query": f"Audit Solidity iter {i}"},
                headers={"X-Forwarded-For": ip_a},
                timeout=60,
            )
            assert r.status_code == 200, f"ip_a call {i} failed: {r.text[:200]}"
        # ip_a -> 429
        r_a6 = http.post(
            f"{BASE_URL}/api/public/ruche/smart-route",
            json={"query": "ip_a six"},
            headers={"X-Forwarded-For": ip_a},
            timeout=15,
        )
        assert r_a6.status_code == 429
        # ip_b -> 200 (independent bucket)
        r_b = http.post(
            f"{BASE_URL}/api/public/ruche/smart-route",
            json={"query": "Audit Solidity ip_b"},
            headers={"X-Forwarded-For": ip_b},
            timeout=60,
        )
        assert r_b.status_code == 200, f"ip_b should be OK: {r_b.status_code} {r_b.text[:200]}"


# ---------- REGRESSION ----------
class TestRegression:
    def test_login_ok(self, http):
        r = http.post(f"{BASE_URL}/api/auth/login",
                      json={"email": EMAIL, "password": PASSWORD}, timeout=30)
        assert r.status_code == 200, r.text
        assert r.json().get("access_token") or r.json().get("token")

    def test_authed_ruche_status(self, http, auth_token):
        # Retry once on 502 (preview ingress occasional hiccup)
        for attempt in range(2):
            r = http.get(
                f"{BASE_URL}/api/ruche/status",
                headers={"Authorization": f"Bearer {auth_token}"},
                timeout=90,
            )
            if r.status_code != 502:
                break
            time.sleep(3)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("enabled") is True
        assert len(data.get("bees", [])) >= 1

    def test_authed_smart_route(self, http, auth_token):
        r = http.post(
            f"{BASE_URL}/api/ruche/smart-route",
            json={"query": "Audit Solidity réentrance"},
            headers={"Authorization": f"Bearer {auth_token}"},
            timeout=60,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        # version authentifiée: role est autorisé ici (usage interne)
        assert "label" in data and "similarity" in data and "top" in data
