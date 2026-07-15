"""
Fixtures and command-line options for the performance suite.

Chrome only (most stable timing). One fresh browser per test. Downloads go to a
per-test temp folder so the report test can watch for the exported file.
"""

import urllib.request

import pytest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

import app_pages as app
import perf


# --- Command-line options ---------------------------------------------------

def pytest_addoption(parser):
    group = parser.getgroup("performance")
    group.addoption("--headless", action="store_true", help="Run Chrome headless.")
    group.addoption(
        "--base-url",
        default="http://localhost:3000",
        help="Where the app is running (default: http://localhost:3000).",
    )
    group.addoption(
        "--model-url",
        default="http://localhost:5000",
        help="Where the Python risk model runs (default: http://localhost:5000).",
    )
    group.addoption("--email", default="demo@example.com", help="Login email.")
    group.addoption("--password", default="demo1234", help="Login password.")
    group.addoption(
        "--samples",
        type=int,
        default=3,
        help="Runs per test; the first is a warm-up and is discarded (default: 3).",
    )
    # Per-metric time limits (seconds). Unset means use the default in perf.py.
    group.addoption("--max-login", type=float, default=None)
    group.addoption("--max-predict", type=float, default=None)
    group.addoption("--max-dashboard", type=float, default=None)
    group.addoption("--max-report-csv", type=float, default=None)
    group.addoption("--max-report-pdf", type=float, default=None)
    group.addoption("--max-advice", type=float, default=None)


# --- Config-derived fixtures ------------------------------------------------

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
def samples(request):
    return max(1, request.config.getoption("--samples"))


@pytest.fixture
def thresholds(request):
    limits = dict(perf.DEFAULT_THRESHOLDS)
    overrides = {
        "login": "--max-login",
        "predict": "--max-predict",
        "dashboard": "--max-dashboard",
        "report_csv": "--max-report-csv",
        "report_pdf": "--max-report-pdf",
        "advice": "--max-advice",
    }
    for key, opt in overrides.items():
        value = request.config.getoption(opt)
        if value is not None:
            limits[key] = value
    return limits


@pytest.fixture
def model_up(model_url):
    """True if the risk model service answers /health — PT-02 skips if not."""
    try:
        with urllib.request.urlopen(model_url + "/health", timeout=2) as resp:
            return resp.status == 200
    except Exception:
        return False


# --- Browser ----------------------------------------------------------------

@pytest.fixture
def driver(request, tmp_path):
    download_dir = tmp_path / "downloads"
    download_dir.mkdir()

    options = Options()
    if request.config.getoption("--headless"):
        options.add_argument("--headless=new")
    options.add_argument("--window-size=1280,900")
    options.add_experimental_option(
        "prefs",
        {
            "download.default_directory": str(download_dir),
            "download.prompt_for_download": False,
            "download.directory_upgrade": True,
            "plugins.always_open_pdf_externally": True,  # download PDFs, don't preview
            # The report test exports several files in a row; without this Chrome
            # blocks every download after the first ("trying to download multiple
            # files") and the wait times out.
            "profile.default_content_setting_values.automatic_downloads": 1,
        },
    )

    drv = webdriver.Chrome(options=options)
    drv.implicitly_wait(5)
    drv.download_dir = str(download_dir)  # exposed for the report test
    yield drv
    drv.quit()


@pytest.fixture
def logged_in_driver(driver, base_url, email, password):
    """A browser already signed in as the test account (used by PT-02/03/05)."""
    app.login(driver, base_url, email, password)
    return driver


# --- Results collector ------------------------------------------------------

@pytest.fixture(scope="session")
def results():
    from pathlib import Path

    recorder = perf.Results(Path(__file__).parent / "results")
    yield recorder
    recorder.write()
