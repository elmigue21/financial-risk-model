"""
Minimal prediction service for the Financial Risk model.

Exposes POST /predict so the Next.js frontend can score a company.
The scoring logic mirrors modeling_financial_risk.py exactly (same
feature mapping, same binning, same logistic model) but skips the
transformers/torch wrapper so it stays lightweight.

Run:
    pip install -r requirements.txt
    python app.py
"""

import os
import pickle

import joblib
import numpy as np
import pandas as pd
from flask import Flask, request, jsonify

BASE = os.path.dirname(os.path.abspath(__file__))

model = joblib.load(os.path.join(BASE, "annual_logistic_model.pkl"))
with open(os.path.join(BASE, "scoring_info.pkl"), "rb") as f:
    scoring_info = pickle.load(f)

# API input name -> internal model column name
FEATURE_MAPPING = {
    "return_on_assets": "return on assets",
    "profit_margin": "net income margin",
    "debt_to_equity_ratio": "total debt / total capital (%)",
    "current_ratio": "current ratio (x)",
    "interest_coverage": "ebitda / interest expense",
}

# The 6 features the trained logistic model actually consumes.
MODEL_FEATURES = [
    "bin_return on assets",
    "bin_net income margin",
    "bin_fixed asset turnover",
    "bin_total debt / total capital (%)",
    "bin_ebitda / interest expense",
    "bin_total debt / ebitda",
]

# Model column -> API input name (reverse of FEATURE_MAPPING) so we can label
# each contribution with the field the user actually entered.
MODEL_COL_TO_API = {v: k for k, v in FEATURE_MAPPING.items()}

# Human-friendly labels for the "Top Risk Factors" chart.
FACTOR_LABELS = {
    "return on assets": "Return on assets",
    "net income margin": "Profit margin",
    "total debt / total capital (%)": "Debt ratio",
    "ebitda / interest expense": "Interest coverage",
    "fixed asset turnover": "Fixed asset turnover",
    "total debt / ebitda": "Debt / EBITDA",
}


def binned_runscoring(df, value_col):
    """Replace a raw ratio with the historical default rate of its bin."""
    df[value_col] = pd.to_numeric(df[value_col].replace("NM", np.nan), errors="coerce")
    intervals = scoring_info[value_col]["intervals"]
    rates = scoring_info[value_col]["rates"]

    def assign_rate(x):
        if pd.isna(x):
            return rates[intervals.index("Missing")]
        for idx, iv in enumerate(intervals):
            if iv == "Missing":
                continue
            low, high = iv
            if low < x <= high:
                return rates[idx]
        return None

    df[f"bin_{value_col}"] = df[value_col].apply(assign_rate)
    return df


def predict(inputs: dict) -> dict:
    mapped = {}
    for api_key, model_key in FEATURE_MAPPING.items():
        if api_key in inputs and inputs[api_key] is not None:
            mapped[model_key] = inputs[api_key]

    # Two features the model needs but the API doesn't collect (defaults).
    mapped.setdefault("fixed asset turnover", 1.0)
    mapped.setdefault("total debt / ebitda", 3.0)

    df = pd.DataFrame([mapped])
    for col in list(mapped.keys()):
        if col in scoring_info:
            df = binned_runscoring(df, col)

    X = df[[f for f in MODEL_FEATURES if f in df.columns]]
    probability = float(model.predict_proba(X)[:, 1][0])

    # Per-feature risk contributions. The model is a linear LogisticRegression,
    # so each feature's push on the log-odds is exactly coef * bin_rate. This is
    # the real explanation of the score (not a heuristic). Only the 4 features
    # the user actually enters are marked as scored drivers; the two hardcoded
    # constants shift the baseline but aren't user-controllable.
    contributions = []
    coefs = model.coef_[0]
    row = X.iloc[0]
    for i, bin_col in enumerate(model.feature_names_in_):
        if bin_col not in X.columns:
            continue
        raw_col = bin_col[len("bin_"):]
        bin_rate = row[bin_col]
        contribution = 0.0 if pd.isna(bin_rate) else float(coefs[i] * bin_rate)
        api_name = MODEL_COL_TO_API.get(raw_col)
        contributions.append(
            {
                "feature": api_name,
                "label": FACTOR_LABELS.get(raw_col, raw_col),
                "contribution": contribution,
                "is_scored_driver": api_name is not None,
            }
        )

    # This model predicts a RARE event (default), so its output only ever spans
    # ~1.7%–5.6%. The original 0.4/0.7 thresholds were impossible to reach, so
    # everything came back LOW. These thresholds are calibrated to the model's
    # actual output range. NOTE: this is a stopgap — proper calibration should
    # derive cutoffs from the score distribution on real data / retraining.
    if probability >= 0.038:
        risk_level = "HIGH_RISK"
    elif probability >= 0.023:
        risk_level = "MEDIUM_RISK"
    else:
        risk_level = "LOW_RISK"

    return {
        "probability": probability,
        "risk_level": risk_level,
        "confidence": min(0.95, max(0.6, abs(probability - 0.5) * 2)),
        "contributions": contributions,
    }


app = Flask(__name__)


@app.route("/health")
def health():
    return jsonify({"status": "ok"})


@app.route("/predict", methods=["POST"])
def predict_route():
    data = request.get_json(force=True) or {}
    # Coerce blank/invalid values to None so binning treats them as missing.
    inputs = {}
    for key, value in data.items():
        try:
            inputs[key] = float(value) if value not in (None, "") else None
        except (TypeError, ValueError):
            inputs[key] = None
    return jsonify(predict(inputs))


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
