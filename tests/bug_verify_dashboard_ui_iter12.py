"""
Focused bug verification for Iteration 12: dashboard/topbar framing.

No relevant testing skill found for the French UI framing/dashboard bug.

Scope only:
- /dashboard TopBar visible/sticky and usable at 1440x900 and 1280x800.
- Dashboard savings card has non-zero Ruche data and green sparkline.
- SimulationPanel starts collapsed as a 36x36 top-right FAB under TopBar, with no
  vertical overlap against MarketPulse; clicking the FAB opens the 256px panel.
- LiveActivityTicker placement is bottom-left on the public /la-ruche page.
"""

import asyncio
import json
from pathlib import Path

from playwright.async_api import async_playwright, TimeoutError as PlaywrightTimeoutError


BASE_URL = "https://hybrid-federated-ia.preview.emergentagent.com"
EMAIL = "demo@aegis-q.mil"
PASSWORD = "Aegis2026!"
OUT = Path("/app/test_reports/bug_verify_dashboard_ui_iter12_results.json")


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


async def wait_dashboard_ready(page):
    await page.wait_for_selector('[data-testid="dashboard-savings-card"]', state="visible", timeout=30000)
    await page.wait_for_selector('[data-testid="market-pulse-widget"]', state="visible", timeout=30000)
    # Wait until savings is no longer the loading state and either data or empty state is visible.
    try:
        await page.wait_for_function(
            """() => {
                const s = document.querySelector('[data-testid="dashboard-savings-card"]');
                if (!s) return false;
                const txt = s.innerText || '';
                return txt.includes('Tokens économisés') || txt.includes('Aucune requête');
            }""",
            timeout=30000,
        )
    except PlaywrightTimeoutError:
        pass
    await page.wait_for_timeout(700)


async def collect_metrics(page, width, height):
    await page.set_viewport_size({"width": width, "height": height})
    await page.wait_for_timeout(900)

    metrics = await page.evaluate(
        """() => {
            const rectObj = (el) => {
                if (!el) return null;
                const r = el.getBoundingClientRect();
                return {left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height};
            };
            const isVisible = (el) => {
                if (!el) return false;
                const r = el.getBoundingClientRect();
                const cs = getComputedStyle(el);
                return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && r.bottom > 0 && r.right > 0 && r.left < innerWidth && r.top < innerHeight;
            };
            const intersection = (a,b) => {
                if (!a || !b) return {overlap:false, area:0, width:0, height:0};
                const x = Math.max(0, Math.min(a.right,b.right) - Math.max(a.left,b.left));
                const y = Math.max(0, Math.min(a.bottom,b.bottom) - Math.max(a.top,b.top));
                return {overlap:x*y>0, area:x*y, width:x, height:y};
            };
            const topbar = document.querySelector('[data-testid="topbar"]');
            const search = document.querySelector('[data-testid="topbar-search-input"]');
            const userBtn = document.querySelector('[data-testid="topbar-user-menu-btn"]');
            const badge = Array.from(document.querySelectorAll('[data-slot="badge"], span, div')).find(el => (el.textContent || '').includes('AEGIS MILITARY'));
            const savings = document.querySelector('[data-testid="dashboard-savings-card"]');
            const sparkline = document.querySelector('[data-testid="savings-sparkline"]');
            const sparklinePolyline = sparkline?.querySelector('polyline');
            const market = document.querySelector('[data-testid="market-pulse-widget"]');
            const sim = document.querySelector('[data-testid="simulation-panel"]');
            const ts = topbar ? getComputedStyle(topbar) : null;
            const ss = sim ? getComputedStyle(sim) : null;
            const savingsText = savings ? savings.innerText : '';
            const firstNumber = savingsText.match(/[0-9][0-9\s.,]*/)?.[0] || '';
            const normalizedFirstNumber = Number(firstNumber.replace(/[\s,.]/g, '')) || 0;
            const topbarRect = rectObj(topbar);
            const simRect = rectObj(sim);
            const marketRect = rectObj(market);
            return {
                viewport: {width: innerWidth, height: innerHeight},
                topbar: {visible:isVisible(topbar), position:ts?.position, top:ts?.top, zIndex:ts?.zIndex, rect:topbarRect},
                badge: {visible:isVisible(badge), text:badge?.textContent?.trim()},
                search: {visible:isVisible(search), rect:rectObj(search), placeholder:search?.getAttribute('placeholder')},
                userButton: {visible:isVisible(userBtn), rect:rectObj(userBtn), text:userBtn?.innerText},
                savings: {visible:isVisible(savings), text:savingsText, firstNumber: normalizedFirstNumber, empty:savingsText.includes('Aucune requête') || savingsText.trim() === '0'},
                sparkline: {visible:isVisible(sparkline), stroke:sparklinePolyline?.getAttribute('stroke'), points:sparklinePolyline?.getAttribute('points')},
                marketPulse: {visible:isVisible(market), rect:marketRect},
                simulationPanel: {
                    visible:isVisible(sim), tag:sim?.tagName, title:sim?.getAttribute('title'), text:sim?.innerText || '',
                    position:ss?.position, top:ss?.top, right:ss?.right, zIndex:ss?.zIndex, rect:simRect,
                    collapsed: sim?.tagName === 'BUTTON' && !!sim?.querySelector('svg'),
                    overlapMarket: intersection(simRect, marketRect)
                }
            };
        }"""
    )

    # Prove user menu is actually clickable at this viewport.
    try:
        await page.get_by_test_id("topbar-user-menu-btn").click()
        await page.wait_for_selector('[data-testid="topbar-user-menu"]', state="visible", timeout=5000)
        metrics["userMenuClick"] = await page.evaluate(
            """() => {
                const el = document.querySelector('[data-testid="topbar-user-menu"]');
                const r = el?.getBoundingClientRect();
                return {opened: !!el, rect: r ? {left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height} : null, text: el?.innerText || ''};
            }"""
        )
        await page.keyboard.press("Escape")
        await page.mouse.click(10, 10)
        await page.wait_for_timeout(250)
    except Exception as exc:
        metrics["userMenuClick"] = {"opened": False, "error": repr(exc)}

    # Prove collapsed FAB opens the full panel.
    try:
        await page.get_by_test_id("simulation-panel").click(force=True)
        await page.wait_for_timeout(400)
        metrics["simulationAfterClick"] = await page.evaluate(
            """() => {
                const el = document.querySelector('[data-testid="simulation-panel"]');
                const r = el?.getBoundingClientRect();
                const cs = el ? getComputedStyle(el) : null;
                return {tag: el?.tagName, width: r?.width, height: r?.height, text: el?.innerText || '', position: cs?.position, zIndex: cs?.zIndex, rect: r ? {left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height} : null};
            }"""
        )
        # Collapse again before the next viewport.
        await page.locator('[data-testid="simulation-panel"] >> text=Mode Simulation').click(force=True)
        await page.wait_for_timeout(300)
    except Exception as exc:
        metrics["simulationAfterClick"] = {"opened": False, "error": repr(exc)}

    return metrics


