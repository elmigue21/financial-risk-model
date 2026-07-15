"""
System tests for the Financial Health Check app (ST-01..ST-10).

Functional pass/fail tests that drive a real Chrome browser through each feature
end to end. ST-06 (AI advisor) is not automated here — it depends on an external
AI service; its response is exercised by PT-04 in the performance suite instead.

Prerequisites: the app running at --base-url (built: `npm run build && npm start`),
the model service on :5000 (for ST-03/ST-04), and the seeded demo account
(`node scripts/seed.mjs`) which most tests log into and read data from.
"""

import uuid

import pytest
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.support import expected_conditions as EC

import app_pages as app


# ST-01 -- Register a new user account.
def test_st_01_user_registration(driver, base_url):
    unique_email = f"st-{uuid.uuid4().hex[:12]}@example.com"
    app.register(driver, base_url, "System Test User", unique_email, "test1234")
    # Success = signed straight in: off /register and the nav is present.
    assert "/register" not in driver.current_url
    assert driver.find_elements(*app.NAV_SIGN_OUT), "not signed in after registering"


# ST-02 -- Verify authentication and session management (login then logout).
def test_st_02_login_and_logout(driver, base_url, email, password):
    app.login(driver, base_url, email, password)
    assert driver.find_elements(*app.NAV_SIGN_OUT), "login did not establish a session"
    assert "/login" not in driver.current_url

    app.logout(driver)
    assert "/login" in driver.current_url, "logout did not return to the login page"
    # Session is really gone: a protected page bounces back to login.
    app.open_dashboard(driver, base_url)
    app.wait(driver).until(lambda d: "/login" in d.current_url)


# ST-03 -- Submit financial information (validated and accepted).
def test_st_03_financial_data_entry(logged_in_driver, base_url):
    driver = logged_in_driver
    app.delete_months(driver, prefix="2098-")  # clear leftovers from a prior run
    try:
        app.open_status(driver, base_url)
        app.fill_month(driver, "2098-01")
        app.submit_score(driver)
        app.wait_saved(driver)  # "…now scored and in your history" = accepted
        assert driver.find_elements(*app.SAVED_BANNER)
    finally:
        app.delete_months(driver, prefix="2098-")


# ST-04 -- Generate a financial assessment (score, trouble risk, confidence shown).
def test_st_04_financial_risk_assessment(logged_in_driver, base_url):
    driver = logged_in_driver
    app.open_dashboard(driver, base_url)
    try:
        app.wait_dashboard_ready(driver)
    except TimeoutException:
        pytest.fail("No assessment on the dashboard — run `node scripts/seed.mjs` in frontend/.")
    # The three headline indicators are present.
    assert driver.find_elements(*app.CARD_HEALTH), "Health Score not shown"
    assert driver.find_elements(*app.CARD_TROUBLE), "Trouble Risk not shown"
    assert driver.find_elements(*app.CARD_CONFIDENCE), "Model Confidence not shown"


# ST-05 -- View dashboard information (summary, charts, indicators).
def test_st_05_dashboard(logged_in_driver, base_url):
    driver = logged_in_driver
    app.open_dashboard(driver, base_url)
    try:
        app.wait_dashboard_ready(driver)
    except TimeoutException:
        pytest.fail("Dashboard has no data — run `node scripts/seed.mjs` in frontend/.")
    assert driver.find_elements(*app.DASHBOARD_H1), "dashboard heading missing"
    # The risk gauge and at least one chart/indicator render as SVG.
    assert driver.find_elements(*app.DASHBOARD_READY), "risk gauge missing"
    # SVG lives in its own namespace, so match by local name, not "//svg".
    assert driver.find_elements("xpath", "//*[local-name()='svg']"), "no charts/indicators rendered"


# ST-07 -- View previous assessments.
def test_st_07_assessment_history(logged_in_driver, base_url):
    driver = logged_in_driver
    app.open_history(driver, base_url)
    assert driver.find_elements(*app.HISTORY_H1), "history heading missing"
    # The seeded demo account has months, so the table has at least one row.
    rows = app.wait(driver).until(lambda d: d.find_elements(*app.HISTORY_ROWS))
    assert len(rows) > 0, "no previous assessments listed"


# ST-08 -- Generate/print an assessment report (printable report produced).
def test_st_08_report_printing(logged_in_driver, base_url):
    driver = logged_in_driver
    download_dir = driver.download_dir
    app.open_dashboard(driver, base_url)
    try:
        app.wait_dashboard_ready(driver)
    except TimeoutException:
        pytest.fail("No report to print — run `node scripts/seed.mjs` in frontend/.")
    # Printing headlessly can't be asserted, so we verify the printable report is
    # generated: the PDF export produces a downloadable document.
    app.clear_downloads(download_dir)
    app.click_export(driver, "pdf")
    pdf = app.wait_for_download(driver, download_dir, ".pdf")
    assert pdf.exists() and pdf.stat().st_size > 0, "printable PDF report was not generated"


# ST-09 -- Update profile information.
def test_st_09_user_profile(logged_in_driver, base_url):
    driver = logged_in_driver
    app.open_profile(driver, base_url)
    original = driver.find_element(*app.PROFILE_FULLNAME).get_attribute("value")
    try:
        app.set_react_input(driver, app.PROFILE_FULLNAME, "System Test QA")
        app.js_click(driver, app.PROFILE_SAVE)
        app.wait(driver).until(EC.visibility_of_element_located(app.PROFILE_SAVED))
        assert driver.find_elements(*app.PROFILE_SAVED), "profile change was not confirmed"
    finally:
        # Restore the original name so the demo account is unchanged.
        app.set_react_input(driver, app.PROFILE_FULLNAME, original)
        app.js_click(driver, app.PROFILE_SAVE)
        app.wait(driver).until(EC.visibility_of_element_located(app.PROFILE_SAVED))


# ST-10 -- Verify access restrictions (unauthenticated users are redirected).
@pytest.mark.parametrize("path", ["/", "/history", "/profile", "/status"])
def test_st_10_access_control(driver, base_url, path):
    # Fresh browser, never logged in.
    driver.get(base_url + path)
    app.wait(driver).until(lambda d: "/login" in d.current_url)
    assert "/login" in driver.current_url, f"{path} was reachable without logging in"
