"""
Fixtures for the Python unit tests (UT-04).

UT-04 tests the model's predict() directly, so it imports it from the Flask
service package. Importing app.py loads the trained model (pickle files) at
module load, which needs the model service's dependencies (numpy, pandas,
scikit-learn, joblib, flask). If they're missing, the test skips with a hint
rather than erroring.
"""

import os
import sys

import pytest

MODEL_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "financial-risk-model")
)


@pytest.fixture(scope="session")
def predict_fn():
    if MODEL_DIR not in sys.path:
        sys.path.insert(0, MODEL_DIR)
    try:
        from app import predict  # loads the trained model at import time
    except Exception as exc:  # missing deps / model files
        pytest.skip(
            f"Model service not importable ({exc.__class__.__name__}: {exc}). "
            "Install financial-risk-model/requirements.txt in this Python."
        )
    return predict
