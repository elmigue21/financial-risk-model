"""
Integration tests for the Financial Health Check app (IT-01..IT-03).

These verify that components work together end to end: the frontend auth with the
database, the frontend with the Flask prediction service, and the dashboard/history
pages with the stored data. IT-04 (AI advisor) and IT-05 (report) are tested
manually.

Prerequisites: the app running at --base-url (built: `npm run build && npm start`),
the Flask prediction service on :5000 (for IT-02), and the seeded demo account
(`node scripts/seed.mjs`) for IT-03.
"""

import uuid

import pytest
from selenium.common.exceptions import TimeoutException

import app_pages as app


# IT-01 -- Authentication + database: register, then log back in and read the
# stored profile, proving the account was persisted and retrieved.
def test_it_01_auth_and_database(driver, base_url):
    full_name = "Integration Tester"
    account_email = f"it-{uuid.uuid4().hex[:12]}@example.com"
    password = "test1234"

    # Register — writes the new user to the database and signs in.
    app.register(driver, base_url, full_name, account_email, password)
    # Sign out, then authenticate again with the same credentials (reads the DB).
    app.logout(driver)
    app.login(driver, base_url, account_email, password)

    # Retrieve the stored profile and confirm it matches what was registered.
    app.open_profile(driver, base_url)
    stored_name = driver.find_element(*app.PROFILE_FULLNAME).get_attribute("value")
    stored_email = driver.find_element(*app.PROFILE_EMAIL).get_attribute("value")
    assert stored_name == full_name, "registered name was not stored/retrieved"
    assert stored_email == account_email, "registered email was not stored/retrieved"


# IT-02 -- Prediction service integration: submitting financial data reaches the
# Flask service, which returns a risk assessment that the app displays.
def test_it_02_prediction_service(logged_in_driver, base_url, model_up):
    if not model_up:
        pytest.skip("Flask prediction service not reachable at --model-url; start it to run IT-02.")

    driver = logged_in_driver
    app.delete_months(driver, prefix="2097-")  # clear leftovers from a prior run
    try:
        app.open_status(driver, base_url)
        app.fill_month(driver, "2097-01")
        app.submit_score(driver)
        # The "saved" banner only appears after /api/predict returns successfully
        # (a failed prediction shows an error banner instead), so reaching it
        # already proves the Flask service responded.
        app.wait_saved(driver)

        # And the returned assessment is displayed: a numeric risk index + trouble risk.
        app.open_dashboard(driver, base_url)
        app.wait_dashboard_ready(driver)
        risk_index = driver.find_element(*app.RISK_INDEX_VALUE).text.strip()
        assert risk_index.isdigit(), (
            f"prediction service did not return a numeric risk index (got {risk_index!r})"
        )
        assert driver.find_elements(*app.CARD_TROUBLE), "trouble-risk assessment not displayed"
    finally:
        app.delete_months(driver, prefix="2097-")


# IT-03 -- Dashboard/History retrieve saved assessments from the database.
def test_it_03_dashboard_and_database(logged_in_driver, base_url):
    driver = logged_in_driver

    # Dashboard reads and shows the latest saved assessment.
    app.open_dashboard(driver, base_url)
    try:
        app.wait_dashboard_ready(driver)
    except TimeoutException:
        pytest.fail("Dashboard has no saved data — run `node scripts/seed.mjs` in frontend/.")
    assert driver.find_elements(*app.DASHBOARD_READY), "saved assessment not shown on dashboard"

    # History reads and lists the saved assessments.
    app.open_history(driver, base_url)
    rows = app.wait(driver).until(lambda d: d.find_elements(*app.HISTORY_ROWS))
    assert len(rows) > 0, "saved assessments were not retrieved on the History page"
