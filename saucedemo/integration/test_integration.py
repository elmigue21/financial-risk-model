"""Integration test suite (IT-001 .. IT-010).

These are the cross-module ("pair of units") journeys the per-module suites do
NOT cover: each test drives the REAL UI transitions -- no short-circuit
prerequisite helpers -- and asserts the DATA that crosses each module boundary
(item identity/price, cart-badge count, order totals), not merely that the next
page loaded.

Boundaries exercised:
  Login -> Inventory        (IT-001)
  Inventory -> Cart (add)   (IT-002, IT-003)
  Cart -> Inventory (sync)  (IT-004, IT-005)
  Nav / state persistence   (IT-006, IT-007)
  Cart -> Checkout + totals (IT-008)
  Full end-to-end journey   (IT-009)
  Cart persistence / logout (IT-010, documented behaviour)

Runs across every browser listed in ``--browsers`` (default: chrome, firefox,
edge, opera); unavailable browsers are SKIPPED rather than failed (see
./conftest.py, the driver factory in ../browsers.py, and options in
../conftest.py). Tests hit the live saucedemo.com and each gets a fresh driver,
so they are independent and order-free.
"""
from selenium.webdriver.support import expected_conditions as EC

import integration_page as it


# ---------------------------------------------------- Login -> Inventory
# IT-001 -- A valid login establishes the session and hands off to Inventory.
def test_it_001_login_hands_off_to_inventory(driver):
    it.login(driver)
    assert "inventory.html" in driver.current_url
    assert driver.find_element(*it.INVENTORY_CONTAINER).is_displayed()
    assert len(it.inventory_items(driver)) == it.EXPECTED_ITEM_COUNT


# ------------------------------------------------ Inventory -> Cart (add)
# IT-002 -- Adding a product on Inventory carries its identity into the Cart.
def test_it_002_added_product_reaches_cart(driver):
    it.login(driver)
    name, price = it.add_item(driver, 0)

    # Inventory-side state flips immediately.
    assert it.is_remove_button(it.item_button_by_name(driver, name))
    it.wait(driver).until(lambda d: it.badge_count(d) == 1)

    it.open_cart(driver)
    rows = it.cart_rows(driver)
    assert len(rows) == 1
    assert rows[0]["name"] == name
    assert rows[0]["price"] == price
    assert rows[0]["qty"] == "1"
    # Badge count survives the navigation to the cart page.
    assert it.badge_count(driver) == 1


# IT-003 -- Multiple distinct products all cross the boundary intact.
def test_it_003_multiple_products_reach_cart(driver):
    it.login(driver)
    added = it.add_items(driver, 3)  # [(name, price), ...]
    it.wait(driver).until(lambda d: it.badge_count(d) == 3)

    it.open_cart(driver)
    rows = it.cart_rows(driver)
    assert len(rows) == 3
    assert {(r["name"], r["price"]) for r in rows} == set(added)


# --------------------------------------- Cart -> Inventory (remove / sync)
# IT-004 -- Removing on the Cart page syncs back: Inventory button reverts.
def test_it_004_remove_in_cart_reverts_inventory_button(driver):
    it.login(driver)
    name, _ = it.add_item(driver, 0)
    it.wait(driver).until(lambda d: it.badge_count(d) == 1)

    it.open_cart(driver)
    assert len(it.cart_items(driver)) == 1
    it.remove_first_in_cart(driver)
    assert it.cart_items(driver) == []
    assert it.badge_count(driver) == 0

    it.continue_shopping(driver)
    button = it.item_button_by_name(driver, name)
    assert not it.is_remove_button(button), "inventory button did not revert to Add to cart"


# IT-005 -- Reverse direction: removing on Inventory empties the Cart.
def test_it_005_remove_on_inventory_empties_cart(driver):
    it.login(driver)
    name, _ = it.add_item(driver, 0)
    it.wait(driver).until(lambda d: it.badge_count(d) == 1)

    # Toggle the same item off from the inventory page.
    it.item_button_by_name(driver, name).click()
    it.wait(driver).until(lambda d: it.badge_count(d) == 0)

    it.open_cart(driver)
    assert it.cart_items(driver) == []


