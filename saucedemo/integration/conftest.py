"""Cross-browser driver setup for the integration suite.

The integration journeys run across every browser listed in ``--browsers``
(default: chrome, firefox, edge, opera). Unavailable browsers are SKIPPED rather
than failed. Options are declared in the repo-root conftest.py; the driver
factory lives in the repo-root browsers.py.
"""
import pytest

import browsers


def pytest_generate_tests(metafunc):
    if "browser_name" in metafunc.fixturenames:
        raw = metafunc.config.getoption("--browsers")
        selected = [b.strip().lower() for b in raw.split(",") if b.strip()]
        metafunc.parametrize("browser_name", selected)


@pytest.fixture
def driver(browser_name, request):
    headless = request.config.getoption("--headless")
    try:
        drv = browsers.new_driver(browser_name, headless)
    except Exception as exc:  # browser/driver unavailable -> skip
        pytest.skip(f"{browser_name} unavailable: {exc}")

    drv.set_window_size(1280, 900)
    drv.implicitly_wait(5)
    drv.browser_name = browser_name
    yield drv
    drv.quit()
