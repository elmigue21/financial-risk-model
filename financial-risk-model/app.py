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
