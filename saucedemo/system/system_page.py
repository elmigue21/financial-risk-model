"""Locators and end-to-end step helpers for the System test suite (ST-xxx).

System testing validates the complete, integrated application against user-level
requirements: whole workflows a real shopper performs (log in, browse/sort, build
a cart, check out, pay, log out) rather than a single module or a single pair of
modules. These helpers therefore drive the real UI end to end and expose the
observable outcomes (product identity/price, cart-badge count, order totals,
confirmation) the tests assert on.

Self-contained by the repo's convention (locators are duplicated per suite). The
React-safe input/click helpers (``_JS_SET_VALUE``, ``js_click``, ``enter_text``)
are the same technique used by ``checkout``/``integration``: SauceDemo's checkout
form is React-controlled and intermittently drops Selenium's synthesized keystrokes
and the native submit click, so text is set via the native setter + an ``input``
event and Continue/Finish/Cancel/Back-Home are activated with a JS click.
"""
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support.ui import Select
from selenium.webdriver.support import expected_conditions as EC

LOGIN_URL = "https://www.saucedemo.com/v1/"
VALID_USER = "standard_user"
VALID_PASS = "secret_sauce"
LOCKED_OUT_USER = "locked_out_user"

# Valid checkout information for the happy path.
VALID_FIRST = "John"
VALID_LAST = "Doe"
VALID_POSTAL = "12345"

# --- Login ----------------------------------------------------------------
USERNAME = (By.ID, "user-name")
PASSWORD = (By.ID, "password")
LOGIN_BUTTON = (By.ID, "login-button")
ERROR = (By.CSS_SELECTOR, "[data-test='error']")
ERR_LOCKED_OUT = "Epic sadface: Sorry, this user has been locked out."

# --- Inventory ------------------------------------------------------------
INVENTORY_CONTAINER = (By.ID, "inventory_container")
INVENTORY_ITEM = (By.CLASS_NAME, "inventory_item")
CART_BADGE = (By.CLASS_NAME, "shopping_cart_badge")
CART_LINK = (By.CLASS_NAME, "shopping_cart_link")
SORT_SELECT = (By.CLASS_NAME, "product_sort_container")
EXPECTED_ITEM_COUNT = 6
_NAME_REL = (By.CLASS_NAME, "inventory_item_name")
_PRICE_REL = (By.CLASS_NAME, "inventory_item_price")
_BUTTON_REL = (By.TAG_NAME, "button")
ITEM_PRICE = (By.CLASS_NAME, "inventory_item_price")

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
CANCEL_BUTTON = (By.ID, "cancel")

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
RESET_LINK = (By.ID, "reset_sidebar_link")
LOGOUT_LINK = (By.ID, "logout_sidebar_link")

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
    field = wait(driver).until(EC.visibility_of_element_located(locator))
    driver.execute_script(_JS_SET_VALUE, field, text)
    return field


def _price(text):
    return float(text.replace("$", "").strip())


def money(text):
    """'Item total: $29.99' -> 29.99."""
    return float(text.split("$")[1])


# --- Login ----------------------------------------------------------------
def attempt_login(driver, user=VALID_USER, password=VALID_PASS):
    """Submit the login form; does NOT assume success (for negative cases)."""
    driver.get(LOGIN_URL)
    wait(driver).until(EC.visibility_of_element_located(USERNAME)).send_keys(user)
    driver.find_element(*PASSWORD).send_keys(password)
    driver.find_element(*LOGIN_BUTTON).click()


def login(driver, user=VALID_USER, password=VALID_PASS):
    """Log in and land on the inventory page."""
    attempt_login(driver, user, password)
    wait(driver).until(EC.url_contains("inventory.html"))
    wait(driver).until(EC.visibility_of_element_located(INVENTORY_CONTAINER))


def login_error(driver):
    return wait(driver).until(EC.visibility_of_element_located(ERROR)).text


# --- Inventory ------------------------------------------------------------
def inventory_items(driver):
    return driver.find_elements(*INVENTORY_ITEM)


def _item_name(item):
    return item.find_element(*_NAME_REL).text.strip()


def add_item(driver, index):
    """Add the inventory item at ``index``; return its (name, price)."""
    item = inventory_items(driver)[index]
    name = _item_name(item)
    price = _price(item.find_element(*_PRICE_REL).text)
    item.find_element(*_BUTTON_REL).click()
    return name, price


def add_items(driver, count):
    return [add_item(driver, i) for i in range(count)]


def sort_by(driver, value):
    """Sort the inventory: 'az', 'za', 'lohi', 'hilo'."""
    Select(driver.find_element(*SORT_SELECT)).select_by_value(value)


def prices(driver):
    return [_price(p.text) for p in driver.find_elements(*ITEM_PRICE)]


def badge_count(driver):
    badges = driver.find_elements(*CART_BADGE)
    return int(badges[0].text) if badges and badges[0].text.strip() else 0


# --- Cart -----------------------------------------------------------------
def open_cart(driver):
    driver.find_element(*CART_LINK).click()
    wait(driver).until(EC.url_contains("cart.html"))
    wait(driver).until(EC.visibility_of_element_located(CART_CONTAINER))


def continue_shopping(driver):
    driver.find_element(*CONTINUE_SHOPPING).click()
    wait(driver).until(EC.url_contains("inventory.html"))
    wait(driver).until(EC.visibility_of_element_located(INVENTORY_CONTAINER))


def cart_items(driver):
    return driver.find_elements(*CART_ITEM)


def cart_rows(driver):
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


def remove_first_in_cart(driver):
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


def cancel_checkout(driver):
    js_click(driver, driver.find_element(*CANCEL_BUTTON))
    wait(driver).until(EC.url_contains("cart.html"))
    wait(driver).until(EC.visibility_of_element_located(CART_CONTAINER))


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


def complete_message(driver):
    return driver.find_element(*COMPLETE_HEADER).text.strip()


def back_home(driver):
    js_click(driver, driver.find_element(*BACK_HOME_BUTTON))
    wait(driver).until(EC.url_contains("inventory.html"))
    wait(driver).until(EC.visibility_of_element_located(INVENTORY_CONTAINER))


# --- Burger menu ----------------------------------------------------------
def open_menu(driver):
    driver.find_element(*MENU_BUTTON).click()
    wait(driver).until(EC.visibility_of_element_located(RESET_LINK))


def reset_app_state(driver):
    open_menu(driver)
    js_click(driver, driver.find_element(*RESET_LINK))


def logout(driver):
    open_menu(driver)
    js_click(driver, driver.find_element(*LOGOUT_LINK))
    wait(driver).until(EC.visibility_of_element_located(USERNAME))


def purchase(driver):
    """Walk the standard checkout->complete tail from the cart page."""
    start_checkout(driver)
    fill_information(driver)
    continue_to_overview(driver)
    finish_order(driver)
