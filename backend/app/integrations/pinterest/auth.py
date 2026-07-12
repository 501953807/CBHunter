"""Pinterest Trends authentication — Playwright login to extract session cookies.

Design:
  - Playwright used ONLY for initial login / cookie refresh (not daily data collection)
  - Cookies cached in system_config table with expiry tracking
  - Fetcher.py uses cached cookies for all API calls
  - Auto-refresh when cookies expire or API returns 401
"""

import asyncio
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

# Cookies typically needed for Pinterest sessions
COOKIE_NAMES = ["_pinterest_sess", "csrftoken", "_auth", "_b", "p", "ar_debug"]
COOKIE_CACHE_KEY = "pinterest_cookies"
COOKIE_EXPIRY_HOURS = 6  # Pinterest sessions typically last several hours

try:
    from playwright.async_api import async_playwright, TimeoutError as PwTimeout
    HAS_PLAYWRIGHT = True
except ImportError:
    HAS_PLAYWRIGHT = False


async def login(email: str, password: str, headless: bool = True) -> Optional[list[dict]]:
    """Log into Pinterest and extract session cookies.

    Uses Playwright to automate the Pinterest login flow:
    1. Navigate to trends.pinterest.com (redirects to login if not authenticated)
    2. Click "Log in" / "登录" button
    3. Fill email + password
    4. Submit login form
    5. Wait for redirect back to trends.pinterest.com
    6. Extract all session cookies

    Returns list of cookie dicts compatible with httpx, or None on failure.
    """
    if not HAS_PLAYWRIGHT:
        logger.error(
            "Playwright not installed. Run:\n"
            "  pip install playwright --break-system-packages\n"
            "  playwright install chromium"
        )
        return None

    cookies = None
    browser = None

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=headless,
                args=["--no-sandbox", "--disable-setuid-sandbox"],
            )
            context = await browser.new_context(
                viewport={"width": 1280, "height": 800},
                user_agent=(
                    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
                ),
            )
            page = await context.new_page()

            # ── Step 1: Navigate to Pinterest Trends ──
            logger.info("Step 1: Navigating to Pinterest Trends...")
            await page.goto(
                "https://trends.pinterest.com/",
                wait_until="networkidle",
                timeout=45000,
            )

            # Check if we're already logged in (no login wall)
            current_url = page.url
            if "trends.pinterest.com" in current_url and "login" not in current_url:
                logger.info("Already on trends page — may already be logged in")
                raw = await context.cookies()
                cookies = _extract_cookies(raw)
                if _has_auth_cookies(cookies):
                    logger.info(f"Found {len(cookies)} existing cookies — reusing session")
                    return cookies

            # ── Step 2: Find and click the login link ──
            logger.info("Step 2: Finding login button...")
            login_clicked = await _click_login_button(page)
            if not login_clicked:
                # Try navigating directly to Pinterest login
                logger.info("Could not find login link on trends page — navigating to pinterest.com login")
                await page.goto(
                    "https://www.pinterest.com/login/",
                    wait_util="networkidle",
                    timeout=30000,
                )

            # ── Step 3: Fill login form ──
            logger.info("Step 3: Filling login credentials...")
            await _fill_login_form(page, email, password)

            # ── Step 4: Submit and wait for redirect ──
            logger.info("Step 4: Submitting login...")
            try:
                submit_btn = await _find_submit_button(page)
                if submit_btn:
                    await submit_btn.click()
                else:
                    # Try pressing Enter on password field
                    await page.keyboard.press("Enter")
            except Exception as e:
                logger.warning(f"Submit click failed, trying Enter: {e}")
                await page.keyboard.press("Enter")

            # Wait for navigation
            try:
                await page.wait_for_url(
                    "https://trends.pinterest.com/**",
                    timeout=20000,
                )
                logger.info("Redirected to trends.pinterest.com — login successful")
            except PwTimeout:
                # Check if we ended up at a different Pinterest page
                current_url = page.url
                if "pinterest.com" in current_url and "login" not in current_url.lower():
                    logger.info(f"Login appears successful but redirected to: {current_url}")
                    # Navigate to trends explicitly
                    await page.goto(
                        "https://trends.pinterest.com/",
                        wait_until="networkidle",
                        timeout=20000,
                    )
                else:
                    logger.error(f"Login may have failed — current URL: {current_url}")
                    # Capture screenshot for debugging
                    try:
                        await page.screenshot(path="/tmp/pinterest_login_fail.png")
                        logger.info("Screenshot saved to /tmp/pinterest_login_fail.png")
                    except Exception as screenshot_exc:
                        logger.debug("Failed to capture Pinterest login screenshot: %s", screenshot_exc)
                    return None

            # ── Step 5: Extract cookies ──
            raw_cookies = await context.cookies()
            cookies = _extract_cookies(raw_cookies)
            logger.info(f"Extracted {len(cookies)} cookies from Pinterest session")

    except Exception as e:
        logger.error(f"Pinterest login failed: {e}", exc_info=True)
    finally:
        if browser:
            await browser.close()

    return cookies


