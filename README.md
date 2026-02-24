# Leave Management System

A web-based Leave Management System for provincial government employees, built on the **CS Form No. 6 (Revised 2020)** — the official Civil Service Application for Leave.

## Architecture

```
┌─────────────────────┐     ┌──────────────────────────────┐
│   React Frontend    │────>│        Supabase               │
│   (Vite + TS +      │     │  ┌──────────────────────┐    │
│    Tailwind CSS)    │     │  │ Auth (email/password) │    │
│                     │     │  ├──────────────────────┤    │
│  - Employee Portal  │     │  │ PostgreSQL Database   │    │
│  - HR Admin Portal  │     │  │ + RLS Policies        │    │
│                     │     │  ├──────────────────────┤    │
│                     │────>│  │ Edge Function         │    │
│                     │     │  │ (PDF Generation)      │    │
└─────────────────────┘     │  └──────────────────────┘    │
                            └──────────────────────────────┘
```

## Tech Stack

| Layer        | Technology                         |
|--------------|-------------------------------------|
| Frontend     | React 19, TypeScript, Vite          |
| Styling      | Tailwind CSS v4                     |
| Routing      | React Router v7                     |
| Backend      | Supabase (Auth, Postgres, Storage)  |
| PDF          | Supabase Edge Function (HTML/Print) |
| Icons        | Lucide React                        |
| Date Utils   | date-fns                            |

## Features

### Employee Portal
- Dashboard with leave credit balances (VL, SL)
- Apply for leave — form mirrors CS Form No. 6 sections 6.A through 6.D
- View application history with status tracking
- Generate printable CS Form No. 6 PDF

### HR Admin Portal
- Dashboard with pending/approved/rejected counts
- Review and approve/reject applications with remarks
- Manage employee profiles (add, edit, activate/deactivate)
- Set and adjust leave credits per employee per year

### Business Rules
- Credit check: blocks submission if insufficient credits
- Approval deducts credits from the employee's balance
- Rejection does not affect credits
- Status flow: `submitted` -> `approved` | `rejected`
- Employee info snapshot at filing time (position, office, salary)

## Setup

### 1. Supabase Project

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the migration files in order:
   ```
   supabase/migrations/001_schema.sql
   supabase/migrations/002_rls_policies.sql
   supabase/migrations/003_seed_data.sql
   ```
3. Copy your project URL and anon key from **Settings > API**

### 2. Create HR Admin User

In the Supabase dashboard:

1. Go to **Authentication > Users** and create a user (e.g., `hr@agency.gov.ph` / `password123`)
2. After the user is created, go to **SQL Editor** and run:
   ```sql
   UPDATE public.profiles
   SET role = 'hr_admin',
       first_name = 'HR',
       last_name = 'Admin',
       office_department = 'Human Resources',
       position_title = 'HR Officer'
   WHERE email = 'hr@agency.gov.ph';
   ```

### 3. Deploy Edge Function (PDF)

```bash
# Install Supabase CLI if not installed
npm install -g supabase

# Login and link
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the edge function
supabase functions deploy generate-pdf --no-verify-jwt
```

### 4. Frontend Setup

```bash
# Install dependencies
cd leave-management-system
npm install

# Configure environment
cp .env.example .env
# Edit .env with your Supabase URL and anon key

# Run locally
npm run dev
```

The app will be available at `http://localhost:5173`.

### 5. Deploy to Vercel

```bash
npm install -g vercel
vercel

# Set environment variables in Vercel dashboard:
# VITE_SUPABASE_URL = https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY = your-anon-key
```

## Environment Variables

| Variable               | Description                     |
|------------------------|---------------------------------|
| `VITE_SUPABASE_URL`   | Your Supabase project URL       |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous key  |

## Database Schema

### Tables

| Table                | Description                                          |
|----------------------|------------------------------------------------------|
| `profiles`           | Employee profiles (extends Supabase Auth users)      |
| `leave_types`        | Reference table for all 14 leave types from CS Form 6|
| `leave_credits`      | Per-employee, per-leave-type, per-year credit balance|
| `leave_applications` | All CS Form No. 6 fields + approval workflow fields  |

