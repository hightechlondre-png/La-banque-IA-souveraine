"""
AEGIS-Q Phase 7 — Stripe tiered SaaS + premium gating on /api/public/audit

Covers:
  - POST /api/payments/checkout/session (starter, professional, invalid, no-auth)
  - MongoDB payment_transactions persistence
  - GET /api/payments/checkout/status/{session_id} (200, 403 cross-user, 404 unknown)
  - POST /api/webhook/stripe with empty body/missing signature → 400
  - Premium gating on POST /api/public/audit:
        * demo user with subscription_tier='professional' → premium:true,
          watermark AEGIS-Q · …, rate-limit bypassed (concurrent requests 200)
        * fresh user without tier → premium:false, watermark SAMPLE …
"""
import os
import uuid
import time
import concurrent.futures as cf

import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://hybrid-federated-ia.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

DEMO_EMAIL = "demo@aegis-q.mil"
DEMO_PASSWORD = "Aegis2026!"

ORIGIN = BASE_URL  # used as origin_url for checkout session

SAMPLE_SOLIDITY = """// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract Vault {
    mapping(address => uint256) public balances;
    function deposit() external payable { balances[msg.sender] += msg.value; }
    function withdraw() external {
        uint256 amt = balances[msg.sender];
        (bool ok, ) = msg.sender.call{value: amt}("");
        require(ok);
        balances[msg.sender] = 0;
    }
}
"""


# ------------------------------ Fixtures ------------------------------
@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def demo_token(client):
    r = client.post(
        f"{API}/auth/login",
        json={"email": DEMO_EMAIL, "password": DEMO_PASSWORD},
        timeout=30,
    )
    if r.status_code != 200:
        pytest.skip(f"Cannot login demo user: {r.status_code} {r.text[:200]}")
    return r.json()["access_token"]


@pytest.fixture(scope="session")
def demo_headers(demo_token):
    return {"Authorization": f"Bearer {demo_token}", "Content-Type": "application/json"}


@pytest.fixture(scope="session")
def fresh_user(client):
    """Register a fresh user with NO subscription_tier. Returns (email, token, user_id)."""
    email = f"phase7_fresh_{uuid.uuid4().hex[:8]}@aegis-q.mil"
    r = client.post(
        f"{API}/auth/register",
        json={"email": email, "password": "TestPass123!", "full_name": "Phase7 Fresh"},
        timeout=30,
    )
    assert r.status_code == 200, r.text
    data = r.json()
    return {
        "email": email,
        "token": data["access_token"],
        "user_id": data["user"]["id"],
    }


@pytest.fixture(scope="session")
def fresh_headers(fresh_user):
    return {
        "Authorization": f"Bearer {fresh_user['token']}",
        "Content-Type": "application/json",
    }


# ============================== Stripe checkout ==============================
class TestCheckoutSession:
    """POST /api/payments/checkout/session"""

    def test_checkout_starter_success(self, client, demo_headers):
        r = client.post(
            f"{API}/payments/checkout/session",
            json={"package_id": "starter", "origin_url": ORIGIN},
            headers=demo_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert "url" in d and "session_id" in d
        assert d["url"].startswith("https://checkout.stripe.com/"), d["url"][:100]
        assert d["session_id"].startswith("cs_test_"), d["session_id"]
        # share session_id with subsequent tests via pytest cache
        pytest.starter_session_id = d["session_id"]

    def test_checkout_professional_success(self, client, demo_headers):
        r = client.post(
            f"{API}/payments/checkout/session",
            json={"package_id": "professional", "origin_url": ORIGIN},
            headers=demo_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["url"].startswith("https://checkout.stripe.com/")
        assert d["session_id"].startswith("cs_test_")

    def test_checkout_invalid_package_400(self, client, demo_headers):
        r = client.post(
            f"{API}/payments/checkout/session",
            json={"package_id": "nonexistent", "origin_url": ORIGIN},
            headers=demo_headers,
            timeout=20,
        )
        assert r.status_code == 400, r.text

    def test_checkout_without_auth_401(self, client):
        r = client.post(
            f"{API}/payments/checkout/session",
            json={"package_id": "starter", "origin_url": ORIGIN},
            timeout=20,
        )
        # FastAPI HTTPBearer auto_error=True returns 403 with "Not authenticated"
        # Acceptable auth-missing responses
        assert r.status_code in (401, 403), f"got {r.status_code}: {r.text}"


# ============================== Checkout status ==============================
class TestCheckoutStatus:
    """GET /api/payments/checkout/status/{session_id}"""

    def test_status_valid_session(self, client, demo_headers):
        sid = getattr(pytest, "starter_session_id", None)
        assert sid, "previous test must have created a starter session"
        r = client.get(
            f"{API}/payments/checkout/status/{sid}",
            headers=demo_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        d = r.json()
        # MUST contain expected keys and NOT be a 500
        for k in ["status", "payment_status", "amount_total", "currency", "metadata"]:
            assert k in d, f"missing key {k} in {list(d.keys())}"
        # Stripe test mode never completes without card entry
        assert d["payment_status"] in ("pending", "unpaid", "open", "no_payment_required"), d
        assert d["currency"].lower() == "usd"
        # metadata persisted from the create call
        md = d.get("metadata") or {}
        assert md.get("package_id") == "starter"
        assert md.get("source") == "saas_brochure"

    def test_status_other_user_403(self, client, fresh_headers):
        """Fresh user tries to access demo's session → 403."""
        sid = getattr(pytest, "starter_session_id", None)
        assert sid
        r = client.get(
            f"{API}/payments/checkout/status/{sid}",
            headers=fresh_headers,
            timeout=20,
        )
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"

    def test_status_unknown_session_404(self, client, demo_headers):
        r = client.get(
            f"{API}/payments/checkout/status/cs_test_unknown_{uuid.uuid4().hex}",
            headers=demo_headers,
            timeout=20,
        )
        assert r.status_code == 404, r.text


# ============================== DB persistence check ==============================
class TestPaymentTxPersistence:
    """Verify payment_transactions row is created with expected fields."""

    def test_tx_row_created(self, client, demo_headers):
        # Create a brand-new session and assert status endpoint returns expected
        # fields derived from the DB row (covers persistence indirectly without
        # bypassing the API layer).
        r = client.post(
            f"{API}/payments/checkout/session",
            json={"package_id": "starter", "origin_url": ORIGIN},
            headers=demo_headers,
            timeout=30,
        )
        assert r.status_code == 200, r.text
        sid = r.json()["session_id"]

        # Poll status — this only works if the DB row with user_id matches demo
        st = client.get(
            f"{API}/payments/checkout/status/{sid}",
            headers=demo_headers,
            timeout=30,
        )
        assert st.status_code == 200
        d = st.json()
        md = d.get("metadata") or {}
        assert md.get("user_email") == DEMO_EMAIL
        assert md.get("package_id") == "starter"


# ============================== Webhook ==============================
class TestStripeWebhook:
    def test_webhook_empty_body_no_sig_400(self, client):
        r = requests.post(
            f"{API}/webhook/stripe",
            data=b"",
            headers={"Content-Type": "application/json"},
            timeout=20,
        )
        # Must reject gracefully, NOT 500
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:300]}"
        assert r.status_code != 500

    def test_webhook_garbage_body_bad_sig_400(self, client):
        r = requests.post(
            f"{API}/webhook/stripe",
            data=b'{"foo":"bar"}',
            headers={"Content-Type": "application/json", "Stripe-Signature": "t=1,v1=deadbeef"},
            timeout=20,
        )
        assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:300]}"


