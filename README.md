# Financial Health Check

A self-service tool where a company enters its own numbers and gets a risk
assessment (Low / Medium / High) from a trained model, plus a plain-English
explanation from an AI advisor you can chat with.

## How it fits together

```
Browser (Next.js frontend, port 3000)
   ├─ POST /api/predict ──►  Python model service (port 5000)  ──►  trained .pkl model
   └─ POST /api/advice  ──►  Groq LLM (streamed back)
```

The frontend never runs the model itself — it calls the Python service, so the
score always comes from the real trained model.

## Project structure

```
financial-risk/
├─ financial-risk-model/    # Python backend + the trained model
│  ├─ app.py                # Flask prediction service (POST /predict)
│  ├─ annual_logistic_model.pkl
│  ├─ scoring_info.pkl
│  └─ requirements.txt
└─ frontend/                # Next.js + Tailwind UI + AI advisor
   ├─ app/
   └─ .env.local            # your secrets (git-ignored)
```

## Prerequisites

- **Python 3.10+** and `pip`
- **Node.js 18+** and `npm`
- A **Groq API key** (free) from https://console.groq.com/keys — only needed
  for the AI advice/chat; the risk score works without it.

## Running it (two terminals)

You need **both** running at the same time.

### 1. Backend — the model service

```bash
cd financial-risk-model
pip install -r requirements.txt      # first time only
python app.py
```

Runs at **http://localhost:5000**. Leave this terminal open.
Quick check: open http://localhost:5000/health → `{"status":"ok"}`.

> On Windows, if `python` isn't found, try `py app.py`.

### 2. Frontend — the web app

```bash
cd frontend
npm install                          # first time only
cp .env.example .env.local           # then paste your GROQ_API_KEY into .env.local
npm run dev
```

Runs at **http://localhost:3000**. Open it in your browser.

## Configuration

Create `frontend/.env.local` (copy from `.env.example`):

```
GROQ_API_KEY=your_key_here           # enables AI advice + chat
MODEL_API_URL=http://localhost:5000  # where the backend runs
```

`.env.local` is git-ignored — never commit your key.

## Using it

1. Enter your company's numbers in the form and click **Check my health**.
2. The risk level (Low / Medium / High) appears on the right.
3. Ask the advisor follow-up questions in the chat.

## Notes / known limitations

- The model uses **4 of the 6 inputs** — `current_ratio` and `quick_ratio` are
  collected but not scored by the current model (the UI flags this).
- Risk thresholds are **calibrated to the model's real output range** (~1.7–5.6%);
  this is a stopgap — proper calibration would come from retraining.
- The AI advice reply size is capped to stay under the Groq free-tier
  8,000 tokens/minute limit.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| "Could not reach the model service" | The Python backend isn't running — start it (step 1). |
| Advice says "not configured" | Add `GROQ_API_KEY` to `frontend/.env.local` and **restart** `npm run dev` (env is read at startup). |
| Advice fails with `413` / rate limit | Groq free-tier token limit — wait a minute and retry. |
| `Cannot find module './xxx.js'` | Stale Next cache — stop dev, delete `frontend/.next`, run `npm run dev` again. |
