# Financial Health Check — Frontend

A Next.js (App Router) + Tailwind self-service tool: a company enters its own
numbers and gets a risk score from the trained model, plus a plain-English
explanation from an AI advisor.

## Architecture

```
Browser (Next.js form)
   │  POST /api/predict  ──────────►  Python model service (../financial-risk-model/app.py)
   │  POST /api/advice   ──────────►  Groq LLM (openai/gpt-oss-120b), streamed back
   ▼
Result + streamed advice
```

The Next app never runs the model itself — it proxies to the Python service so
the score comes from the **real trained model**, not a reimplementation.

## Running it (two terminals)

**1. The model service** (Python):

```bash
cd ../financial-risk-model
pip install -r requirements.txt
python app.py                 # serves http://localhost:5000
```

**2. The frontend** (Next.js):

```bash
cd frontend
npm install
cp .env.example .env.local    # add your GROQ_API_KEY
npm run dev                    # serves http://localhost:3000
```

Open http://localhost:3000.

## Notes

- Without a `GROQ_API_KEY`, the score still works; the advisor just shows a
  "not configured" message.
- The model currently uses only 4 of the 6 inputs (`current_ratio` and
  `quick_ratio` are collected but not yet scored). The UI flags this.
- Design system is documented in [design.md](./design.md).