async def login_and_get_session_string(email: str, password: str) -> Optional[str]:
    """Convenience: login and return semicolon-joined cookie string for HTTP headers."""
    cookies = await login(email, password, headless=True)
    if not cookies:
        return None
    return _cookies_to_string(cookies)


async def get_cached_cookies(db=None, email: str = "", password: str = "") -> Optional[str]:
    """Get Pinterest cookies from cache, or login if expired/not found.

    If db is provided, reads/writes the cached cookie string from system_config.
    Otherwise, performs a fresh login each time.

    Returns cookie string for HTTP header, or None if login fails.
    """
    cookie_str = None

    # Try to read from cache
    if db is not None:
        try:
            from app.services.system_config_service import get_config
            cached = await get_config(db, COOKIE_CACHE_KEY)
            if cached:
                try:
                    data = json.loads(cached)
                    expiry_str = data.get("expires_at")
                    if expiry_str:
                        expiry = datetime.fromisoformat(expiry_str)
                        if datetime.now(timezone.utc) < expiry:
                            logger.info("Using cached Pinterest cookies")
                            return data["cookies"]
                except (json.JSONDecodeError, KeyError, ValueError) as cache_exc:
                    logger.debug("Ignoring invalid Pinterest cookie cache: %s", cache_exc)
            logger.info("Pinterest cookie cache expired or missing — re-logging in")
        except Exception as e:
            logger.warning(f"Failed to read cookie cache: {e}")

    # Fresh login
    if not email or not password:
        return None

    cookie_str = await login_and_get_session_string(email, password)
    if not cookie_str:
        return None

    # Save to cache
    if db is not None and cookie_str:
        try:
            from app.models.system_config import SystemConfig
            from sqlalchemy import select
            from app.utils.encryption import encrypt
            expiry = (datetime.now(timezone.utc) + timedelta(hours=COOKIE_EXPIRY_HOURS)).isoformat()
            cache_data = json.dumps({"cookies": cookie_str, "expires_at": expiry})
            encrypted = encrypt(cache_data)

            result = await db.execute(
                select(SystemConfig).where(SystemConfig.key == COOKIE_CACHE_KEY)
            )
            row = result.scalar_one_or_none()
            if row:
                row.value = encrypted
            else:
                db.add(SystemConfig(key=COOKIE_CACHE_KEY, value=encrypted, label="Pinterest Session Cookie (Auto)"))
            await db.commit()
            logger.info(f"Pinterest cookies cached (expires: {expiry})")
        except Exception as e:
            logger.warning(f"Failed to cache Pinterest cookies: {e}")

    return cookie_str


async def clear_cached_cookies(db) -> bool:
    """Clear cached Pinterest cookies (force re-login on next use)."""
    try:
        from app.models.system_config import SystemConfig
        from sqlalchemy import select, delete
        result = await db.execute(
            select(SystemConfig).where(SystemConfig.key == COOKIE_CACHE_KEY)
        )
        row = result.scalar_one_or_none()
        if row:
            await db.delete(row)
            await db.commit()
            logger.info("Pinterest cookie cache cleared")
        return True
    except Exception as e:
        logger.error(f"Failed to clear cookie cache: {e}")
        return False


# ── Internal Helpers ──────────────────────────────────────────

def _extract_cookies(raw_cookies: list) -> list[dict]:
    """Extract relevant cookies from Playwright's cookie output."""
    cookies = []
    for c in raw_cookies:
        domain = c.get("domain", "")
        if "pinterest" not in domain and domain != ".pinterest.com":
            continue
        cookies.append({
            "name": c["name"],
            "value": c["value"],
            "domain": domain,
            "path": c.get("path", "/"),
        })
    return cookies


