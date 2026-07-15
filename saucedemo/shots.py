"""Step screenshot instrumentation shared by every SauceDemo suite.

The goal is a screenshot of every meaningful step of every test, organised per
module and per test, without editing the ~130 individual test bodies.

How it works
------------
SauceDemo is a React SPA: its navigation links are ``onClick`` anchors with no
href, so issuing *any* extra WebDriver command (even a read) in the tight window
around such a click perturbs the client-side routing and the click silently
no-ops. Screenshotting after every click therefore breaks the cart/checkout
flows outright.

Instead, this module monkeypatches the two points that are inherently *settled*,
where a screenshot cannot race a pending click:

    * ``WebDriver.get``        -> a real page load just finished.
    * ``WebDriverWait.until``  -> a wait condition just became true (URL changed,
                                  element visible, cart badge updated, ...).

Every navigation and state change in these suites is guarded by one of those
waits, so we still capture each meaningful step -- while the app's own clicks
run exactly as they do uninstrumented, untouched. The real Selenium classes are
patched in place (not wrapped), so element identity, ``driver.browser_name`` and
``==`` comparisons all behave exactly as before.

The repo-root ``conftest.py`` calls :func:`install` once and brackets each test
with :func:`begin` / :func:`end` (via an autouse fixture), so the patched
methods know which folder to write into and how to number the shots.

Each suite keeps its own folder next to its tests:
``<module>/screenshots/<test-id>/<browser>/NN_step_<browser>.png`` -- the
browser is in both the folder and the filename.
"""
import os

from selenium.webdriver.remote.webdriver import WebDriver
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.support.ui import WebDriverWait

# Current capture context, set by begin()/end(). The suites run one test at a
# time (no pytest-xdist), so a module-level context is safe and keeps the
# patched primitives free of per-test plumbing.
#
# ``prelude_left`` suppresses the shared login-prelude screenshots for non-login
# suites *command-free*: the login flow is always get(login) -> until(login form)
# -> submit -> until(inventory) ..., so skipping the login page load and the
# first until drops exactly the login screens without ever querying the driver
# (any extra WebDriver command around the SPA navigation breaks it).
#
# ``actions``  -- capture after every click/keystroke. Only the login suite sets
#                 this: the login page isn't the fragile SPA, so per-step capture
#                 is safe there (and gives rich login screenshots on all browsers).
# ``fragile``  -- the non-login SPA suites; on Chrome they capture only at
#                 completed navigations to dodge the onClick-anchor click race.
_ctx = {
    "dir": None, "count": 0, "on": False,
    "skip_prelude": False, "prelude_left": 0, "actions": False, "fragile": False,
}

# Original, unpatched methods (populated by install()).
_orig = {}


def _slug(text, limit=40):
    """Turn arbitrary text into a filesystem-safe fragment."""
    safe = "".join(c if (c.isalnum() or c in "-.") else "_" for c in str(text))
    while "__" in safe:
        safe = safe.replace("__", "_")
    return safe.strip("_")[:limit] or "step"


def _stamp(path, browser):
    """Draw a ``BROWSER: X`` badge onto the saved PNG (no driver interaction).

    Done after the file is written, purely with Pillow, so it can't perturb the
    SPA. Degrades to a no-op if Pillow isn't installed or anything goes wrong.
    """
    try:
        from PIL import Image, ImageDraw, ImageFont
    except Exception:
        return
    try:
        text = f"BROWSER: {browser.upper()}"
        with Image.open(path) as img:
            img = img.convert("RGB")
            draw = ImageDraw.Draw(img)
            try:
                font = ImageFont.truetype("arialbd.ttf", 20)
            except Exception:
                font = ImageFont.load_default()
            pad = 8
            box = draw.textbbox((0, 0), text, font=font)
            tw, th = box[2] - box[0], box[3] - box[1]
            x0 = img.width - tw - 3 * pad
            y0 = img.height - th - 3 * pad
            draw.rectangle(
                [x0, y0, img.width - pad, img.height - pad], fill=(11, 11, 11)
            )
            draw.text((x0 + pad, y0 + pad - box[1]), text, fill=(255, 255, 255), font=font)
            img.save(path)
    except Exception:
        pass


def _capture(driver, label):
    """Save the next numbered screenshot for the active test, if capturing.

    The capture is a single, strictly read-only ``save_screenshot`` call -- it
    never touches the page DOM and is only ever fired from a *settled* state (see
    :func:`install`), so it can't perturb the app's own steps. The browser badge
    is drawn onto the file afterwards, offline.
    """
    if not _ctx["on"] or _ctx["dir"] is None:
        return
    _ctx["count"] += 1
    browser = getattr(driver, "browser_name", "browser")
    path = os.path.join(
        _ctx["dir"], f"{_ctx['count']:02d}_{_slug(label)}_{_slug(browser)}.png"
    )
    try:
        # Only the bare screenshot happens during the test; the browser badge is
        # drawn later in end(), off the critical path. Even a few ms of extra work
        # here (e.g. Pillow file I/O) can shift Chrome's timing into SauceDemo's
        # cart/checkout click race, so test-time capture stays minimal.
        driver.save_screenshot(path)
    except Exception:
        # A screenshot must never turn a passing test red (e.g. the page is
        # mid-navigation when we fire). Best-effort only.
        pass


