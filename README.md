# Real-Estate-Automation-Agent

A modern, high-performance Real Estate CRM & Automation Platform built with React, TypeScript, Express, Drizzle ORM, and Supabase / PostgreSQL.

## 🚀 Features

- **Lead Management & Pipeline Tracking**: Lead capture, qualification scoring, stage advancement, and atomic lead-to-client conversion.
- **Client Management**: Property preferences, budget tracking, interaction history, and linked appointments.
- **Property Inventory**: Comprehensive property catalog with status tracking (Available, Under Offer, Sold), price/area filters, and image attachments.
- **Viewing Appointments & Calendar**: Interactive calendar for scheduling, rescheduling, and status tracking (`scheduled`, `completed`, `cancelled`).
- **CRM Tasks**: Task prioritization, due date tracking, and overdue status handling.
- **Intelligent Automation Engine & Background Scheduler**:
  - Event-driven reactive automations (`LEAD_CREATED`, `LEAD_UPDATED`, `CLIENT_CREATED`, `VIEWING_SCHEDULED`, `VIEWING_COMPLETED`, `PROPERTY_LISTED`, `PROPERTY_SOLD`, `TASK_COMPLETED`).
  - Periodic cron-like scheduler for upcoming appointment reminders and overdue task alerts.
  - In-memory batch deduplication and idempotent execution history.
- **Notifications Center**: Instant alerts, unread counters, mark-as-read, and deep links to triggering entities.
- **Analytics & Reporting Dashboard**: KPIs, conversion rates, pipeline velocity, stage distribution, agent performance, and activity logs.

## 🏗️ Architecture & Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Vite, Lucide Icons, Radix UI, TanStack Query.
- **Backend API**: Node.js, Express, TypeScript, Zod schema validation, Pino logger.
- **Database**: PostgreSQL / Supabase, Drizzle ORM.
- **Monorepo**: PNPM Workspaces (`artifacts/reoa`, `artifacts/api-server`, `lib/db`, `lib/api-zod`, `lib/api-client-react`).

## 🛠️ Getting Started

### Prerequisites

- Node.js >= 20
- pnpm >= 9

### Installation

```bash
# Clone the repository
git clone https://github.com/kumailraza5/Real-Estate-Automation-Agent.git
cd Real-Estate-Automation-Agent

# Install all dependencies
pnpm install
```

### Environment Setup

Create `.env` in `artifacts/api-server/` with:

```env
PORT=3000
DATABASE_URL=postgresql://user:password@host:port/dbname
```

### Running Locally

```bash
# Start all packages in parallel (API server + Frontend UI)
pnpm run dev
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000`

### Running Tests

```bash
cd artifacts/api-server
node e2e-security-reliability.js
node e2e-scheduler.js
node e2e-full-lifecycle.js
```

## 📄 License

MIT