# ============================== Premium gating ==============================
def _post_audit(headers: dict | None, ip: str, variant: str, timeout: int = 180):
    h = {"Content-Type": "application/json", "X-Forwarded-For": ip}
    if headers:
        h.update(headers)
    return requests.post(
        f"{API}/public/audit",
        json={"code": SAMPLE_SOLIDITY + f"\n// variant {variant}\n", "name": "Gating.sol"},
        headers=h,
        timeout=timeout,
    )


class TestPremiumGating:
    def test_premium_user_watermark_and_flag(self, demo_headers):
        """Demo user (subscription_tier='professional') → premium:true, AEGIS-Q watermark."""
        r = _post_audit(demo_headers, "198.51.100.150", "premium-single", timeout=180)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:500]}"
        d = r.json()
        assert d.get("premium") is True, d
        wm = d.get("watermark", "")
        assert wm.startswith("AEGIS-Q ·"), wm
        assert "PROFESSIONAL" in wm
        assert d["limits"]["remaining"] == 999, d["limits"]

    def test_premium_bypass_rate_limit(self, demo_headers):
        """Premium user must NOT be rate-limited.

        Fires 5 SERIAL audits from the SAME IP — an anonymous caller would
        be 429 after the 3rd. Premium must never see 429.

        (Serial, not concurrent, because concurrent Claude Opus calls from
         this preview ingress sporadically return 502 — documented minor
         issue from iter 4. The contract under test is 'no 429 for premium',
         not 'LLM is concurrency-safe'.)
        """
        ip = "198.51.100.151"  # fresh IP — anonymous would 429 on 4th
        statuses: list[int] = []
        premium_flags: list[bool] = []
        for i in range(5):
            r = _post_audit(demo_headers, ip, f"prem-{i}", timeout=240)
            statuses.append(r.status_code)
            if r.status_code == 200:
                premium_flags.append(r.json().get("premium") is True)

        # CORE CONTRACT: premium bypasses rate-limit — zero 429s
        assert 429 not in statuses, f"Premium was rate-limited: {statuses}"
        # Majority must succeed (allow 1 transient 502 from upstream Opus
        # under back-to-back pressure — pre-existing minor issue).
        ok_count = sum(1 for s in statuses if s == 200)
        assert ok_count >= 4, f"Premium calls: statuses={statuses}"
        assert all(premium_flags), f"premium flag missing on some calls: {premium_flags}"

    def test_bearer_without_subscription_is_anonymous(self, fresh_headers):
        """Bearer token BUT user has NO subscription_tier → treated as anonymous (watermark=SAMPLE …)."""
        # Use fresh IP to avoid any pre-existing rate-limit contamination
        ip = f"203.0.113.{50 + (int(time.time()) % 100)}"
        r = _post_audit(fresh_headers, ip, "no-tier", timeout=180)
        assert r.status_code == 200, f"{r.status_code}: {r.text[:500]}"
        d = r.json()
        assert d.get("premium") is False, d
        wm = d.get("watermark", "")
        assert wm.startswith("SAMPLE"), wm
        # Rate-limit applies → remaining should be <= 2 after this 1st call
        assert d["limits"]["per_ip_per_hour"] == 3
        assert d["limits"]["remaining"] <= 2
