-- ============================================================
-- COS/JO Workers Management — Database Schema
-- Per CSC-COA-DBM Joint Circular No. 1, s. 2017
-- ============================================================

-- COS/JO Workers table
CREATE TABLE public.cos_workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Personal Information
  first_name TEXT NOT NULL,
  middle_name TEXT,
  last_name TEXT NOT NULL,
  sex TEXT CHECK (sex IN ('male', 'female')),
  date_of_birth DATE,
  address TEXT,
  cs_eligibility TEXT,              -- Civil Service eligibility level
  highest_education TEXT,           -- Highest educational attainment

  -- Position & Assignment
  position_title TEXT NOT NULL,                         -- Designation / position title
  equivalent_position TEXT,                             -- Equivalent position / nature of work
  office_department TEXT NOT NULL,                      -- Office / department (org unit)
  actual_office_assignment TEXT,                        -- Actual office assignment (may differ)

  -- Employment Classification
  employment_type TEXT NOT NULL DEFAULT 'cos' CHECK (employment_type IN ('cos', 'jo')),
  nature_of_hiring TEXT NOT NULL DEFAULT 'contractual' CHECK (nature_of_hiring IN ('casual', 'contractual', 'job_order')),

  -- Compensation
  monthly_rate NUMERIC(12,2),
  fund_source TEXT NOT NULL DEFAULT 'mooe' CHECK (fund_source IN ('mooe', 'ps', 'project', 'other')),

  -- Contract Period
  contract_start DATE NOT NULL,
  contract_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expiring', 'expired')),

  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Updated_at trigger (reuses existing update_updated_at function from 001_schema.sql)
CREATE TRIGGER update_cos_workers_updated_at
  BEFORE UPDATE ON public.cos_workers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security
ALTER TABLE public.cos_workers ENABLE ROW LEVEL SECURITY;

-- HR admins can do everything
CREATE POLICY "hr_admin_all_cos_workers"
  ON public.cos_workers
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'hr_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'hr_admin'
    )
  );

-- All authenticated users can view COS workers
CREATE POLICY "authenticated_read_cos_workers"
  ON public.cos_workers
  FOR SELECT
  TO authenticated
  USING (true);

-- Indexes
CREATE INDEX idx_cos_workers_status ON public.cos_workers(status);
CREATE INDEX idx_cos_workers_employment_type ON public.cos_workers(employment_type);
CREATE INDEX idx_cos_workers_office_department ON public.cos_workers(office_department);
CREATE INDEX idx_cos_workers_contract_end ON public.cos_workers(contract_end);