async def collect_ticker(page):
    await page.goto(f"{BASE_URL}/la-ruche", wait_until="domcontentloaded", timeout=60000)
    try:
        await page.wait_for_selector('[data-testid="live-activity-ticker"]', state="visible", timeout=9000)
    except PlaywrightTimeoutError:
        pass
    return await page.evaluate(
        """() => {
            const el = document.querySelector('[data-testid="live-activity-ticker"]');
            if (!el) return {exists:false, visible:false};
            const r = el.getBoundingClientRect();
            const cs = getComputedStyle(el);
            return {exists:true, visible:r.width>0 && r.height>0, left:cs.left, bottom:cs.bottom, zIndex:cs.zIndex, rect:{left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height}, text:el.innerText};
        }"""
    )


async def main():
    results = {"base_url": BASE_URL, "console_errors": [], "page_errors": []}
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        page.on("console", lambda msg: results["console_errors"].append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: results["page_errors"].append(str(exc)))

        await login_if_needed(page)
        await wait_dashboard_ready(page)
        results["dashboard"] = {}
        for label, width, height in [("1440x900", 1440, 900), ("1280x800", 1280, 800), ("1024x768_edge", 1024, 768)]:
            results["dashboard"][label] = await collect_metrics(page, width, height)

        await page.set_viewport_size({"width": 1280, "height": 800})
        await page.goto(f"{BASE_URL}/dashboard", wait_until="domcontentloaded", timeout=60000)
        await wait_dashboard_ready(page)
        before = await page.evaluate("""() => ({top: document.querySelector('[data-testid="topbar"]')?.getBoundingClientRect().top, scrollY: window.scrollY})""")
        await page.evaluate("window.scrollTo(0, 650)")
        await page.wait_for_timeout(500)
        after = await page.evaluate("""() => ({top: document.querySelector('[data-testid="topbar"]')?.getBoundingClientRect().top, scrollY: window.scrollY})""")
        results["sticky_window_scroll"] = {"before": before, "after": after}

        results["ticker"] = await collect_ticker(page)
        await browser.close()

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())