# ---------------------------------------- Navigation / state persistence
# IT-006 -- Cart state persists across a Cart <-> Inventory round trip.
def test_it_006_state_persists_across_navigation(driver):
    it.login(driver)
    added = it.add_items(driver, 2)
    it.wait(driver).until(lambda d: it.badge_count(d) == 2)

    it.open_cart(driver)
    assert len(it.cart_items(driver)) == 2

    it.continue_shopping(driver)
    assert it.badge_count(driver) == 2
    for name, _ in added:
        assert it.is_remove_button(it.item_button_by_name(driver, name))


# IT-007 -- Reset App State (burger menu) clears the cart badge everywhere.
# NOTE: on SauceDemo v1, Reset App State reliably clears the badge but does NOT
# repaint the inventory buttons back to "Add to cart" until the page reloads
# (a known site quirk). The cross-module signal we assert is the badge, which is
# what actually propagates; the button quirk is recorded here, not asserted.
def test_it_007_reset_app_state_clears_badge(driver):
    it.login(driver)
    it.add_items(driver, 2)
    it.wait(driver).until(lambda d: it.badge_count(d) == 2)

    it.reset_app_state(driver)
    it.wait(driver).until(lambda d: it.badge_count(d) == 0)
    assert it.badge_count(driver) == 0


# ------------------------------------- Cart -> Checkout (data + totals math)
# IT-008 -- Cart contents flow into the Overview and the totals add up.
def test_it_008_checkout_overview_matches_cart_and_totals(driver):
    it.login(driver)
    it.add_items(driver, 2)
    it.wait(driver).until(lambda d: it.badge_count(d) == 2)

    it.open_cart(driver)
    cart = it.cart_rows(driver)

    it.start_checkout(driver)
    it.fill_information(driver)
    it.continue_to_overview(driver)

    overview = it.overview_rows(driver)
    # Same items (name + price) crossed cart -> overview.
    assert {(r["name"], r["price"]) for r in overview} == {
        (r["name"], r["price"]) for r in cart
    }

    subtotal = it.subtotal(driver)
    expected_subtotal = round(sum(r["price"] for r in overview), 2)
    assert round(subtotal, 2) == expected_subtotal
    assert round(it.total(driver), 2) == round(subtotal + it.tax(driver), 2)


# ------------------------------------------- Full end-to-end journey
# IT-009 -- login -> add -> cart -> checkout -> finish -> complete -> home,
# asserting the handoff at every hop and that finishing clears the cart.
def test_it_009_full_purchase_journey(driver):
    it.login(driver)

    name, price = it.add_item(driver, 0)
    it.wait(driver).until(lambda d: it.badge_count(d) == 1)

    it.open_cart(driver)
    cart = it.cart_rows(driver)
    assert len(cart) == 1 and cart[0]["name"] == name and cart[0]["price"] == price

    it.start_checkout(driver)
    it.fill_information(driver)
    it.continue_to_overview(driver)
    overview = it.overview_rows(driver)
    assert overview[0]["name"] == name and overview[0]["price"] == price
    assert round(it.total(driver), 2) == round(it.subtotal(driver) + it.tax(driver), 2)

    it.finish_order(driver)
    assert driver.find_element(*it.COMPLETE_HEADER).text.strip()

    it.back_home(driver)
    assert it.badge_count(driver) == 0, "cart should be empty after completing an order"


# ---------------------------------------- Cart persistence across logout
# IT-010 -- Documenting SauceDemo's cart-retention behaviour across a
# logout/login cycle. SauceDemo persists the cart in browser storage keyed by
# user, so the item is expected to still be present after logging back in. If
# the site's behaviour changes, this recorded expectation is where it surfaces
# (mirroring cart/test_cart_page.py::SC-016).
def test_it_010_cart_persists_across_logout(driver):
    it.login(driver)
    it.add_item(driver, 0)
    it.wait(driver).until(lambda d: it.badge_count(d) == 1)

    it.logout(driver)
    it.login(driver)

    assert it.badge_count(driver) == 1, (
        "expected SauceDemo to retain the cart across a logout/login cycle"
    )
