"""Login Module field-level test suite (LG-001 .. LG-021), Google Chrome only.

Uses the repo-root Chrome ``driver`` fixture (see ../conftest.py).

Note on LG-006 / LG-007 (min/max username length): SauceDemo's username field
has no ``maxlength`` attribute and enforces no client-side length limit — it
accepts arbitrarily long input untruncated, and a login only succeeds when the
username exactly matches a known account. Those two cases therefore *document*
this behavior rather than asserting an arbitrary numeric limit.
"""
import pytest
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

import login_page as lp


# LG-001 -- Username field is displayed.
def test_lg_001_username_display(driver):
    lp.open_login(driver)
    assert driver.find_element(*lp.USERNAME).is_displayed()


# LG-002 -- Username field accepts focus.
def test_lg_002_username_focus(driver):
    lp.open_login(driver)
    field = driver.find_element(*lp.USERNAME)
    field.click()
    assert driver.switch_to.active_element == field


# LG-003 -- Valid input can be entered into the Username field.
def test_lg_003_username_valid_input(driver):
    lp.open_login(driver)
    field = lp.enter_username(driver, lp.VALID_USER)
    assert field.get_attribute("value") == lp.VALID_USER


# LG-004 -- Username left empty stays empty after moving focus away.
def test_lg_004_username_empty(driver):
    lp.open_login(driver)
    driver.find_element(*lp.PASSWORD).click()
    assert driver.find_element(*lp.USERNAME).get_attribute("value") == ""


# LG-005 -- Spaces can be entered into the Username field.
def test_lg_005_username_spaces(driver):
    lp.open_login(driver)
    field = lp.enter_username(driver, "   ")
    assert field.get_attribute("value") == "   "


# LG-006 -- Minimum accepted username length (exploratory / documentation).
def test_lg_006_username_min_length(driver):
    lp.open_login(driver)
    field = lp.enter_username(driver, "a")
    # No client-side minimum: a single character is accepted into the field.
    assert field.get_attribute("value") == "a"
    print("\nFINDING LG-006: no client-side minimum length; field accepts 1 char. "
          "Successful login requires an exact valid username, not a length.")


# LG-007 -- Maximum accepted username length (exploratory / documentation).
def test_lg_007_username_max_length(driver):
    lp.open_login(driver)
    long_value = "a" * 300
    field = lp.enter_username(driver, long_value)
    # No maxlength attribute: input is stored untruncated.
    assert field.get_attribute("maxlength") is None
    assert field.get_attribute("value") == long_value
    print(f"\nFINDING LG-007: no client-side maximum length; field stored "
          f"{len(long_value)} chars untruncated (no maxlength attribute).")


# LG-008 -- Password field is displayed.
def test_lg_008_password_display(driver):
    lp.open_login(driver)
    assert driver.find_element(*lp.PASSWORD).is_displayed()


# LG-009 -- Password field accepts focus.
def test_lg_009_password_focus(driver):
    lp.open_login(driver)
    field = driver.find_element(*lp.PASSWORD)
    field.click()
    assert driver.switch_to.active_element == field


# LG-010 -- Valid password is accepted and displayed masked.
def test_lg_010_password_valid_input(driver):
    lp.open_login(driver)
    field = lp.enter_password(driver, lp.VALID_PASS)
    assert field.get_attribute("value") == lp.VALID_PASS
    assert field.get_attribute("type") == "password"  # masked


# LG-011 -- Password left empty stays empty after moving focus away.
def test_lg_011_password_empty(driver):
    lp.open_login(driver)
    driver.find_element(*lp.USERNAME).click()
    assert driver.find_element(*lp.PASSWORD).get_attribute("value") == ""


# LG-012 -- Spaces in the Password field are stored and masked.
def test_lg_012_password_spaces(driver):
    lp.open_login(driver)
    field = lp.enter_password(driver, "   ")
    assert field.get_attribute("value") == "   "
    assert field.get_attribute("type") == "password"  # masked


# LG-013 -- Login button is displayed.
def test_lg_013_login_button_display(driver):
    lp.open_login(driver)
    assert driver.find_element(*lp.LOGIN_BUTTON).is_displayed()