def _cookies_to_string(cookies: list[dict]) -> str:
    """Convert cookie dicts to semicolon-separated string for HTTP headers."""
    return "; ".join(f"{c['name']}={c['value']}" for c in cookies)


def _has_auth_cookies(cookies: list[dict]) -> bool:
    """Check if cookies contain authentication-related entries."""
    auth_names = {"_auth", "_pinterest_sess", "csrftoken"}
    found = {c["name"] for c in cookies}
    return bool(found & auth_names)


async def _click_login_button(page) -> bool:
    """Try multiple strategies to click the Pinterest login button."""
    strategies = [
        # Strategy 1: Link with "Log in" text (English)
        lambda: page.get_by_role("link").filter(has_text="Log in"),
        # Strategy 2: Button with "Log in" text
        lambda: page.get_by_role("button").filter(has_text="Log in"),
        # Strategy 3: Link containing "login" in href
        lambda: page.locator('a[href*="login"]').first,
        # Strategy 4: Direct text locator
        lambda: page.get_by_text("Log in", exact=True),
        # Strategy 5: Chinese
        lambda: page.get_by_role("link").filter(has_text="登录"),
    ]

    for i, strategy in enumerate(strategies):
        try:
            el = strategy()
            if await el.is_visible(timeout=2000):
                await el.click()
                await page.wait_for_load_state("networkidle", timeout=10000)
                logger.info(f"Login button clicked via strategy {i+1}")
                return True
        except Exception as exc:
            logger.debug("Pinterest login button strategy failed: %s", exc)
            continue

    logger.warning("Could not find Pinterest login button via any strategy")
    return False


async def _fill_login_form(page, email: str, password: str):
    """Fill the Pinterest login form using multiple selector strategies."""
    # Email field
    email_selectors = [
        page.get_by_test_id("emailInputField"),
        page.get_by_placeholder("Email"),
        page.locator('input[name="id"]'),
        page.locator('input[type="email"]'),
        page.locator('#email'),
    ]
    for sel in email_selectors:
        try:
            if await sel.is_visible(timeout=2000):
                await sel.fill(email)
                logger.info("Email field filled")
                break
        except Exception as exc:
            logger.debug("Pinterest email selector failed: %s", exc)
            continue

    # Password field
    pwd_selectors = [
        page.get_by_test_id("passwordInputField"),
        page.get_by_placeholder("Password"),
        page.locator('input[name="password"]'),
        page.locator('input[type="password"]'),
        page.locator('#password'),
    ]
    for sel in pwd_selectors:
        try:
            if await sel.is_visible(timeout=2000):
                await sel.fill(password)
                logger.info("Password field filled")
                break
        except Exception as exc:
            logger.debug("Pinterest password selector failed: %s", exc)
            continue


async def _find_submit_button(page):
    """Find the login submit button using multiple strategies."""
    strategies = [
        # Strategy 1: Button with "Log in" text
        lambda: page.get_by_role("button").filter(has_text="Log in"),
        # Strategy 2: Submit button by type
        lambda: page.locator('button[type="submit"]').first,
        # Strategy 3: Button by test id
        lambda: page.get_by_test_id("registerFormSubmitButton"),
        # Strategy 4: General login button
        lambda: page.locator('button:has-text("Log in")').first,
        # Strategy 5: Chinese
        lambda: page.get_by_role("button").filter(has_text="登录"),
    ]

    for strategy in strategies:
        try:
            el = strategy()
            if await el.is_visible(timeout=2000):
                return el
        except Exception as exc:
            logger.debug("Pinterest submit selector failed: %s", exc)
            continue

    return None


async def test_cookies(cookie_str: str, keyword: str = "dress") -> bool:
    """Test if a cookie string is valid by making a test API call."""
    from app.integrations.pinterest.fetcher import fetch_keyword_metrics

    try:
        data = await fetch_keyword_metrics([keyword], "US", days=30, cookie_str=cookie_str)
        return len(data) > 0
    except Exception as exc:
        logger.debug("Pinterest cookie validation failed: %s", exc)
        return False
