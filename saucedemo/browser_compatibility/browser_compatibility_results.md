# Browser Compatibility Test — Results & Specification

Suite: `browser_compatibility/test_browser_compatibility.py` (BC-001 .. BC-007)
Run: `pytest browser_compatibility/ --browsers=chrome,edge,firefox --headless`
Result: **Firefox 7/7, Edge 7/7, Chrome 6/7** — only BC-007 (full purchase) is
intermittent on Chrome (SPA race, see notes); Opera skipped (not installed).

Level: **Browser Compatibility** — confirms the application behaves and renders
consistently across browsers (application access, login, inventory, cart, checkout,
navigation, and a complete purchase). Every case runs once per selected browser.

| Case Number | Feature Name | Test Case/Scenario | Pre-requisite | Test Steps | Expected Results | Browsers | Status | Remarks | Test Automation |
|---|---|---|---|---|---|---|---|---|---|
| BC-001 | Application Access | The login module loads and renders in each browser. | SauceDemo reachable in the browser under test. | 1) Open the login page. | Username field, password field and Login button are all displayed. | Chrome, Firefox, Edge (Opera skipped) | Pass | Screenshot saved for manual layout review. | Automated — `test_bc_001_application_access` |
| BC-002 | Login | Valid credentials land the user on the Inventory module. | Valid account `standard_user`/`secret_sauce`. | 1) Open login page. 2) Enter valid username + password. 3) Click Login. | URL is `/inventory.html`; page title reads “Products”. | Chrome, Firefox, Edge (Opera skipped) | Pass | — | Automated — `test_bc_002_login` |
| BC-003 | Inventory Display | The inventory container and product list render. | Logged in. | 1) Log in. 2) Observe the inventory page. | Inventory container is displayed; title “Products”; exactly 6 products listed. | Chrome, Firefox, Edge (Opera skipped) | Pass | Screenshot saved for manual layout review. | Automated — `test_bc_003_inventory_display` |
| BC-004 | Shopping Cart Display | The cart renders with an added product. | Logged in; one product added. | 1) Log in. 2) Add the first product. 3) Open the cart. | Cart container displayed; title “Your Cart”; exactly 1 cart item. | Chrome, Firefox, Edge (Opera skipped) | Pass | Screenshot saved for manual layout review. | Automated — `test_bc_004_cart_display` |
| BC-005 | Checkout Display | The checkout information page renders its fields. | Logged in; product in cart. | 1) Log in, add product, open cart. 2) Click Checkout. | On “Checkout: Your Information”; First Name, Last Name and Postal Code fields displayed. | Chrome, Firefox, Edge (Opera skipped) | Pass | Screenshot saved for manual layout review. | Automated — `test_bc_005_checkout_display` |
| BC-006 | Navigation Menu | All burger-menu options are present and accessible. | Logged in. | 1) Log in. 2) Open the burger menu. 3) Inspect the options. | All menu items (All Items, About, Reset App State, Logout) are visible/accessible. | Chrome, Firefox, Edge (Opera skipped) | Pass | Screenshot saved for manual layout review. | Automated — `test_bc_006_navigation_menu` |
| BC-007 | Overall Compatibility | The full purchase flow works end to end in each browser. | Valid account; product available. | 1) Log in, add product, open cart. 2) Checkout: enter First/Last/Postal, Continue. 3) Finish the order. | Reaches “Checkout: Complete!”; confirmation contains “Thank you for your order”. | Chrome, Firefox, Edge (Opera skipped) | Pass (Firefox/Edge); Chrome intermittent | Full end-to-end journey. Firefox/Edge reliable; Chrome intermittently races the href-less `onClick` SPA nav links on the cart/checkout hops (see notes). | Automated — `test_bc_007_overall_compatibility` |

## Notes
- Cases that are display-oriented (“renders without layout issues”) also save a screenshot under `browser_compatibility/screenshots/` for manual review, since correct rendering can’t be fully asserted programmatically.
- The `/v1/` login URL permanently redirects to the current SauceDemo site; tests use it as the entry point and target the served DOM.
- Opera is Chromium-based and supported by the driver factory but is not installed on this machine, so those runs are reported as **blocked** (pytest SKIPPED).
- Chrome note: SauceDemo’s cart/checkout links are href-less `onClick` anchors; Chrome can occasionally dispatch a click before the React handler is ready (independent of screenshots). Firefox and Edge are reliable.
