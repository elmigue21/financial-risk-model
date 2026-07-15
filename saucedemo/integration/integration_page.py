"""Locators and step helpers for cross-module integration journeys (IT-xxx).

Unlike the per-module page objects, these helpers drive the REAL UI transitions
(login -> inventory -> cart -> checkout) without short-circuiting prerequisites,
and they RETURN observed data (product names, prices, badge count) so the tests
can assert that state survives each module boundary -- the point of an
integration test.

Self-contained by the repo's convention: the login/inventory locators are
already duplicated across the login/inventory/cart/checkout page objects, so this
module follows suit rather than reaching across directories. The React-safe
input/click helpers (``_JS_SET_VALUE``, ``js_click``, ``enter_text``) are copied
from ``checkout/checkout_page.py``: SauceDemo's checkout form is React-controlled
and intermittently drops Selenium's synthesized keystrokes and the native submit
click, so text is set through the native setter + an ``input`` event and the
Continue/Finish buttons are activated with a JS click.
"""
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

LOGIN_URL = "https://www.saucedemo.com/v1/"
VALID_USER = "standard_user"
VALID_PASS = "secret_sauce"

# Valid checkout information for the happy path.
VALID_FIRST = "John"
VALID_LAST = "Doe"
VALID_POSTAL = "12345"

# --- Login ----------------------------------------------------------------
USERNAME = (By.ID, "user-name")
PASSWORD = (By.ID, "password")
LOGIN_BUTTON = (By.ID, "login-button")

# --- Inventory ------------------------------------------------------------
INVENTORY_CONTAINER = (By.ID, "inventory_container")
INVENTORY_ITEM = (By.CLASS_NAME, "inventory_item")
CART_BADGE = (By.CLASS_NAME, "shopping_cart_badge")
CART_LINK = (By.CLASS_NAME, "shopping_cart_link")
EXPECTED_ITEM_COUNT = 6
# Relative locators, resolved *within* an .inventory_item / .cart_item element.
_NAME_REL = (By.CLASS_NAME, "inventory_item_name")
_PRICE_REL = (By.CLASS_NAME, "inventory_item_price")
_BUTTON_REL = (By.TAG_NAME, "button")

# --- Cart -----------------------------------------------------------------
CART_CONTAINER = (By.ID, "cart_contents_container")
CART_ITEM = (By.CLASS_NAME, "cart_item")
CART_QUANTITY = (By.CLASS_NAME, "cart_quantity")
CART_REMOVE_BUTTONS = (By.CSS_SELECTOR, "button.cart_button")
CONTINUE_SHOPPING = (By.ID, "continue-shopping")
CHECKOUT_BUTTON = (By.ID, "checkout")

# --- Checkout: Your Information (step one) --------------------------------
FIRST_NAME = (By.ID, "first-name")
LAST_NAME = (By.ID, "last-name")
POSTAL_CODE = (By.ID, "postal-code")
CONTINUE_BUTTON = (By.ID, "continue")

# --- Checkout: Overview (step two) ----------------------------------------
SUBTOTAL_LABEL = (By.CLASS_NAME, "summary_subtotal_label")
TAX_LABEL = (By.CLASS_NAME, "summary_tax_label")
TOTAL_LABEL = (By.CLASS_NAME, "summary_total_label")
FINISH_BUTTON = (By.ID, "finish")

# --- Checkout: Complete ---------------------------------------------------
COMPLETE_HEADER = (By.CLASS_NAME, "complete-header")
BACK_HOME_BUTTON = (By.ID, "back-to-products")

# --- Burger menu ----------------------------------------------------------
MENU_BUTTON = (By.CSS_SELECTOR, ".bm-burger-button")
ALL_ITEMS_LINK = (By.ID, "inventory_sidebar_link")
RESET_LINK = (By.ID, "reset_sidebar_link")
LOGOUT_LINK = (By.ID, "logout_sidebar_link")

# Sets an input's value through the native setter and fires a real ``input``
# event so React's onChange handler commits the value to component state.
_JS_SET_VALUE = (
    "const setter = Object.getOwnPropertyDescriptor("
    "window.HTMLInputElement.prototype, 'value').set;"
    "setter.call(arguments[0], arguments[1]);"
    "arguments[0].dispatchEvent(new Event('input', {bubbles: true}));"
)


def wait(driver, timeout=10):
    return WebDriverWait(driver, timeout)


def js_click(driver, element):
    driver.execute_script("arguments[0].click();", element)


def enter_text(driver, locator, text):
    """Type ``text`` into the field at ``locator`` (React-safe)."""
    field = wait(driver).until(EC.visibility_of_element_located(locator))
    driver.execute_script(_JS_SET_VALUE, field, text)
    return field


def _price(text):
    """'$29.99' -> 29.99."""
    return float(text.replace("$", "").strip())


def money(text):
    """Extract the amount from a label like 'Item total: $29.99' -> 29.99."""
    return float(text.split("$")[1])


# --- Login / navigation ---------------------------------------------------
def login(driver):
    """Drive the login form and land on the inventory page."""
    driver.get(LOGIN_URL)
    wait(driver).until(EC.visibility_of_element_located(USERNAME)).send_keys(VALID_USER)
    driver.find_element(*PASSWORD).send_keys(VALID_PASS)
    driver.find_element(*LOGIN_BUTTON).click()
    wait(driver).until(EC.url_contains("inventory.html"))
    wait(driver).until(EC.visibility_of_element_located(INVENTORY_CONTAINER))


