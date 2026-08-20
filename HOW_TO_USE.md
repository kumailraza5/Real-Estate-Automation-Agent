# How to Use & Test Real Estate Operations Agent

Welcome to **Real Estate Operations Agent**, an internal business process automation platform built for real estate companies. This guide provides clear, step-by-step instructions for testing and using the automation engine and workflow builder.

---

## 🚀 Quick Start / Local URLs

- **Frontend App**: [http://localhost:5173/](http://localhost:5173/)
- **Backend API**: [http://localhost:3000/api/healthz](http://localhost:3000/api/healthz)

---

## ⚡ Key Features & How It Works

This platform is **not a chatbot**. It is an **event-driven automation engine** that performs repetitive operational tasks automatically:

```
[System Event]  ➜  [Rule Evaluator]  ➜  [Automated Actions]
(Lead Created)     (Budget > $500k)     (1. Assign Senior Agent)
                                         (2. Create VIP Task)
                                         (3. Notify Manager)
```

---

## 🧪 Test Scenarios

### Scenario 1: High Budget Lead Auto-Assignment & Task Creation

1. Open the **Lead Center** in your browser at [http://localhost:5173/leads](http://localhost:5173/leads).
2. Click **+ Add Lead**.
3. Fill in the details:
   - **First Name**: Alex
   - **Last Name**: Morgan
   - **Email**: alex.morgan@example.com
   - **Budget**: `$750,000` (Greater than $500,000)
   - **Property Type**: Villa
4. Click **Save Lead**.
5. **Observe the Automation**:
   - Go to **Tasks** ([http://localhost:5173/tasks](http://localhost:5173/tasks)) ➜ You will see a new **"VIP High Budget Lead Follow-up"** task automatically generated!
   - Go to **Notifications** ➜ You will see a manager notification created automatically.
   - Go to **Workflows ➜ Executions** ([http://localhost:5173/workflow-executions](http://localhost:5173/workflow-executions)) ➜ You will see a `success` execution log showing 3 actions executed.

---

### Scenario 2: Property Viewing Completion Workflow

1. Go to **Calendar** ([http://localhost:5173/calendar](http://localhost:5173/calendar)).
2. Create a new Appointment (or edit an existing one).
3. Change its status to **Completed**.
4. **Observe the Automation**:
   - Go to **Tasks** ➜ A new **"Send Post-Viewing Feedback Form"** task will be created.
   - Go to **Workflow Executions** ➜ You will see the execution recorded under `VIEWING_COMPLETED`.

---

### Scenario 3: Creating a Custom Workflow Rule

1. Go to **Workflows** ([http://localhost:5173/workflows](http://localhost:5173/workflows)).
2. Click **+ New Workflow**.
3. Define your automation rule:
   - **Name**: Website Lead Urgent Follow-up
   - **Trigger Event**: `LEAD_CREATED`
   - **Conditions**: `source == 'website'`
   - **Actions**: Select `Create Task` and `Notify Manager`.
4. Save the workflow and toggle it **Active**.
5. Test it by creating a new lead with `Source: Website`.

---

## 📊 Monitoring & Audit Logs

- **Workflow Executions**: [http://localhost:5173/workflow-executions](http://localhost:5173/workflow-executions) - Live log of every event evaluated, actions executed, and success/failure status.
- **Activity Feed**: Located on the **Dashboard** ([http://localhost:5173/](http://localhost:5173/)) - Displays a timeline of all automated agent assignments, task creations, and status changes.
