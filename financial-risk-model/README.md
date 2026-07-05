---
title: "Financial Risk Assessment Model"
emoji: 💰
colorFrom: red
colorTo: green
sdk: transformers
app_file: huggingface_model.py
pinned: false
license: mit
tags:
- financial
- risk-assessment
- credit-risk
- default-prediction
- tabular-classification
pipeline_tag: tabular-classification
---

# Financial Risk Assessment Model

This model predicts the default risk for companies based on financial ratios.

## Model Description

A logistic regression model trained on financial data to predict company default probability. The model uses binned financial ratios as features and outputs:

- **probability**: The predicted probability of default (0-1)
- **risk_level**: Categorical risk assessment (LOW_RISK, MEDIUM_RISK, HIGH_RISK)
- **confidence**: Model confidence in the prediction

## Input Features

The model accepts the following financial ratios:

- `return_on_assets`: Return on Assets ratio
- `profit_margin`: Net Income Margin
- `debt_to_equity_ratio`: Debt to Equity ratio
- `current_ratio`: Current Ratio
- `interest_coverage`: Interest Coverage ratio
- `quick_ratio`: Quick Ratio (optional)

## Example Usage

```python
inputs = {
    "return_on_assets": 22.61,
    "profit_margin": 25.31,
    "debt_to_equity_ratio": 1.73,
    "current_ratio": 1.07,
    "interest_coverage": 29.9,
    "quick_ratio": 0.83
}

# The model will return:
# {
#   "probability": 0.156,
#   "risk_level": "LOW_RISK", 
#   "confidence": 0.832
# }
```

## API Usage

```bash
curl -X POST \
  https://api-inference.huggingface.co/models/your-username/financial-risk-model \
  -H "Authorization: Bearer YOUR_HF_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "inputs": {
      "return_on_assets": 22.61,
      "profit_margin": 25.31,
      "debt_to_equity_ratio": 1.73,
      "current_ratio": 1.07,
      "interest_coverage": 29.9
    }
  }'
```
