"""System test suite (ST-001 .. ST-010).

System testing exercises the complete, integrated application against user-level
requirements -- whole end-to-end workflows a shopper performs -- rather than a
single module (unit-ish) or a single pair of modules (integration). Each test
drives the real UI from login through to the observable business outcome
(order confirmation, cart state, session state) and asserts that outcome.

Runs across every browser listed in ``--browsers`` (default: chrome, firefox,
edge, opera); unavailable browsers are SKIPPED (see ./conftest.py, the driver
factory in ../browsers.py, options in ../conftest.py). Each test gets a fresh
driver, so they are independent and order-free.
"""
import system_page as sp


# ST-001 -- A shopper completes a single-item purchase end to end.
def test_st_001_complete_single_item_purchase(driver):
    sp.login(driver)
    name, _ = sp.add_item(driver, 0)
    sp.wait(driver).until(lambda d: sp.badge_count(d) == 1)

    sp.open_cart(driver)
    assert [r["name"] for r in sp.cart_rows(driver)] == [name]

    sp.purchase(driver)
    assert "Thank you for your order" in sp.complete_message(driver)

    sp.back_home(driver)
    assert sp.badge_count(driver) == 0, "cart should be empty after a completed order"


# ST-002 -- A multi-item purchase preserves items and the totals add up.
def test_st_002_multi_item_purchase_totals(driver):
    sp.login(driver)
    added = sp.add_items(driver, 3)
    sp.wait(driver).until(lambda d: sp.badge_count(d) == 3)

    sp.open_cart(driver)
    assert {(r["name"], r["price"]) for r in sp.cart_rows(driver)} == set(added)

    sp.start_checkout(driver)
    sp.fill_information(driver)
    sp.continue_to_overview(driver)

    subtotal = sp.subtotal(driver)
    assert round(subtotal, 2) == round(sum(p for _, p in added), 2)
    assert round(sp.total(driver), 2) == round(subtotal + sp.tax(driver), 2)

    sp.finish_order(driver)
    assert "Thank you for your order" in sp.complete_message(driver)


# ST-003 -- Sorting the catalogue affects browsing, then a purchase completes.
def test_st_003_sort_then_purchase(driver):
    sp.login(driver)
    sp.sort_by(driver, "lohi")
    price_list = sp.prices(driver)
    assert price_list == sorted(price_list), "prices not sorted low-to-high"

    # Add the now-cheapest (first) product and buy it.
    name, price = sp.add_item(driver, 0)
    assert price == min(price_list)
    sp.wait(driver).until(lambda d: sp.badge_count(d) == 1)

    sp.open_cart(driver)
    assert sp.cart_rows(driver)[0]["name"] == name

    sp.purchase(driver)
    assert "Thank you for your order" in sp.complete_message(driver)


# ST-004 -- A shopper edits the cart (removes an item) before buying.
def test_st_004_modify_cart_then_purchase(driver):
    sp.login(driver)
    added = sp.add_items(driver, 2)
    sp.wait(driver).until(lambda d: sp.badge_count(d) == 2)

    sp.open_cart(driver)
    assert len(sp.cart_items(driver)) == 2
    sp.remove_first_in_cart(driver)
    remaining = sp.cart_rows(driver)
    assert len(remaining) == 1 and remaining[0]["name"] in {n for n, _ in added}

    sp.purchase(driver)
    assert "Thank you for your order" in sp.complete_message(driver)


# ST-005 -- A shopper cancels checkout, then resumes and completes the purchase.
def test_st_005_cancel_then_resume_purchase(driver):
    sp.login(driver)
    name, _ = sp.add_item(driver, 0)
    sp.wait(driver).until(lambda d: sp.badge_count(d) == 1)

    sp.open_cart(driver)
    sp.start_checkout(driver)
    sp.cancel_checkout(driver)  # back on the cart page
    assert [r["name"] for r in sp.cart_rows(driver)] == [name], "cart lost on cancel"

    sp.purchase(driver)  # resume checkout from the cart
    assert "Thank you for your order" in sp.complete_message(driver)


# ST-006 -- The cart survives a logout/login cycle and the purchase completes.
def test_st_006_cart_persists_across_logout_then_purchase(driver):
    sp.login(driver)
    sp.add_items(driver, 2)
    sp.wait(driver).until(lambda d: sp.badge_count(d) == 2)

    sp.logout(driver)
    sp.login(driver)
    assert sp.badge_count(driver) == 2, "cart not retained across logout/login"

    sp.open_cart(driver)
    assert len(sp.cart_items(driver)) == 2
    sp.purchase(driver)
    assert "Thank you for your order" in sp.complete_message(driver)


# ST-007 -- Reset App State clears the shopper's in-progress cart.
def test_st_007_reset_app_state_clears_cart(driver):
    sp.login(driver)
    sp.add_items(driver, 2)
    sp.wait(driver).until(lambda d: sp.badge_count(d) == 2)

    sp.reset_app_state(driver)
    sp.wait(driver).until(lambda d: sp.badge_count(d) == 0)

    sp.open_cart(driver)
    assert sp.cart_items(driver) == [], "cart not cleared by Reset App State"


# ST-008 -- A locked-out account is denied access to the system (negative).
def test_st_008_locked_out_user_denied(driver):
    sp.attempt_login(driver, sp.LOCKED_OUT_USER)
    assert sp.login_error(driver) == sp.ERR_LOCKED_OUT
    assert not driver.current_url.endswith("/inventory.html")


# ST-009 -- Continue Shopping lets a shopper accumulate items across visits.
def test_st_009_continue_shopping_accumulates_cart(driver):
    sp.login(driver)
    sp.add_item(driver, 0)
    sp.wait(driver).until(lambda d: sp.badge_count(d) == 1)

    sp.open_cart(driver)
    sp.continue_shopping(driver)
    sp.add_item(driver, 1)
    sp.wait(driver).until(lambda d: sp.badge_count(d) == 2)

    sp.open_cart(driver)
    assert len(sp.cart_items(driver)) == 2
    sp.purchase(driver)
    assert "Thank you for your order" in sp.complete_message(driver)


# ST-010 -- Logging out ends the session and returns to the Login module.
def test_st_010_logout_ends_session(driver):
    sp.login(driver)
    sp.add_item(driver, 0)
    sp.wait(driver).until(lambda d: sp.badge_count(d) == 1)

    sp.logout(driver)
    assert driver.find_element(*sp.LOGIN_BUTTON).is_displayed()
    assert driver.find_element(*sp.USERNAME).is_displayed()
    assert not driver.current_url.endswith("/inventory.html")
