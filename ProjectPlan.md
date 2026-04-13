# TehRiehlBudget - Project Architecture & Implementation Plan

**Target Deployment URL:** `https://budget.tehriehldeal.com`

## 1. Project Overview
TehRiehlBudget is a highly secure, comprehensive personal finance application. It allows users to track spending across various account types (savings, checking, credit, loans, stocks), manually input transactions, upload receipt images, and view dynamic financial dashboards. The app features robust data encryption, external institution linking for live tracking, and AI-driven financial insights.

---

## 2. Technology Stack
* **Frontend:** React (bootstrapped with Vite) utilizing TypeScript.
* **UI/Styling:** TailwindCSS paired with ShadCN UI components.
* **State Management:** Zustand for lightweight global state (sessions, cached data).
* **Backend:** NestJS (TypeScript) for a modular, scalable RESTful API.
* **Database:** PostgreSQL for robust relational data mapping.
* **Infrastructure/Hosting:** Docker for local containerization, S3-compatible cloud storage for receipt images.

---

## 3. Project Environment Setup Steps
To get the local development environment running smoothly on your CachyOS system, follow these initialization steps:

**Prerequisites:** Node.js, your preferred package manager, and Docker.

**1. Initialize the Backend:**
```bash
# Generate the Nest application
npx @nestjs/cli new tehriehlbudget-backend --strict
cd tehriehlbudget-backend

# Install necessary ORM and encryption utilities (example using Prisma)
npm install prisma --save-dev
npx prisma init
```

**2. Initialize the Frontend:**
```bash
# Scaffold the React app with Vite
npm create vite@latest tehriehlbudget-frontend -- --template react-ts
cd tehriehlbudget-frontend
npm install

# Initialize TailwindCSS and ShadCN UI
npx tailwindcss init -p
npx shadcn-ui@latest init
```

**3. Database Containerization:**
Create a `docker-compose.yml` in the root of your backend project to quickly spin up the PostgreSQL instance without cluttering your host machine:
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: development_password
      POSTGRES_DB: tehriehlbudget
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```
Run `docker-compose up -d` to start the database.

---

## 4. Security & Authentication Model
Due to the sensitive nature of financial data, security at multiple layers is critical.

* **User Identity:** Implement a dedicated auth provider like Supabase Auth, Clerk, or Auth0. These services handle secure JWT issuance, local email/password setups, and make adding OAuth (Google, GitHub, etc.) seamless while offloading the risk of managing raw passwords.
* **Encryption at Rest:** Ensure the production PostgreSQL database volume (whether hosted via AWS RDS, Vercel, or a VPS) has hardware/volume-level encryption enabled by default.
* **Field-Level Encryption:** Utilize an application-level encryption interceptor in NestJS (using AES-256-GCM). Highly sensitive database columns (e.g., account numbers, API access tokens, precise transaction notes) must be encrypted in memory before writing to PostgreSQL, and decrypted on retrieval before being sent to the authorized client.

---

## 5. Core Third-Party Integrations
* **Live Institution Tracking (Plaid):** Integrate the Plaid API to securely link external accounts. This allows the app to fetch real-time balances and transaction histories from established institutions (like BECU, SoFi, Discover, and Robinhood) without ever handling the user's actual banking credentials.
* **AI Financial Advisor (OpenAI / Gemini):** Create an endpoint that feeds anonymized, aggregated transaction data to an LLM. The AI will return contextual feedback, spending summaries, and personalized saving advice to be displayed on the user's dashboard.
* **File Storage (Self Hosted):** Securely store uploaded receipt images. The NestJS backend will generate pre-signed URLs to allow the frontend to safely upload and retrieve images without exposing the storage bucket directly.

---

## 6. Development Roadmap

### Phase 1: Foundation & Infrastructure
* Execute environment setup steps (Vite, NestJS, Dockerized Postgres).
* Define base database schemas (Users, Accounts, Transactions, Categories).
* Implement user authentication and protected frontend routing.
* Configure DNS and SSL for `budget.tehriehldeal.com`.

### Phase 2: Core Ledger & UI Framework
* Build NestJS CRUD endpoints for manual Accounts and Transactions.
* Implement the field-level encryption logic for the database layer.
* Construct the frontend UI layouts using ShadCN and Tailwind.
* Implement Zustand stores to manage account and transaction states across the app.

### Phase 3: Media, Analytics, & Dashboards
* Integrate S3 storage for receipt uploads during the transaction entry flow.
* Write aggregation queries to calculate Net Worth, Total Debt, and periodic spending (weekly/monthly).
* Build the frontend dashboard with charting libraries (e.g., Recharts) to visualize category breakdowns over time.

### Phase 4: Advanced Integrations
* Implement the Plaid Link flow on the frontend and token exchange on the backend.
* Build the synchronization logic to pull live data from external institutions.
* Develop the AI integration pipeline, strictly ensuring all PII is stripped from the payload before requesting financial insights.