def badge_count(driver):
    """Return the cart-badge number, or 0 when no badge is shown."""
    badges = driver.find_elements(*CART_BADGE)
    return int(badges[0].text) if badges and badges[0].text.strip() else 0


def open_cart(driver):
    driver.find_element(*CART_LINK).click()
    wait(driver).until(EC.url_contains("cart.html"))
    wait(driver).until(EC.visibility_of_element_located(CART_CONTAINER))


def continue_shopping(driver):
    driver.find_element(*CONTINUE_SHOPPING).click()
    wait(driver).until(EC.url_contains("inventory.html"))
    wait(driver).until(EC.visibility_of_element_located(INVENTORY_CONTAINER))


# --- Inventory ------------------------------------------------------------
def inventory_items(driver):
    return driver.find_elements(*INVENTORY_ITEM)


def _item_name(item):
    return item.find_element(*_NAME_REL).text.strip()


def is_remove_button(button):
    """True when the item's button is in the 'Remove' state (btn_secondary)."""
    return "btn_secondary" in (button.get_attribute("class") or "")


def item_button_by_name(driver, name):
    """Return the add/remove button for the inventory item titled ``name``."""
    for item in inventory_items(driver):
        if _item_name(item) == name:
            return item.find_element(*_BUTTON_REL)
    raise AssertionError(f"inventory item not found: {name!r}")


def add_item(driver, index):
    """Add the inventory item at ``index``; return its (name, price)."""
    item = inventory_items(driver)[index]
    name = _item_name(item)
    price = _price(item.find_element(*_PRICE_REL).text)
    item.find_element(*_BUTTON_REL).click()
    return name, price


def add_items(driver, count):
    """Add the first ``count`` items; return a list of (name, price)."""
    return [add_item(driver, i) for i in range(count)]


# --- Cart / checkout rows -------------------------------------------------
def _rows(driver):
    """Read (name, price, qty) for every .cart_item on the current page.

    Works on both the Cart page and the Checkout Overview page -- they share
    the .cart_item / .inventory_item_name / .inventory_item_price structure.
    """
    rows = []
    for item in driver.find_elements(*CART_ITEM):
        rows.append(
            {
                "name": item.find_element(*_NAME_REL).text.strip(),
                "price": _price(item.find_element(*_PRICE_REL).text),
                "qty": item.find_element(*CART_QUANTITY).text.strip(),
            }
        )
    return rows


cart_rows = _rows
overview_rows = _rows


def cart_items(driver):
    return driver.find_elements(*CART_ITEM)


def remove_first_in_cart(driver):
    """Click the first Remove button on the cart page and wait for it to go."""
    before = len(cart_items(driver))
    driver.find_elements(*CART_REMOVE_BUTTONS)[0].click()
    wait(driver).until(lambda d: len(cart_items(d)) < before)


# --- Checkout -------------------------------------------------------------
def start_checkout(driver):
    driver.find_element(*CHECKOUT_BUTTON).click()
    wait(driver).until(EC.url_contains("checkout-step-one.html"))
    wait(driver).until(EC.visibility_of_element_located(FIRST_NAME))


def fill_information(driver, first=VALID_FIRST, last=VALID_LAST, postal=VALID_POSTAL):
    enter_text(driver, FIRST_NAME, first)
    enter_text(driver, LAST_NAME, last)
    enter_text(driver, POSTAL_CODE, postal)


def continue_to_overview(driver):
    js_click(driver, driver.find_element(*CONTINUE_BUTTON))
    wait(driver).until(EC.url_contains("checkout-step-two.html"))
    wait(driver).until(EC.visibility_of_element_located(TOTAL_LABEL))


def subtotal(driver):
    return money(driver.find_element(*SUBTOTAL_LABEL).text)


def tax(driver):
    return money(driver.find_element(*TAX_LABEL).text)


def total(driver):
    return money(driver.find_element(*TOTAL_LABEL).text)


def finish_order(driver):
    js_click(driver, driver.find_element(*FINISH_BUTTON))
    wait(driver).until(EC.url_contains("checkout-complete.html"))
    wait(driver).until(EC.visibility_of_element_located(COMPLETE_HEADER))


def back_home(driver):
    js_click(driver, driver.find_element(*BACK_HOME_BUTTON))
    wait(driver).until(EC.url_contains("inventory.html"))
    wait(driver).until(EC.visibility_of_element_located(INVENTORY_CONTAINER))


# --- Burger menu (react-burger-menu) --------------------------------------
def open_menu(driver):
    """Open the burger panel and wait for the slide animation to finish."""
    driver.find_element(*MENU_BUTTON).click()
    wait(driver).until(EC.visibility_of_element_located(ALL_ITEMS_LINK))


def click_menu_link(driver, locator):
    """JS-click a menu link (the sliding overlay swallows native clicks)."""
    driver.execute_script("arguments[0].click();", driver.find_element(*locator))


def reset_app_state(driver):
    open_menu(driver)
    click_menu_link(driver, RESET_LINK)


def logout(driver):
    open_menu(driver)
    click_menu_link(driver, LOGOUT_LINK)
    wait(driver).until(EC.visibility_of_element_located(USERNAME))
