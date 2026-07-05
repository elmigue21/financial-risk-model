from transformers import PretrainedConfig

class FinancialRiskConfig(PretrainedConfig):
    model_type = "financial_risk"
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
