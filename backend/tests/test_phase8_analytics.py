"""Phase 8 Analytics Funnel Tests + Phase 7 critical-bug regression.

Covers:
  - POST /api/analytics/track (public, no auth)
  - POST /api/analytics/track with client session_key, Bearer token, malformed Bearer
  - POST /api/analytics/track input validation (event pattern)
  - GET  /api/analytics/funnel (auth required)
  - Server-side event firing on /auth/register, /public/audit, /payments/checkout/session
  - Phase 7 regressions: /payments/checkout/status fallback, enterprise 400, javascript: 400
"""
import os
import re
import uuid
import time
import pytest
import requests

def _load_backend_url():
    # Try env, then frontend/.env
    url = os.environ.get("REACT_APP_BACKEND_URL")
    if url:
        return url.rstrip("/")
    env_path = "/app/frontend/.env"
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().rstrip("/")
    raise RuntimeError("REACT_APP_BACKEND_URL not set")


BASE_URL = _load_backend_url()
DEMO_EMAIL = "demo@aegis-q.mil"
DEMO_PASSWORD = "Aegis2026!"


# ---------------- fixtures -----------------
@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def demo_token(api):
    r = api.post(f"{BASE_URL}/api/auth/login",
                 json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD}, timeout=30)
    if r.status_code != 200:
        pytest.skip(f"Demo login failed: {r.status_code} {r.text[:200]}")
    return r.json()["access_token"]


@pytest.fixture(scope="module")
def auth_headers(demo_token):
    return {"Authorization": f"Bearer {demo_token}", "Content-Type": "application/json"}


