"""
Page object for the Financial Health Check app.

Follows the saucedemo convention: a module of locator constants plus plain
functions that take `driver` first — no classes. Every function that navigates
takes `base_url` so the target host is configurable (see --base-url).

The app is React (Next.js). Two things matter for driving it reliably:
  * Typing with send_keys can be dropped by React's controlled inputs, so we set
    values with a native-setter script that also fires an `input` event.
  * Clicks are done via JS to avoid the occasional no-op on React-managed buttons.
This mirrors saucedemo/checkout/checkout_page.py.
"""

from pathlib import Path

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


# --- Locators ---------------------------------------------------------------

# Login (app/login/page.tsx)
EMAIL = (By.ID, "email")
PASSWORD = (By.ID, "password")
SUBMIT = (By.CSS_SELECTOR, "button[type=submit]")

# The nav's sign-out button only renders when signed in — a reliable "I am
# authenticated" signal (app/components/Nav.tsx).
NAV_SIGN_OUT = (By.XPATH, "//button[contains(., 'Sign out')]")

# Finance status / prediction form (app/status/page.tsx)
MONTH = (By.ID, "month")
FIGURE_IDS = ["revenue", "expenses", "interest", "cash", "assets", "liabilities", "equity"]
SAVE_BUTTON = (By.XPATH, "//button[@type='submit']")
# Use contains(., ...) not contains(text(), ...): the banner interpolates the
# month ("Saved {month}. It's now scored…"), so it's several text nodes and
# text() would only see the first ("Saved "). "." matches the concatenated text.
SAVED_BANNER = (By.XPATH, "//span[contains(., 'now scored and in your history')]")

# Dashboard (app/page.tsx + components/HealthGauge.tsx). The gauge caption only
# appears once a real assessment has rendered, so it marks "dashboard is ready".
DASHBOARD_READY = (By.XPATH, "//span[contains(., 'Risk Index / 100')]")

# Report export buttons (app/components/ReportHeader.tsx)
EXPORT_CSV = (By.XPATH, "//button[contains(., 'Export CSV')]")
EXPORT_PDF = (By.XPATH, "//button[contains(., 'Export PDF')]")

# AI advisor chat (app/components/AdvisorChat.tsx). The input and Send button are
# disabled while a reply is streaming, so is_enabled() tells us when it's idle.
ADVISOR_INPUT = (By.XPATH, "//input[contains(@placeholder, 'Type your answer')]")
ADVISOR_SEND = (By.XPATH, "//button[normalize-space()='Send']")
# Advisor (assistant) messages use the mr-auto bubble; user messages use ml-auto.
ASSISTANT_BUBBLES = (By.XPATH, "//div[contains(@class, 'mr-auto')]")


# A single, internally consistent month of figures for the prediction test.
# assets == liabilities + equity so the form's balance check passes and the
# save button isn't disabled (app/status/page.tsx validation).
BALANCED_FIGURES = {
    "revenue": 78000,
    "expenses": 63000,
    "interest": 1200,
    "cash": 56000,
    "assets": 285000,
    "liabilities": 130000,
    "equity": 155000,
}


# --- React-safe primitives --------------------------------------------------

_SET_VALUE = """
const el = arguments[0], value = arguments[1];
const proto = el.tagName === 'TEXTAREA'
  ? window.HTMLTextAreaElement.prototype
  : window.HTMLInputElement.prototype;
const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
setter.call(el, value);
el.dispatchEvent(new Event('input', { bubbles: true }));
el.dispatchEvent(new Event('change', { bubbles: true }));
"""


def set_react_input(driver, locator, value):
    """Set a controlled input's value the way React expects."""
    el = driver.find_element(*locator)
    driver.execute_script(_SET_VALUE, el, str(value))
    return el


def js_click(driver, locator):
    """Click via JS to avoid React click no-ops."""
    el = driver.find_element(*locator)
    driver.execute_script("arguments[0].click();", el)
    return el


def wait(driver, timeout=15):
    return WebDriverWait(driver, timeout)


# --- Flows ------------------------------------------------------------------

