"""
Focused verification script for Iteration 11 dashboard framing bug.

Scope:
- Login as demo@aegis-q.mil and open /dashboard.
- Verify TopBar visibility/sticky behavior at 1440x900, 1280x800, 1024x768.
- Verify Ruche Savings compact widget values and sparkline.
- Verify collapsed SimulationPanel does not overlap Market Pulse.
- Verify LiveActivityTicker placement on /la-ruche (route where it is mounted).

This mirrors the Playwright checks executed via the browser automation tool.
"""

import asyncio
import json
from playwright.async_api import async_playwright


BASE_URL = "https://hybrid-federated-ia.preview.emergentagent.com"
EMAIL = "demo@aegis-q.mil"
PASSWORD = "Aegis2026!"


async def login_if_needed(page):
    await page.goto(f"{BASE_URL}/dashboard", wait_until="domcontentloaded", timeout=60000)
    await page.wait_for_timeout(1000)
    if await page.get_by_test_id("login-page").is_visible(timeout=5000):
        await page.get_by_test_id("login-email-input").fill(EMAIL)
        await page.get_by_test_id("login-password-input").fill(PASSWORD)
        await page.get_by_test_id("login-submit-btn").click()
        await page.wait_for_url("**/dashboard", timeout=30000)
    await page.wait_for_selector('[data-testid="topbar"]', state="visible", timeout=30000)
    try:
        if await page.get_by_test_id("onboarding-tour").is_visible(timeout=1500):
            await page.get_by_test_id("onboarding-skip-btn").click(force=True)
            await page.wait_for_timeout(500)
    except Exception:
        pass


async def collect_dashboard_metrics(page, width, height):
    await page.set_viewport_size({"width": width, "height": height})
    await page.wait_for_timeout(700)
    return await page.evaluate(
        """() => {
            const rectObj = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return {left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height}; };
            const isVisible = (el) => { if (!el) return false; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.bottom > 0 && r.right > 0 && r.left < innerWidth && r.top < innerHeight; };
            const intersection = (a,b) => { if (!a || !b) return {overlap:false, area:0}; const x = Math.max(0, Math.min(a.right,b.right)-Math.max(a.left,b.left)); const y = Math.max(0, Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)); return {overlap:x*y>0, area:x*y, width:x, height:y}; };
            const topbar = document.querySelector('[data-testid="topbar"]');
            const search = document.querySelector('[data-testid="topbar-search-input"]');
            const userBtn = document.querySelector('[data-testid="topbar-user-menu-btn"]');
            const savings = document.querySelector('[data-testid="dashboard-savings-card"]');
            const sparkline = document.querySelector('[data-testid="savings-sparkline"]');
            const market = document.querySelector('[data-testid="market-pulse-widget"]');
            const simLabel = Array.from(document.querySelectorAll('span')).find(el => (el.textContent || '').trim() === 'Mode Simulation');
            const simPanel = simLabel ? simLabel.closest('div.fixed') : null;
            const topStyle = topbar ? getComputedStyle(topbar) : null;
            const savingsText = savings ? savings.innerText : '';
            const simText = simPanel ? simPanel.innerText : '';
            return {
                topbar: {visible:isVisible(topbar), position:topStyle?.position, top:topStyle?.top, zIndex:topStyle?.zIndex, rect:rectObj(topbar)},
                search: {visible:isVisible(search), placeholder:search?.getAttribute('placeholder')},
                userButton: {visible:isVisible(userBtn), text:userBtn?.innerText},
                savings: {visible:isVisible(savings), text:savingsText, empty:savingsText.includes('Aucune requête') || savingsText.trim() === '0'},
                sparkline: {visible:isVisible(sparkline), stroke:sparkline?.querySelector('polyline')?.getAttribute('stroke')},
                marketPulse: {visible:isVisible(market), rect:rectObj(market)},
                simulationPanel: {visible:isVisible(simPanel), collapsed: !!simPanel && !simText.includes('Démarrer') && !simText.includes('Vitesse') && !simText.includes('×1'), rect:rectObj(simPanel), overlapMarket:intersection(rectObj(simPanel), rectObj(market))}
            };
        }"""
    )


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        await login_if_needed(page)
        await page.wait_for_selector('[data-testid="dashboard-savings-card"]', timeout=30000)
        await page.wait_for_timeout(5000)

        results = {}
        for label, w, h in [("1440x900", 1440, 900), ("1280x800", 1280, 800), ("1024x768", 1024, 768)]:
            results[label] = await collect_dashboard_metrics(page, w, h)

        await page.set_viewport_size({"width": 1280, "height": 800})
        before = await page.evaluate("() => ({top: document.querySelector('[data-testid=topbar]').getBoundingClientRect().top, scrollY: window.scrollY})")
        await page.evaluate("window.scrollTo(0, 650)")
        await page.wait_for_timeout(500)
        after = await page.evaluate("() => ({top: document.querySelector('[data-testid=topbar]').getBoundingClientRect().top, scrollY: window.scrollY})")
        results["sticky_window_scroll"] = {"before": before, "after": after}

        await page.goto(f"{BASE_URL}/la-ruche", wait_until="domcontentloaded", timeout=60000)
        await page.wait_for_timeout(2500)
        results["ticker"] = await page.evaluate("""() => { const el = document.querySelector('[data-testid="live-activity-ticker"]'); const r = el?.getBoundingClientRect(); const cs = el ? getComputedStyle(el) : null; return {exists: !!el, visible: !!r && r.width > 0 && r.height > 0, left: cs?.left, bottom: cs?.bottom, zIndex: cs?.zIndex}; }""")
        print(json.dumps(results, ensure_ascii=False, indent=2))
        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())