### Leave Types (from CS Form No. 6)

| Code | Name                                | Max Days |
|------|-------------------------------------|----------|
| VL   | Vacation Leave                      | -        |
| FL   | Mandatory/Forced Leave              | 5        |
| SL   | Sick Leave                          | -        |
| ML   | Maternity Leave                     | 105      |
| PL   | Paternity Leave                     | 7        |
| SPL  | Special Privilege Leave             | 3        |
| SOP  | Solo Parent Leave                   | 7        |
| STL  | Study Leave                         | 180      |
| VAWC | 10-Day VAWC Leave                   | 10       |
| RP   | Rehabilitation Privilege            | 180      |
| SLB  | Special Leave Benefits for Women    | 60       |
| SEC  | Special Emergency (Calamity) Leave  | 5        |
| AL   | Adoption Leave                      | 60       |
| OTH  | Others                              | -        |

### Roles

| Role       | Permissions                                           |
|------------|-------------------------------------------------------|
| `employee` | View own profile, credits, applications. Submit leave.|
| `hr_admin` | View all data. Approve/reject. Manage employees.      |

## Project Structure

```
leave-management-system/
├── src/
│   ├── components/
│   │   ├── layout/AppLayout.tsx          # Sidebar + header layout
│   │   └── shared/StatusBadge.tsx        # Status indicator
│   ├── hooks/useAuth.ts                  # Auth state hook
│   ├── lib/
│   │   ├── AuthContext.tsx               # Auth provider
│   │   └── supabase.ts                   # Supabase client
│   ├── pages/
│   │   ├── auth/LoginPage.tsx
│   │   ├── employee/
│   │   │   ├── DashboardPage.tsx         # Credits overview
│   │   │   ├── ApplyLeavePage.tsx        # CS Form No. 6 form
│   │   │   └── ApplicationsPage.tsx      # Leave history
│   │   └── hr/
│   │       ├── HRDashboardPage.tsx       # Stats overview
│   │       ├── HRApplicationsPage.tsx    # Approve/reject queue
│   │       ├── EmployeesPage.tsx         # Employee CRUD
│   │       └── CreditsPage.tsx           # Credit management
│   ├── types/database.ts                 # TypeScript types
│   ├── App.tsx                           # Router + providers
│   └── main.tsx                          # Entry point
├── supabase/
│   ├── migrations/
│   │   ├── 001_schema.sql               # Tables, triggers, indexes
│   │   ├── 002_rls_policies.sql         # Row Level Security
│   │   └── 003_seed_data.sql            # Leave types seed
│   └── functions/
│       └── generate-pdf/index.ts         # PDF edge function
├── .env.example
└── package.json
```

## CS Form No. 6 Field Mapping

The `leave_applications` table maps directly to the official form:

| Form Section | DB Fields |
|---|---|
| 1. Office/Department | `office_department` |
| 2. Name | `employee_name` |
| 3. Date of Filing | `date_of_filing` |
| 4. Position | `position_title` |
| 5. Salary | `salary` |
| 6.A Type of Leave | `leave_type_id`, `leave_type_others` |
| 6.B Details (VL) | `vacation_location_type`, `vacation_location_detail` |
| 6.B Details (SL) | `sick_leave_type`, `sick_leave_illness` |
| 6.B Details (Study) | `study_leave_completion_masters`, `study_leave_bar_review` |
| 6.B Details (Women) | `special_leave_illness` |
| 6.B Other Purpose | `other_purpose_monetization`, `other_purpose_terminal_leave` |
| 6.C Working Days | `num_working_days`, `inclusive_date_start`, `inclusive_date_end` |
| 6.D Commutation | `commutation_requested` |
| 7.A Certification | `cert_vl_*`, `cert_sl_*`, `cert_as_of_date` |
| 7.B Recommendation | `recommendation`, `recommendation_disapproval_reason`, `recommended_by` |
| 7.C Approval | `approved_days_with_pay`, `approved_days_without_pay`, `approved_others` |
| 7.D Disapproval | `disapproval_reason` |
