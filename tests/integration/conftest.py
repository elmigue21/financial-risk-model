"""
Fixtures and options for the integration tests. Chrome only, one fresh browser
per test.
"""

import urllib.request

import pytest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

import app_pages as app


def pytest_addoption(parser):
    group = parser.getgroup("integration")
    group.addoption("--headless", action="store_true", help="Run Chrome headless.")
    group.addoption(
        "--base-url",
        default="http://localhost:3000",
        help="Where the app is running (default: http://localhost:3000).",
    )
    group.addoption(
        "--model-url",
        default="http://localhost:5000",
        help="Where the Flask prediction service runs (default: http://localhost:5000).",
    )
    group.addoption("--email", default="demo@example.com", help="Login email.")
    group.addoption("--password", default="demo1234", help="Login password.")


@pytest.fixture
def base_url(request):
    return request.config.getoption("--base-url").rstrip("/")


@pytest.fixture
def model_url(request):
    return request.config.getoption("--model-url").rstrip("/")


@pytest.fixture
def email(request):
    return request.config.getoption("--email")


@pytest.fixture
def password(request):
    return request.config.getoption("--password")


@pytest.fixture
def driver(request):
    options = Options()
    if request.config.getoption("--headless"):
        options.add_argument("--headless=new")
    options.add_argument("--window-size=1280,900")
    drv = webdriver.Chrome(options=options)
    drv.implicitly_wait(5)
    yield drv
    drv.quit()


@pytest.fixture
def logged_in_driver(driver, base_url, email, password):
    app.login(driver, base_url, email, password)
    return driver


@pytest.fixture
def model_up(model_url):
    """True if the Flask prediction service answers /health — IT-02 skips if not."""
    try:
        with urllib.request.urlopen(model_url + "/health", timeout=2) as resp:
            return resp.status == 200
    except Exception:
        return False
