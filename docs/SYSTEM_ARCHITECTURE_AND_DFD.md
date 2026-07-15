# System Architecture and Data Flow Diagram

## System Architecture

### Overview

The Financial Health Check System follows a **three-tier, client–server architecture**
with clearly separated responsibilities. Each tier does one job and communicates with the
others over well-defined interfaces (HTTP/JSON), which keeps the machine-learning model,
the application logic, and the user interface independent and replaceable.

| Tier | Technology | Port | Responsibility |
| --- | --- | --- | --- |
| **Presentation & Application** | Next.js (App Router, TypeScript) + Tailwind CSS | 3000 | User interface, authentication, persistence, and orchestration of the model and AI calls |
| **Model Service** | Python / Flask + scikit-learn | 5000 | Stateless risk scoring from a trained logistic-regression model |
| **AI Provider** | Groq LLM (external API) | — | Advice, input flags, and follow-up questions |
| **Data Store** | SQLite (`app.db`) | — | Persists user accounts and monthly assessment sessions |

### Architecture Diagram

```
          ┌───────────────────────────────────────────────────────────┐
          │                     Business Owner                         │
          │                    (Web Browser, UI)                       │
          └───────────────────────────┬───────────────────────────────┘
                                       │  HTTPS (figures, chat, login)
                                       ▼
   ┌─────────────────────────────────────────────────────────────────────────┐
   │                FRONTEND — Next.js Application (port 3000)                  │
   │                                                                           │
   │   • Authentication (session cookie, route protection)                     │
   │   • Data-entry, dashboard, history and profile pages                      │
   │   • API routes: /api/auth, /api/profile, /api/predict, /api/history,      │
   │     /api/advice, /api/flag, /api/suggestions                              │
   └───────┬───────────────────────────┬───────────────────────────┬──────────┘
           │ JSON (ratios)             │ JSON (prompt + summary)    │ SQL
           ▼                           ▼                            ▼
 ┌────────────────────┐    ┌────────────────────────┐   ┌────────────────────┐
 │  MODEL SERVICE     │    │   AI PROVIDER (Groq)    │   │  DATA STORE         │
 │  Flask (port 5000) │    │   External LLM API      │   │  SQLite (app.db)    │
 │  Logistic model    │    │   Advice / flags / Qs   │   │  users, predictions │
 └────────────────────┘    └────────────────────────┘   └────────────────────┘
```

### Component Responsibilities

- **Frontend (Next.js):** Renders all pages, authenticates users with a signed session
  cookie, enforces access control through middleware, and owns all persistence. It is the
  only layer that sees the complete session — inputs, model result, and AI output — for
  the signed-in user.
- **Model Service (Flask):** Receives financial ratios and returns a probability, a risk
  level, a confidence value, and per-feature risk contributions. It is **stateless** — it
  holds no data between requests.
- **AI Provider (Groq):** Generates plain-English advice (streamed), input flags, and
  suggested follow-up questions from a dashboard summary supplied by the frontend.
- **Data Store (SQLite):** Stores user accounts (`users`) and one assessment per month per
  user (`predictions`).

### Key Design Decisions

- **The frontend never runs the model itself.** It proxies to the Python service so the
  score always comes from the real trained model.
- **The model service is stateless; the frontend owns persistence.** This keeps the model
  simple to deploy and scale, and centralizes all data ownership in one tier.
- **Graceful degradation.** Without an AI provider key, the AI features return
  empty/disabled responses (HTTP 200, not errors) and deterministic rules act as the
  fallback, so scoring and history keep working.
- **Self-contained authentication.** A signed-cookie session (JWT) with hashed passwords,
  backed by the same SQLite store — no external authentication service is required.
- **Confidentiality by design.** Every data query is scoped to the signed-in user, so no
  user can access another user's assessments or account.

### Deployment View

- The **frontend** is built (`npm run build`) and served as a Node.js process; it requires
  a persistent filesystem for the SQLite database file.
- The **model service** runs as a long-running Python process reachable at `MODEL_API_URL`.
- The **AI provider** is an external SaaS API reached over HTTPS using an API key.

---

## Data Flow Diagram — Level 0 (Context Diagram)

### Purpose

The Level 0 (context) diagram shows the system as a **single process** and identifies the
external entities it exchanges data with, plus the data store it maintains. It defines the
system boundary and the major data flows crossing that boundary.

> At Level 0, the Python model service is treated as **inside** the system boundary (it is
> an internal component). It becomes a separate process only at Level 1.

### External Entities

| Entity | Description |
| --- | --- |
| **Business Owner** | The end user. Registers and signs in, enters monthly figures, reads the dashboard, and chats with the AI advisor. |
| **Groq LLM API** | External AI provider that returns advice, input flags, and suggested questions. |

### Data Store

| Store | Description |
| --- | --- |
| **D1: SQLite (`app.db`)** | Persists user accounts and one scored assessment session per month per user (figures, model result, AI flags, advisor conversation, suggestions). |

### Data Flows

| # | From → To | Data |
| --- | --- | --- |
| 1 | Business Owner → System | Registration and sign-in credentials |
| 2 | System → Business Owner | Authentication result / active session |
| 3 | Business Owner → System | Monthly financial figures, chat messages, month selection |
| 4 | System → Business Owner | Risk level, health score, ratio statuses, AI advice (streamed), insights, reports |
| 5 | System → Groq LLM API | Dashboard summary and prompt |
| 6 | Groq LLM API → System | Streamed advice, JSON input flags, JSON suggested questions |
| 7 | System ↔ Data Store (D1) | Create / read / update / delete user accounts and assessment sessions |

### Context Diagram

```
        ┌──────────────────────┐                     ┌──────────────────────┐
        │   Business Owner     │                     │     Groq LLM API     │
        │  (External Entity)   │                     │  (External Entity)   │
        └───────────┬──────────┘                     └───────────┬──────────┘
                    │                                            │
   (1) credentials, │                          (5) summary +    │  (6) advice,
   (3) figures,     │   (2) session,           prompt           │  flags,
   chat, month      │   (4) risk level,                         │  questions
                    ▼   advice, reports                         ▼
            ┌───────────────────────────────────────────────────────────┐
            │                                                           │
            │                          0                                │
            │            FINANCIAL HEALTH CHECK SYSTEM                  │
            │                                                           │
            └───────────────────────────┬───────────────────────────────┘
                                         │
                        (7) read / write │  user accounts &
                                         │  assessment sessions
                                         ▼
                             ┌───────────────────────────┐
                             │   D1 │ SQLite (app.db)      │
                             └───────────────────────────┘
```

### Narrative

The **Business Owner** first sends registration or sign-in credentials (flow 1) and
receives an authenticated session (flow 2). Once signed in, the owner submits monthly
financial figures, chat messages, and a month selection (flow 3). The **Financial Health
Check System** scores the figures, persists the session to the **SQLite** data store
(flow 7), requests plain-English advice by sending a dashboard summary to the **Groq LLM
API** (flow 5), and receives streamed advice, input flags, and suggested questions
(flow 6). Finally, the system returns the risk level, health score, ratio statuses,
AI advice, insights, and downloadable reports to the owner (flow 4). All stored data is
scoped to the authenticated owner, so each user sees only their own information.
