"""Locators and helpers for the SauceDemo Login Module.

The test cases list https://www.saucedemo.com/v1/ as the URL; SauceDemo redirects
that to the current login page, so these locators target the served DOM.
"""
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

LOGIN_URL = "https://www.saucedemo.com/v1/"
VALID_USER = "standard_user"
VALID_PASS = "secret_sauce"

# Every account SauceDemo accepts (all share VALID_PASS). ``locked_out_user`` is
# a valid account that the app blocks with an error; the rest reach inventory
# (problem_user / visual_user still land there, just with visual bugs, and
# performance_glitch_user lands there after a deliberate delay).
LOCKED_OUT_USER = "locked_out_user"
ALL_USERS = [
    "standard_user",
    LOCKED_OUT_USER,
    "problem_user",
    "performance_glitch_user",
    "error_user",
    "visual_user",
]

USERNAME = (By.ID, "user-name")
PASSWORD = (By.ID, "password")
LOGIN_BUTTON = (By.ID, "login-button")
ERROR = (By.CSS_SELECTOR, "[data-test='error']")
ERROR_ICON = (By.CSS_SELECTOR, ".error_icon")

# Error strings SauceDemo returns (verified against the live site).
ERR_USERNAME_REQUIRED = "Epic sadface: Username is required"
ERR_PASSWORD_REQUIRED = "Epic sadface: Password is required"
ERR_NO_MATCH = "Epic sadface: Username and password do not match any user in this service"
ERR_LOCKED_OUT = "Epic sadface: Sorry, this user has been locked out."


def open_login(driver):
    driver.get(LOGIN_URL)
    WebDriverWait(driver, 10).until(EC.visibility_of_element_located(USERNAME))


def enter_username(driver, text):
    field = driver.find_element(*USERNAME)
    field.send_keys(text)
    return field


def enter_password(driver, text):
    field = driver.find_element(*PASSWORD)
    field.send_keys(text)
    return field


def click_login(driver):
    driver.find_element(*LOGIN_BUTTON).click()


def error_text(driver):
    return WebDriverWait(driver, 10).until(
        EC.visibility_of_element_located(ERROR)
    ).text


def error_icon_count(driver):
    return len(driver.find_elements(*ERROR_ICON))