# ==================== POST /api/analytics/track ====================
class TestAnalyticsTrackPublic:
    def test_track_landing_view_public_no_auth(self, api):
        r = api.post(f"{BASE_URL}/api/analytics/track",
                     json={"event": "landing_view"}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["ok"] is True
        assert "session_key" in data
        assert isinstance(data["session_key"], str)
        assert re.fullmatch(r"[0-9a-f]{16}", data["session_key"]), f"Not 16-char hex: {data['session_key']}"

    def test_track_session_key_derived_from_ua_ip(self, api):
        """Different User-Agent should produce different session_key when IP is the same."""
        headers_a = {"Content-Type": "application/json",
                     "User-Agent": "AgentA/1.0",
                     "X-Forwarded-For": "198.51.100.77"}
        headers_b = {"Content-Type": "application/json",
                     "User-Agent": "AgentB/2.0",
                     "X-Forwarded-For": "198.51.100.77"}
        ra = requests.post(f"{BASE_URL}/api/analytics/track",
                           headers=headers_a, json={"event": "landing_view"}, timeout=15)
        rb = requests.post(f"{BASE_URL}/api/analytics/track",
                           headers=headers_b, json={"event": "landing_view"}, timeout=15)
        assert ra.status_code == 200
        assert rb.status_code == 200
        ka = ra.json()["session_key"]
        kb = rb.json()["session_key"]
        assert ka != kb, f"session_key collision with different UA: {ka} == {kb}"

    def test_track_client_provided_session_key_respected(self, api):
        custom = "my-custom-key-abc123"
        r = api.post(f"{BASE_URL}/api/analytics/track",
                     json={"event": "brochure_view", "session_key": custom}, timeout=15)
        assert r.status_code == 200
        assert r.json()["session_key"] == custom

    @pytest.mark.parametrize("bad_event", ["Landing View", "123", "foo bar", "UPPER", "a-b"])
    def test_track_invalid_event_pattern_returns_422(self, api, bad_event):
        r = api.post(f"{BASE_URL}/api/analytics/track",
                     json={"event": bad_event}, timeout=15)
        assert r.status_code == 422, f"{bad_event!r} accepted: {r.status_code} {r.text[:200]}"

    def test_track_with_bearer_attaches_user_id(self, api, auth_headers, demo_token):
        """Track with a unique session key while authenticated — verify via funnel that unique_users>0."""
        unique_evt_session = f"p8-uid-attach-{uuid.uuid4().hex[:8]}"
        r = api.post(f"{BASE_URL}/api/analytics/track",
                     headers=auth_headers,
                     json={"event": "landing_view", "session_key": unique_evt_session}, timeout=15)
        assert r.status_code == 200
        # Pull funnel and ensure landing_view has unique_users >= 1
        rf = api.get(f"{BASE_URL}/api/analytics/funnel?days=1",
                     headers={"Authorization": auth_headers["Authorization"]}, timeout=15)
        assert rf.status_code == 200
        stages = {s["stage"]: s for s in rf.json()["stages"]}
        assert stages["landing_view"]["unique_users"] >= 1, (
            f"Expected landing_view.unique_users>=1 after auth track, got {stages['landing_view']}")

    def test_track_malformed_bearer_falls_back_to_anonymous(self, api):
        """A bad Authorization header must NOT 401 — silently anonymous."""
        headers = {"Content-Type": "application/json",
                   "Authorization": "Bearer not-a-real-jwt-at-all"}
        r = requests.post(f"{BASE_URL}/api/analytics/track",
                          headers=headers, json={"event": "landing_view"}, timeout=15)
        assert r.status_code == 200, f"Malformed bearer caused {r.status_code}: {r.text[:200]}"
        assert r.json()["ok"] is True


# ==================== GET /api/analytics/funnel ====================
class TestAnalyticsFunnel:
    def test_funnel_requires_auth(self, api):
        r = requests.get(f"{BASE_URL}/api/analytics/funnel", timeout=15)
        assert r.status_code in (401, 403), f"Funnel accessible without auth: {r.status_code}"

    def test_funnel_returns_all_six_stages_in_order(self, api, auth_headers):
        r = api.get(f"{BASE_URL}/api/analytics/funnel?days=30",
                    headers={"Authorization": auth_headers["Authorization"]}, timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        for key in ("since", "days", "stages", "paid_sessions", "estimated_revenue_usd"):
            assert key in data, f"Missing key: {key}"
        expected = ["landing_view", "public_audit_run", "signup",
                    "brochure_view", "checkout_initiated", "checkout_paid"]
        actual = [s["stage"] for s in data["stages"]]
        assert actual == expected, f"Stage order wrong: {actual}"
        for s in data["stages"]:
            for k in ("stage", "count", "unique_users", "unique_sessions", "conversion_from_top_pct"):
                assert k in s, f"stage {s.get('stage')} missing {k}"
            assert isinstance(s["count"], int)
            assert isinstance(s["unique_users"], int)
            assert isinstance(s["unique_sessions"], int)

    def test_funnel_conversion_math(self, api, auth_headers):
        """Seed 3 landing_view with distinct IPs + 1 brochure_view with one of those IPs.
        Then pull funnel and verify conversion_from_top_pct for brochure_view > 0."""
        ip_pool = [f"198.51.100.{i}" for i in (201, 202, 203)]
        for ip in ip_pool:
            hdr = {"Content-Type": "application/json",
                   "User-Agent": "PhaseEightSeeder/1.0",
                   "X-Forwarded-For": ip}
            rl = requests.post(f"{BASE_URL}/api/analytics/track",
                               headers=hdr, json={"event": "landing_view"}, timeout=15)
            assert rl.status_code == 200
        # Matching brochure_view from IP #1
        hdr1 = {"Content-Type": "application/json",
                "User-Agent": "PhaseEightSeeder/1.0",
                "X-Forwarded-For": ip_pool[0]}
        rb = requests.post(f"{BASE_URL}/api/analytics/track",
                           headers=hdr1, json={"event": "brochure_view"}, timeout=15)
        assert rb.status_code == 200
        # Pull funnel
        rf = api.get(f"{BASE_URL}/api/analytics/funnel?days=1",
                     headers={"Authorization": auth_headers["Authorization"]}, timeout=15)
        assert rf.status_code == 200
        stages = {s["stage"]: s for s in rf.json()["stages"]}
        # landing_view must have >= 3 unique_sessions from our seeds
        assert stages["landing_view"]["unique_sessions"] >= 3
        # brochure_view must have >= 1 unique session and a positive conversion pct
        assert stages["brochure_view"]["unique_sessions"] >= 1
        assert stages["brochure_view"]["conversion_from_top_pct"] > 0


# ============= Server-side event firing =============
class TestServerSideEventsFire:
    def test_register_emits_signup_event(self, api, auth_headers):
        # baseline
        rf0 = api.get(f"{BASE_URL}/api/analytics/funnel?days=1",
                      headers={"Authorization": auth_headers["Authorization"]}, timeout=15)
        base_signup = next(s["count"] for s in rf0.json()["stages"] if s["stage"] == "signup")
        # register a fresh user
        suffix = uuid.uuid4().hex[:10]
        payload = {"email": f"p8_fresh_{suffix}@aegis-q.mil",
                   "password": "Aegis2026!",
                   "full_name": "Phase8 Fresh"}
        rr = api.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=30)
        assert rr.status_code in (200, 201), rr.text
        time.sleep(0.4)
        rf1 = api.get(f"{BASE_URL}/api/analytics/funnel?days=1",
                      headers={"Authorization": auth_headers["Authorization"]}, timeout=15)
        new_signup = next(s["count"] for s in rf1.json()["stages"] if s["stage"] == "signup")
        assert new_signup >= base_signup + 1, f"signup count did not grow: {base_signup}->{new_signup}"

    def test_public_audit_emits_public_audit_run(self, api, auth_headers):
        rf0 = api.get(f"{BASE_URL}/api/analytics/funnel?days=1",
                      headers={"Authorization": auth_headers["Authorization"]}, timeout=15)
        base_count = next(s["count"] for s in rf0.json()["stages"] if s["stage"] == "public_audit_run")
        # Run public audit as demo (premium bypasses rate limit)
        r = api.post(f"{BASE_URL}/api/public/audit",
                     headers={"Authorization": auth_headers["Authorization"],
                              "Content-Type": "application/json"},
                     json={"code": "print('phase8 audit test payload here')", "name": "Phase8 audit"}, timeout=120)
        if r.status_code >= 500:
            pytest.skip(f"Upstream 5xx on public/audit: {r.status_code}")
        assert r.status_code in (200, 201), r.text[:300]
        time.sleep(0.4)
        rf1 = api.get(f"{BASE_URL}/api/analytics/funnel?days=1",
                      headers={"Authorization": auth_headers["Authorization"]}, timeout=15)
        new_count = next(s["count"] for s in rf1.json()["stages"] if s["stage"] == "public_audit_run")
        assert new_count >= base_count + 1, f"public_audit_run did not grow: {base_count}->{new_count}"

    def test_checkout_session_emits_checkout_initiated(self, api, auth_headers):
        rf0 = api.get(f"{BASE_URL}/api/analytics/funnel?days=1",
                      headers={"Authorization": auth_headers["Authorization"]}, timeout=15)
        base_count = next(s["count"] for s in rf0.json()["stages"] if s["stage"] == "checkout_initiated")
        r = api.post(f"{BASE_URL}/api/payments/checkout/session",
                     headers={"Authorization": auth_headers["Authorization"],
                              "Content-Type": "application/json"},
                     json={"package_id": "starter",
                           "origin_url": "https://hybrid-federated-ia.preview.emergentagent.com"},
                     timeout=30)
        assert r.status_code == 200, r.text[:300]
        assert "session_id" in r.json()
        time.sleep(0.4)
        rf1 = api.get(f"{BASE_URL}/api/analytics/funnel?days=1",
                      headers={"Authorization": auth_headers["Authorization"]}, timeout=15)
        new_count = next(s["count"] for s in rf1.json()["stages"] if s["stage"] == "checkout_initiated")
        assert new_count >= base_count + 1, f"checkout_initiated did not grow: {base_count}->{new_count}"


# ============= Phase 7 regression (critical) =============
class TestPhase7Regression:
    def test_checkout_status_does_not_500(self, api, auth_headers):
        # Create a session then immediately poll status — previously 500
        r = api.post(f"{BASE_URL}/api/payments/checkout/session",
                     headers={"Authorization": auth_headers["Authorization"],
                              "Content-Type": "application/json"},
                     json={"package_id": "professional",
                           "origin_url": "https://hybrid-federated-ia.preview.emergentagent.com"},
                     timeout=30)
        assert r.status_code == 200, r.text
        sid = r.json()["session_id"]
        rs = api.get(f"{BASE_URL}/api/payments/checkout/status/{sid}",
                     headers={"Authorization": auth_headers["Authorization"]},
                     timeout=30)
        assert rs.status_code == 200, f"status 500 regression: {rs.status_code} {rs.text[:200]}"
        body = rs.json()
        assert "payment_status" in body
        assert "status" in body
        # Should be either DB-cached ('initiated' / 'pending') or live — both acceptable
        assert body["payment_status"] in ("pending", "paid", "unpaid", "open", "expired", "complete")

    def test_checkout_enterprise_returns_400(self, api, auth_headers):
        r = api.post(f"{BASE_URL}/api/payments/checkout/session",
                     headers={"Authorization": auth_headers["Authorization"],
                              "Content-Type": "application/json"},
                     json={"package_id": "enterprise",
                           "origin_url": "https://hybrid-federated-ia.preview.emergentagent.com"},
                     timeout=30)
        assert r.status_code == 400, f"expected 400 for enterprise, got {r.status_code}: {r.text[:200]}"

    def test_checkout_javascript_origin_returns_400(self, api, auth_headers):
        r = api.post(f"{BASE_URL}/api/payments/checkout/session",
                     headers={"Authorization": auth_headers["Authorization"],
                              "Content-Type": "application/json"},
                     json={"package_id": "starter",
                           "origin_url": "javascript:alert(1)"},
                     timeout=30)
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"

    def test_auth_register_login_still_works(self, api):
        suffix = uuid.uuid4().hex[:10]
        email = f"p8_reg_{suffix}@aegis-q.mil"
        r = api.post(f"{BASE_URL}/api/auth/register",
                     json={"email": email, "password": "Aegis2026!", "full_name": "Reg Test"},
                     timeout=30)
        assert r.status_code in (200, 201), r.text
        rl = api.post(f"{BASE_URL}/api/auth/login",
                      json={"email": email, "password": "Aegis2026!"}, timeout=30)
        assert rl.status_code == 200
        assert "access_token" in rl.json()
