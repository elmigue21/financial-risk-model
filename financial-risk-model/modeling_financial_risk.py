from transformers import PreTrainedModel, PretrainedConfig
import pandas as pd
import numpy as np
import pickle
import joblib
import json
import os

class FinancialRiskConfig(PretrainedConfig):
    model_type = "financial_risk"
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)

class FinancialRiskModel(PreTrainedModel):
    config_class = FinancialRiskConfig
    
    def __init__(self, config):
        super().__init__(config)
        
        # Load the actual model and scoring info
        model_path = os.path.join(os.path.dirname(__file__), "annual_logistic_model.pkl")
        scoring_path = os.path.join(os.path.dirname(__file__), "scoring_info.pkl")
        
        self.model = joblib.load(model_path)
        with open(scoring_path, 'rb') as f:
            self.scoring_info = pickle.load(f)
        
        # Define feature mapping from API input to model features
        self.feature_mapping = {
            'return_on_assets': 'return on assets',
            'profit_margin': 'net income margin',
            'debt_to_equity_ratio': 'total debt / total capital (%)',
            'current_ratio': 'current ratio (x)',
            'interest_coverage': 'ebitda / interest expense'
        }
        
        # These are the features your model expects
        self.model_features = [
            'bin_return on assets', 
            'bin_net income margin', 
            'bin_fixed asset turnover',  
            'bin_total debt / total capital (%)', 
            'bin_ebitda / interest expense', 
            'bin_total debt / ebitda'
        ]
    
    def binned_runscoring(self, df, value_col, scoring_info):
        """Apply binning scoring to a column"""
        df[value_col] = pd.to_numeric(df[value_col].replace('NM', np.nan), errors='coerce')
        
        intervals = scoring_info[value_col]['intervals']
        rates = scoring_info[value_col]['rates']
        
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
        
        prefix = 'bin_'
        new_column_name = f"{prefix}{value_col}"
        df[new_column_name] = df[value_col].apply(assign_rate)
        return df
    
    def preprocess_input(self, inputs):
        """Convert API input format to model input format"""
        mapped_data = {}
        for api_key, model_key in self.feature_mapping.items():
            if api_key in inputs:
                mapped_data[model_key] = inputs[api_key]
        
        # Add default values for missing features
        if 'fixed asset turnover' not in mapped_data:
            mapped_data['fixed asset turnover'] = 1.0
        if 'total debt / ebitda' not in mapped_data:
            mapped_data['total debt / ebitda'] = 3.0
        
        df = pd.DataFrame([mapped_data])
        
        # Apply binning to each variable
        for col in mapped_data.keys():
            if col in self.scoring_info:
                df = self.binned_runscoring(df, col, self.scoring_info)
        
        available_features = [f for f in self.model_features if f in df.columns]
        X = df[available_features]
        
        return X
    
    def forward(self, inputs):
        """Make prediction"""
        # Handle different input formats
        if isinstance(inputs, str):
            inputs = json.loads(inputs)
        
        if isinstance(inputs, dict) and 'inputs' in inputs:
            inputs = inputs['inputs']
        
        X = self.preprocess_input(inputs)
        probability = self.model.predict_proba(X)[:, 1][0]
        
        if probability >= 0.7:
            risk_level = "HIGH_RISK"
        elif probability >= 0.4:
            risk_level = "MEDIUM_RISK"
        else:
            risk_level = "LOW_RISK"
        
        return {
            "probability": float(probability),
            "risk_level": risk_level,
            "confidence": min(0.95, max(0.6, abs(probability - 0.5) * 2))
        }
