"""
Page object for the integration tests (IT-01..IT-03).

Same style as the other suites: locator constants plus `driver`-first functions.
Self-contained. The app is React, so inputs are set with a native-setter script
and buttons are clicked via JavaScript.
"""

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


# --- Locators ---------------------------------------------------------------

# Login (app/login/page.tsx)
EMAIL = (By.ID, "email")
PASSWORD = (By.ID, "password")
SUBMIT = (By.CSS_SELECTOR, "button[type=submit]")
NAV_SIGN_OUT = (By.XPATH, "//nav//button[contains(., 'Sign out')]")

# Register (app/register/page.tsx)
REG_FULL_NAME = (By.ID, "fullName")
REG_EMAIL = (By.ID, "email")
REG_PASSWORD = (By.ID, "password")
REG_CONFIRM = (By.ID, "confirmPassword")

# Finance status / assessment (app/status/page.tsx)
MONTH = (By.ID, "month")
FIGURE_IDS = ["revenue", "expenses", "interest", "cash", "assets", "liabilities", "equity"]
SAVE_BUTTON = (By.XPATH, "//button[@type='submit']")
SAVED_BANNER = (By.XPATH, "//span[contains(., 'now scored and in your history')]")

# Dashboard (app/page.tsx, HealthGauge.tsx, TopCards.tsx)
DASHBOARD_READY = (By.XPATH, "//span[contains(., 'Risk Index / 100')]")
# The big number is the span immediately before the "Risk Index / 100" caption.
RISK_INDEX_VALUE = (By.XPATH, "//span[contains(., 'Risk Index / 100')]/preceding-sibling::span[1]")
CARD_TROUBLE = (By.XPATH, "//*[contains(., 'Trouble Risk')]")

# Profile (app/profile/page.tsx)
PROFILE_FULLNAME = (By.ID, "fullName")
PROFILE_EMAIL = (By.ID, "email")

# History (app/history/page.tsx)
HISTORY_H1 = (By.XPATH, "//h1[contains(., 'Prediction history')]")
HISTORY_ROWS = (By.XPATH, "//table//tbody//tr")


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
    el = driver.find_element(*locator)
    driver.execute_script(_SET_VALUE, el, str(value))
    return el


def js_click(driver, locator):
    el = driver.find_element(*locator)
    driver.execute_script("arguments[0].click();", el)
    return el


def wait(driver, timeout=15):
    return WebDriverWait(driver, timeout)


# --- Flows ------------------------------------------------------------------

def login(driver, base_url, email, password, timeout=20):
    driver.get(base_url + "/login")
    wait(driver, timeout).until(EC.visibility_of_element_located(EMAIL))
    set_react_input(driver, EMAIL, email)
    set_react_input(driver, PASSWORD, password)
    js_click(driver, SUBMIT)
    wait(driver, timeout).until(lambda d: "/login" not in d.current_url)
    wait(driver, timeout).until(EC.presence_of_element_located(NAV_SIGN_OUT))


def logout(driver, timeout=20):
    js_click(driver, NAV_SIGN_OUT)
    wait(driver, timeout).until(lambda d: "/login" in d.current_url)


def register(driver, base_url, full_name, email, password, timeout=20):
    driver.get(base_url + "/register")
    wait(driver, timeout).until(EC.visibility_of_element_located(REG_FULL_NAME))
    set_react_input(driver, REG_FULL_NAME, full_name)
    set_react_input(driver, REG_EMAIL, email)
    set_react_input(driver, REG_PASSWORD, password)
    set_react_input(driver, REG_CONFIRM, password)
    js_click(driver, SUBMIT)
    wait(driver, timeout).until(lambda d: "/register" not in d.current_url)
    wait(driver, timeout).until(EC.presence_of_element_located(NAV_SIGN_OUT))


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


def open_profile(driver, base_url):
    driver.get(base_url + "/profile")
    wait(driver).until(EC.visibility_of_element_located(PROFILE_FULLNAME))


def open_history(driver, base_url):
    driver.get(base_url + "/history")
    wait(driver).until(EC.presence_of_element_located(HISTORY_H1))


# --- Cleanup ----------------------------------------------------------------

_DELETE_MONTHS_JS = """
const prefix = arguments[0];
const done = arguments[arguments.length - 1];
fetch('/api/history', { cache: 'no-store' })
  .then(r => r.json())
  .then(async data => {
    const recs = (data.records || []).filter(x => (x.month || '').startsWith(prefix));
    for (const rec of recs) { await fetch('/api/history/' + rec.id, { method: 'DELETE' }); }
    done(recs.length);
  })
  .catch(e => done('error: ' + e));
"""


def delete_months(driver, prefix):
    driver.set_script_timeout(20)
    return driver.execute_async_script(_DELETE_MONTHS_JS, prefix)
