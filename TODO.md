# TehRiehlBudget — TODO

> **Development approach:** Test-Driven Development (TDD). Write tests before implementation. Target **90%+ code coverage** across both frontend and backend.

---

## Test Infrastructure Setup

- [x] Configure Jest for backend (NestJS) with coverage thresholds (90% statements, branches, functions, lines)
- [x] Configure Vitest + React Testing Library for frontend with coverage thresholds (90%)
- [x] Add pnpm workspace scripts for running all tests and generating combined coverage reports
- [ ] Set up test database configuration (separate Postgres instance or test schema for integration tests)

---

## Phase 1: Foundation & Infrastructure

### Project Scaffolding
- [x] Initialize pnpm workspace at project root (`pnpm-workspace.yaml`)
- [x] Scaffold NestJS backend (`tehriehlbudget-backend/`)
- [x] Scaffold React + Vite frontend (`tehriehlbudget-frontend/`)
- [x] Create `docker-compose.yml` for PostgreSQL container
- [x] Initialize TailwindCSS and ShadCN UI in frontend
- [x] Configure shared ESLint and Prettier across the monorepo

### Database Schema
- [x] Write tests for Prisma model validations and relations
- [x] Define Prisma schema: `User`, `Account`, `Transaction`, `Category` models
- [x] Create initial migration (`prisma migrate dev`)
- [x] Seed script for development data

### Authentication (Supabase Auth)
- [x] Write tests for backend JWT guard (valid token, expired token, missing token)
- [x] Implement NestJS Supabase Auth guard and middleware
- [x] Write tests for frontend auth state management (Zustand store)
- [x] Implement frontend Supabase Auth integration (login, signup, logout, OAuth)
- [x] Implement protected route wrappers on frontend
- [ ] Configure DNS and SSL for `budget.tehriehldeal.com`

---

## Phase 2: Core Ledger & UI Framework

### Accounts Module
- [x] Write tests for Accounts service (create, read, update, delete, list by user)
- [x] Write tests for Accounts controller (request validation, auth, response shape)
- [x] Implement Accounts NestJS module (service, controller, DTOs)
- [x] Write tests for Accounts Zustand store
- [x] Build Accounts UI (list view, create/edit forms) with ShadCN components

### Transactions Module
- [x] Write tests for Transactions service (CRUD, filtering by date/category/account)
- [x] Write tests for Transactions controller (request validation, auth, pagination)
- [x] Implement Transactions NestJS module (service, controller, DTOs)
- [x] Write tests for Transactions Zustand store
- [x] Build Transactions UI (list view, create/edit forms, category assignment)

### Categories Module
- [x] Write tests for Categories service (CRUD, default categories per user)
- [x] Implement Categories NestJS module (service, controller, DTOs)
- [x] Build Categories UI (management page, color/icon assignment)

### Field-Level Encryption
- [x] Write tests for encryption interceptor (encrypt on write, decrypt on read, handle null values)
- [x] Write tests for encryption utility functions (AES-256-GCM encrypt/decrypt, key rotation)
- [x] Implement NestJS encryption interceptor and utility module
- [x] Mark sensitive Prisma fields and apply interceptor to relevant endpoints

### Frontend Layout
- [x] Build app shell layout (sidebar navigation, header, main content area)
- [x] Implement responsive design breakpoints
- [x] Build shared UI components (data tables, form inputs, modals, toasts)

---

## Phase 3: Media, Analytics, & Dashboards

### Receipt Upload
- [x] Write tests for file upload service (save to disk, retrieve, delete, size/type validation)
- [x] Write tests for upload controller (auth, file validation, access-controlled URL generation)
- [x] Implement local filesystem storage service in NestJS
- [x] Implement upload/download endpoints with access-controlled URLs
- [x] Write tests for receipt attachment in transaction flow
- [x] Build receipt upload UI (drag-and-drop, preview, attach to transaction)

### Financial Aggregations
- [x] Write tests for aggregation service (net worth, total debt, weekly/monthly spending by category)
- [x] Implement aggregation queries and service module
- [x] Write tests for aggregation API endpoints
- [x] Implement aggregation endpoints

### Dashboard
- [x] Write tests for dashboard data-fetching hooks
- [x] Build dashboard page with Recharts (net worth over time, spending by category, debt breakdown)
- [x] Implement date range selectors and filtering controls

---

## Phase 4: Advanced Integrations

### Plaid Integration
- [x] Write tests for Plaid service (link token creation, token exchange, account sync, transaction sync)
- [x] Implement Plaid backend module (link tokens, public token exchange, webhook handler)
- [x] Write tests for Plaid Link frontend flow
- [x] Build Plaid Link UI (connect account flow, linked accounts management)
- [x] Implement sync logic to pull live balances and transactions from linked institutions

### AI Financial Advisor
- [x] Write tests for PII stripping utility (ensure no names, account numbers, or identifiers leak)
- [x] Write tests for AI advisor service (prompt construction, response parsing, error handling)
- [x] Implement AI advisor endpoint (anonymize data, call LLM, return insights)
- [x] Build advisor UI on dashboard (insights card, spending summaries, saving suggestions)
