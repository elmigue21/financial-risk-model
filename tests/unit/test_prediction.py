"""
UT-04 -- Risk prediction unit tests.

Calls the model's predict() directly (no HTTP, no browser) and checks it returns
a well-formed risk assessment: probability, risk level, and confidence. The
inputs are the four ratios the frontend actually sends.
"""

# A normal, valid set of ratios (the four the model scores).
VALID = {
    "return_on_assets": 5.0,
    "profit_margin": 8.0,
    "interest_coverage": 3.0,
    "debt_to_equity_ratio": 55.0,
}

# Strong vs. weak financials for the monotonicity check.
STRONG = {
    "return_on_assets": 15.0,
    "profit_margin": 25.0,
    "interest_coverage": 12.0,
    "debt_to_equity_ratio": 20.0,
}
WEAK = {
    "return_on_assets": 0.5,
    "profit_margin": 1.0,
    "interest_coverage": 1.0,
    "debt_to_equity_ratio": 90.0,
}


# UT-04 -- prediction returns the expected fields.
def test_ut_04_returns_expected_shape(predict_fn):
    out = predict_fn(VALID)
    for key in ("probability", "risk_level", "confidence", "contributions"):
        assert key in out, f"missing '{key}' in prediction result"


# UT-04 -- probability is a real number in [0, 1].
def test_ut_04_probability_is_valid(predict_fn):
    p = predict_fn(VALID)["probability"]
    assert isinstance(p, float)
    assert 0.0 <= p <= 1.0, f"probability {p} out of range"


# UT-04 -- risk level is one of the three defined bands.
def test_ut_04_risk_level_is_valid(predict_fn):
    assert predict_fn(VALID)["risk_level"] in {"LOW_RISK", "MEDIUM_RISK", "HIGH_RISK"}


# UT-04 -- confidence is a number in the model's expected range.
def test_ut_04_confidence_in_range(predict_fn):
    c = predict_fn(VALID)["confidence"]
    assert 0.0 <= c <= 1.0, f"confidence {c} out of range"


# UT-04 -- the risk level matches the probability thresholds the model applies.
def test_ut_04_risk_level_matches_probability(predict_fn):
    out = predict_fn(VALID)
    p, level = out["probability"], out["risk_level"]
    if p >= 0.038:
        assert level == "HIGH_RISK"
    elif p >= 0.023:
        assert level == "MEDIUM_RISK"
    else:
        assert level == "LOW_RISK"


# UT-04 -- weaker financials are not scored as less risky than strong ones.
def test_ut_04_weaker_financials_are_not_less_risky(predict_fn):
    strong_p = predict_fn(STRONG)["probability"]
    weak_p = predict_fn(WEAK)["probability"]
    assert weak_p >= strong_p, f"weak {weak_p} scored lower risk than strong {strong_p}"


# UT-04 -- per-feature contributions are returned for the scored inputs.
def test_ut_04_contributions_present(predict_fn):
    contributions = predict_fn(VALID)["contributions"]
    assert isinstance(contributions, list) and len(contributions) > 0
    assert any(c.get("is_scored_driver") for c in contributions)
