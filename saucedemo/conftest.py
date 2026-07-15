import os

import pytest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

import shots


def pytest_addoption(parser):
    parser.addoption(
        "--headless",
        action="store_true",
        default=False,
        help="Run the browser in headless mode",
    )
    parser.addoption(
        "--browsers",
        action="store",
        default="chrome,edge,firefox,opera",
        help="Comma-separated browsers for the browser_compatibility suite "
        "(chrome, edge, firefox, opera). Unavailable browsers are skipped.",
    )
    parser.addoption(
        "--no-screenshots",
        action="store_true",
        default=False,
        help="Disable the per-step screenshot capture (see shots.py).",
    )


@pytest.fixture(autouse=True)
def capture_steps(request, driver):
    """Screenshot every step of every test into <suite>/screenshots/<test-id>/.

    Autouse + a dependency on ``driver`` means this brackets every test in every
    suite: the patched WebDriver primitives (see shots.py) fire a numbered
    screenshot after each click / text entry / page load, and a final-state shot
    is taken on the way out. Disable with ``--no-screenshots``.
    """
    if request.config.getoption("--no-screenshots"):
        yield
        return

    shots.install()
    # Each suite keeps its own screenshots/ folder next to its tests, organised
    # as <module>/screenshots/<test>/<browser>/.
    module_dir = os.path.dirname(str(request.path))
    module = os.path.basename(module_dir)
    browser = getattr(driver, "browser_name", "chrome")
    # Folder id = the test function name plus any non-browser parameters (e.g.
    # the login "username" param), so parametrised cases don't share -- and wipe
    # -- one folder. The browser becomes its own subfolder inside.
    test_id = request.node.originalname or request.node.name
    callspec = getattr(request.node, "callspec", None)
    if callspec:
        extra = [f"{k}-{v}" for k, v in callspec.params.items() if k != "browser_name"]
        if extra:
            test_id = f"{test_id}[{'_'.join(extra)}]"
    # In non-login suites the login flow is just a precondition -- don't clutter
    # their folders with login screenshots.
    shots.begin(module_dir, test_id, browser, skip_login=(module != "login"))
    try:
        yield
    finally:
        shots.snap(driver, "final")
        shots.end()


@pytest.fixture
def driver(request):
    options = Options()
    if request.config.getoption("--headless"):
        options.add_argument("--headless=new")
    options.add_argument("--window-size=1280,800")
    # Selenium Manager (built into Selenium 4.6+) auto-downloads the matching chromedriver.
    driver = webdriver.Chrome(options=options)
    driver.implicitly_wait(5)
    driver.browser_name = "chrome"  # so shots.py can label screenshots
    yield driver
    driver.quit()