def login(driver, base_url, email, password, timeout=20):
    """Sign in and wait until the app confirms an authenticated session."""
    driver.get(base_url + "/login")
    wait(driver, timeout).until(EC.visibility_of_element_located(EMAIL))
    set_react_input(driver, EMAIL, email)
    set_react_input(driver, PASSWORD, password)
    js_click(driver, SUBMIT)
    wait(driver, timeout).until(lambda d: "/login" not in d.current_url)
    wait(driver, timeout).until(EC.presence_of_element_located(NAV_SIGN_OUT))


def logout_clientside(driver, base_url):
    """Drop the session cookie and return to a signed-out /login page."""
    driver.delete_all_cookies()
    driver.get(base_url + "/login")
    wait(driver).until(EC.visibility_of_element_located(EMAIL))


def open_status(driver, base_url):
    driver.get(base_url + "/status")
    wait(driver).until(EC.visibility_of_element_located(MONTH))


def fill_month(driver, month, figures=None):
    figures = figures or BALANCED_FIGURES
    set_react_input(driver, MONTH, month)
    for key in FIGURE_IDS:
        set_react_input(driver, (By.ID, key), figures[key])


def submit_score(driver):
    js_click(driver, SAVE_BUTTON)


def wait_saved(driver, timeout=20):
    wait(driver, timeout).until(EC.visibility_of_element_located(SAVED_BANNER))


def open_dashboard(driver, base_url):
    driver.get(base_url + "/")


def wait_dashboard_ready(driver, timeout=15):
    wait(driver, timeout).until(EC.presence_of_element_located(DASHBOARD_READY))


def click_export(driver, kind):
    js_click(driver, EXPORT_PDF if kind == "pdf" else EXPORT_CSV)


def wait_advisor_idle(driver, timeout=90):
    """Wait until the advisor is present and not mid-reply (input enabled)."""
    wait(driver, timeout).until(
        lambda d: d.find_elements(*ADVISOR_INPUT) and d.find_element(*ADVISOR_INPUT).is_enabled()
    )


def wait_advisor_reply(driver, count_before, timeout=90):
    """
    Wait until the advisor has finished a new reply and return its text.
    Complete means: a new assistant bubble exists, the input is enabled again
    (streaming stopped), and the bubble has text.
    """
    def done(d):
        bubbles = d.find_elements(*ASSISTANT_BUBBLES)
        if len(bubbles) <= count_before:
            return False
        if not d.find_element(*ADVISOR_INPUT).is_enabled():  # still streaming
            return False
        text = bubbles[-1].text.strip()
        return text or False

    return wait(driver, timeout).until(done)


# --- Downloads --------------------------------------------------------------

def clear_downloads(download_dir):
    for f in Path(download_dir).glob("*"):
        try:
            f.unlink()
        except OSError:
            pass


def wait_for_download(driver, download_dir, suffix, timeout=30):
    """
    Wait until a completed file with `suffix` appears in the download dir.
    Chrome writes a `.crdownload` placeholder while downloading, so a real file
    without that extension means the download finished. Uses WebDriverWait so
    we poll rather than sleep (matching the suite's no-sleep convention).
    """
    folder = Path(download_dir)

    def finished(_):
        done = [
            f
            for f in folder.glob(f"*{suffix}")
            if not f.name.endswith(".crdownload")
        ]
        return done[0] if done else False

    return WebDriverWait(driver, timeout, poll_frequency=0.2).until(finished)


# --- Cleanup ----------------------------------------------------------------

_DELETE_MONTHS_JS = """
const prefix = arguments[0];
const done = arguments[arguments.length - 1];
fetch('/api/history', { cache: 'no-store' })
  .then(r => r.json())
  .then(async data => {
    const recs = (data.records || []).filter(x => (x.month || '').startsWith(prefix));
    for (const rec of recs) {
      await fetch('/api/history/' + rec.id, { method: 'DELETE' });
    }
    done(recs.length);
  })
  .catch(e => done('error: ' + e));
"""


def delete_months(driver, prefix):
    """
    Delete the signed-in user's records whose month starts with `prefix`.
    Runs inside the browser so it reuses the session cookie. Used to clean up
    the throwaway months the prediction test creates.
    """
    driver.set_script_timeout(20)
    return driver.execute_async_script(_DELETE_MONTHS_JS, prefix)
