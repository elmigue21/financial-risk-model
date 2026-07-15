"""
Fixtures and options for the system tests. Chrome only, one fresh browser per
test. Downloads go to a per-test temp folder for the report test (ST-08).
"""

import pytest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

import app_pages as app


def pytest_addoption(parser):
    group = parser.getgroup("system")
    group.addoption("--headless", action="store_true", help="Run Chrome headless.")
    group.addoption(
        "--base-url",
        default="http://localhost:3000",
        help="Where the app is running (default: http://localhost:3000).",
    )
    group.addoption("--email", default="demo@example.com", help="Login email.")
    group.addoption("--password", default="demo1234", help="Login password.")


@pytest.fixture
def base_url(request):
    return request.config.getoption("--base-url").rstrip("/")


@pytest.fixture
def email(request):
    return request.config.getoption("--email")


@pytest.fixture
def password(request):
    return request.config.getoption("--password")


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
            "plugins.always_open_pdf_externally": True,
            "profile.default_content_setting_values.automatic_downloads": 1,
        },
    )

    drv = webdriver.Chrome(options=options)
    drv.implicitly_wait(5)
    drv.download_dir = str(download_dir)
    yield drv
    drv.quit()


@pytest.fixture
def logged_in_driver(driver, base_url, email, password):
    app.login(driver, base_url, email, password)
    return driver