def install():
    """Patch WebDriver to snapshot at settled checkpoints (idempotent).

    Why not snapshot after every click/keystroke? SauceDemo is a React SPA whose
    navigation links are ``onClick`` anchors with no href. Issuing *any* extra
    WebDriver command (even a read) in the tight window around such a click
    perturbs the client-side routing and the click silently no-ops -- proven to
    fail the cart/checkout flows every time.

    So instead we hook the two points that are inherently *settled*:

      * ``WebDriver.get``        -- a real page load just finished.
      * ``WebDriverWait.until``  -- a wait condition (URL changed, element
                                    visible, badge updated ...) just became true.

    Every navigation and state change in these suites goes through one of those
    waits, so we still get a screenshot of each meaningful step -- but the app's
    own clicks run exactly as they do without instrumentation, untouched.
    """
    if _orig:
        return

    _orig["get"] = WebDriver.get
    _orig["until"] = WebDriverWait.until
    _orig["click"] = WebElement.click
    _orig["send_keys"] = WebElement.send_keys

    def until(self, method, message=""):
        value = _orig["until"](self, method, message)
        if _ctx["prelude_left"] > 0:
            _ctx["prelude_left"] -= 1  # a login-prelude wait -> don't capture
            return value
        # On the fragile SPA suites, a screenshot fired from a page that is about
        # to be clicked races SauceDemo's onClick-anchor navigation on Chrome and
        # the click no-ops. Chrome is the only browser affected, and even the
        # post-navigation (url_*) shots aggravate the heaviest journeys -- so on
        # Chrome we skip *all* in-flow capture for these suites and rely on the
        # teardown "final" shot alone (taken after the test body, so it can never
        # affect the result). Edge/Firefox (and the login suite) keep full
        # per-step capture.
        browser = getattr(self._driver, "browser_name", "")
        if _ctx["fragile"] and browser == "chrome":
            return value
        _capture(self._driver, "step")
        return value

    def get(self, url):
        _orig["get"](self, url)
        # Skip the login page load for non-login suites (command-free).
        if not _ctx["skip_prelude"]:
            _capture(self, "load")

    def click(self):
        _orig["click"](self)
        if _ctx["actions"]:  # login suite only -- safe, not the SPA click race
            _capture(self._parent, "click")

    def send_keys(self, *value):
        _orig["send_keys"](self, *value)
        if _ctx["actions"]:
            _capture(self._parent, "type")

    WebDriver.get = get
    WebDriverWait.until = until
    WebElement.click = click
    WebElement.send_keys = send_keys


def begin(base_dir, test_id, browser, skip_login=False):
    """Start capturing for one test in one browser.

    Shots go under ``<base_dir>/screenshots/<test-id>/<browser>/`` -- each suite
    keeps its own screenshots folder, grouped by test then by the browser it ran
    in. ``skip_login`` suppresses the shared login-prelude screenshots so
    non-login suites only capture their own screens.
    """
    out = os.path.join(
        base_dir, "screenshots", _slug(test_id, limit=80), _slug(browser)
    )
    os.makedirs(out, exist_ok=True)
    # Clear a previous run's shots so numbering is fresh and nothing is stale.
    for name in os.listdir(out):
        if name.endswith(".png"):
            try:
                os.remove(os.path.join(out, name))
            except OSError:
                pass
    # For non-login suites, skip the login page load and the single login-form
    # wait that precede the app screens; capture per-action only for the login
    # suite (safe there) and treat every other suite as the fragile SPA.
    _ctx.update(
        dir=out, count=0, on=True, browser=browser,
        skip_prelude=skip_login, prelude_left=1 if skip_login else 0,
        actions=not skip_login, fragile=skip_login,
    )


def snap(driver, label):
    """Manually capture a labelled step (used for the final-state shot)."""
    _capture(driver, label)


def end():
    """Stop capturing and draw the browser badge onto every shot (offline).

    Stamping happens here, after the test's steps are done, so no image work is
    on the critical path where it could disturb Chrome's SPA click timing.
    """
    out, browser = _ctx["dir"], _ctx.get("browser", "browser")
    if out and os.path.isdir(out):
        for name in os.listdir(out):
            if name.endswith(".png"):
                _stamp(os.path.join(out, name), browser)
    _ctx.update(
        dir=None, count=0, on=False, skip_prelude=False, prelude_left=0,
        actions=False, fragile=False,
    )