# LG-014 -- Valid credentials log the user into the Inventory Module.
def test_lg_014_valid_login(driver):
    lp.open_login(driver)
    lp.enter_username(driver, lp.VALID_USER)
    lp.enter_password(driver, lp.VALID_PASS)
    lp.click_login(driver)
    WebDriverWait(driver, 10).until(EC.url_contains("inventory.html"))
    assert driver.current_url.endswith("/inventory.html")


# LG-015 -- Invalid credentials show an error message and error icons.
def test_lg_015_invalid_login(driver):
    lp.open_login(driver)
    lp.enter_username(driver, "invalid_user")
    lp.enter_password(driver, "wrong_pass")
    lp.click_login(driver)
    assert lp.error_text(driver) == lp.ERR_NO_MATCH
    assert lp.error_icon_count(driver) >= 1
    assert not driver.current_url.endswith("/inventory.html")


# LG-016 -- Both fields empty show an error message and error icons.
def test_lg_016_empty_fields(driver):
    lp.open_login(driver)
    lp.click_login(driver)
    assert lp.error_text(driver) == lp.ERR_USERNAME_REQUIRED
    assert lp.error_icon_count(driver) >= 1


# LG-017 -- Username empty (password filled) shows the username-required error.
def test_lg_017_username_empty(driver):
    lp.open_login(driver)
    lp.enter_password(driver, lp.VALID_PASS)
    lp.click_login(driver)
    assert lp.error_text(driver) == lp.ERR_USERNAME_REQUIRED
    assert lp.error_icon_count(driver) >= 1


# LG-018 -- Password empty (username filled) shows the password-required error.
def test_lg_018_password_empty(driver):
    lp.open_login(driver)
    lp.enter_username(driver, lp.VALID_USER)
    lp.click_login(driver)
    assert lp.error_text(driver) == lp.ERR_PASSWORD_REQUIRED
    assert lp.error_icon_count(driver) >= 1


# LG-019 -- Spaces in both fields fail with an error message and error icons.
def test_lg_019_spaces_login(driver):
    lp.open_login(driver)
    lp.enter_username(driver, "   ")
    lp.enter_password(driver, "   ")
    lp.click_login(driver)
    assert lp.error_text(driver) == lp.ERR_NO_MATCH
    assert lp.error_icon_count(driver) >= 1


# LG-020 -- Repeated Login-button clicks still log in without odd behavior.
def test_lg_020_multiple_clicks(driver):
    lp.open_login(driver)
    lp.enter_username(driver, lp.VALID_USER)
    lp.enter_password(driver, lp.VALID_PASS)
    button = driver.find_element(*lp.LOGIN_BUTTON)
    for _ in range(5):
        try:
            button.click()
        except Exception:
            break  # navigation started; button is gone
    WebDriverWait(driver, 10).until(EC.url_contains("inventory.html"))
    assert driver.current_url.endswith("/inventory.html")
    assert not driver.find_elements(*lp.ERROR)


# LG-021 -- Error message from an invalid attempt is displayed and readable.
def test_lg_021_error_message_display(driver):
    lp.open_login(driver)
    lp.enter_username(driver, "invalid_user")
    lp.enter_password(driver, "wrong_pass")
    lp.click_login(driver)
    message = lp.error_text(driver)
    assert message.strip()  # non-empty, readable
    error = driver.find_element(*lp.ERROR)
    assert error.is_displayed()
    assert lp.error_icon_count(driver) >= 1


# LG-022 -- Every SauceDemo account logs in with the expected outcome.
# Runs once per accepted username: locked_out_user must be blocked with the
# lockout error and kept on the login page; every other account must reach the
# Inventory Module. (performance_glitch_user lands there after a deliberate
# server-side delay, so this case allows a longer wait.)
@pytest.mark.parametrize("username", lp.ALL_USERS)
def test_lg_022_login_each_user(driver, username):
    lp.open_login(driver)
    lp.enter_username(driver, username)
    lp.enter_password(driver, lp.VALID_PASS)
    lp.click_login(driver)

    if username == lp.LOCKED_OUT_USER:
        assert lp.error_text(driver) == lp.ERR_LOCKED_OUT
        assert lp.error_icon_count(driver) >= 1
        assert not driver.current_url.endswith("/inventory.html")
    else:
        WebDriverWait(driver, 20).until(EC.url_contains("inventory.html"))
        assert driver.current_url.endswith("/inventory.html")
