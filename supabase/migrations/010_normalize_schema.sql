-- ============================================================
-- Schema Normalization Migration
-- Normalizes TEXT fields to FK references, extracts enums to
-- reference tables, and adds contract history tracking.
-- ============================================================

BEGIN;

-- ============================================================
-- PART 1: New Reference / Enum Tables
-- ============================================================

-- 1a. Roles
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,       -- 'employee', 'hr_admin', 'admin', etc.
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1b. Employment Types
CREATE TABLE IF NOT EXISTS public.employment_types (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,       -- 'cos', 'jo'
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1c. Hiring Natures
CREATE TABLE IF NOT EXISTS public.hiring_natures (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,       -- 'casual', 'contractual', 'job_order'
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1d. Fund Sources
CREATE TABLE IF NOT EXISTS public.fund_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,       -- 'mooe', 'ps', 'project', 'other'
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1e. Salary Grades (master list, separate from salary_rates which holds step/rate combos)
CREATE TABLE IF NOT EXISTS public.salary_grades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  grade TEXT UNIQUE NOT NULL,      -- 'SG-1', 'SG-2', etc.
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1f. COS Contracts (contract history per worker)
CREATE TABLE IF NOT EXISTS public.cos_contracts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_id UUID NOT NULL REFERENCES public.cos_workers(id) ON DELETE CASCADE,
  contract_start DATE NOT NULL,
  contract_end DATE NOT NULL,
  monthly_rate NUMERIC(12,2),
  fund_source_id UUID REFERENCES public.fund_sources(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expiring', 'expired')),
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Updated_at triggers for new tables
CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_employment_types_updated_at
  BEFORE UPDATE ON public.employment_types
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_hiring_natures_updated_at
  BEFORE UPDATE ON public.hiring_natures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_fund_sources_updated_at
  BEFORE UPDATE ON public.fund_sources
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_salary_grades_updated_at
  BEFORE UPDATE ON public.salary_grades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_cos_contracts_updated_at
  BEFORE UPDATE ON public.cos_contracts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- PART 2: Seed Reference / Enum Tables from Existing Data
-- ============================================================

-- 2a. Roles
INSERT INTO public.roles (code, name) VALUES
  ('employee', 'Employee'),
  ('hr_admin', 'HR Administrator')
ON CONFLICT (code) DO NOTHING;

-- 2b. Employment Types
INSERT INTO public.employment_types (code, name) VALUES
  ('cos', 'Contract of Service'),
  ('jo', 'Job Order')
ON CONFLICT (code) DO NOTHING;

-- 2c. Hiring Natures
INSERT INTO public.hiring_natures (code, name) VALUES
  ('casual', 'Casual'),
  ('contractual', 'Contractual'),
  ('job_order', 'Job Order')
ON CONFLICT (code) DO NOTHING;

-- 2d. Fund Sources
INSERT INTO public.fund_sources (code, name) VALUES
  ('mooe', 'Maintenance and Other Operating Expenses'),
  ('ps', 'Personal Services'),
  ('project', 'Project Fund'),
  ('other', 'Other')
ON CONFLICT (code) DO NOTHING;

-- 2e. Salary Grades — seed from existing salary_rates data
INSERT INTO public.salary_grades (grade)
SELECT DISTINCT salary_grade FROM public.salary_rates
WHERE salary_grade IS NOT NULL
ON CONFLICT (grade) DO NOTHING;

-- Also seed from profiles
INSERT INTO public.salary_grades (grade)
SELECT DISTINCT salary_grade FROM public.profiles
WHERE salary_grade IS NOT NULL
ON CONFLICT (grade) DO NOTHING;


-- ============================================================
-- PART 3: Add FK Columns to Existing Tables
-- ============================================================

-- 3a. profiles — add FK columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.roles(id),
  ADD COLUMN IF NOT EXISTS position_id UUID REFERENCES public.positions(id),
  ADD COLUMN IF NOT EXISTS office_id UUID REFERENCES public.offices(id),
  ADD COLUMN IF NOT EXISTS salary_grade_id UUID REFERENCES public.salary_grades(id);

-- 3b. cos_workers — add FK columns
ALTER TABLE public.cos_workers
  ADD COLUMN IF NOT EXISTS position_id UUID REFERENCES public.positions(id),
  ADD COLUMN IF NOT EXISTS office_id UUID REFERENCES public.offices(id),
  ADD COLUMN IF NOT EXISTS actual_office_id UUID REFERENCES public.offices(id),
  ADD COLUMN IF NOT EXISTS employment_type_id UUID REFERENCES public.employment_types(id),
  ADD COLUMN IF NOT EXISTS nature_of_hiring_id UUID REFERENCES public.hiring_natures(id),
  ADD COLUMN IF NOT EXISTS fund_source_id UUID REFERENCES public.fund_sources(id);

-- 3c. cos_rates — add FK column
ALTER TABLE public.cos_rates
  ADD COLUMN IF NOT EXISTS position_id UUID REFERENCES public.positions(id),
  ADD COLUMN IF NOT EXISTS employment_type_id UUID REFERENCES public.employment_types(id);

-- 3d. salary_rates — add FK column
ALTER TABLE public.salary_rates
  ADD COLUMN IF NOT EXISTS salary_grade_id UUID REFERENCES public.salary_grades(id);


-- ============================================================
-- PART 4: Migrate Data — Populate New FK Columns
-- ============================================================

-- 4a. profiles.role_id ← roles
UPDATE public.profiles p
SET role_id = r.id
FROM public.roles r
WHERE p.role = r.code
  AND p.role_id IS NULL;

-- 4b. profiles.position_id ← positions (match by title)
UPDATE public.profiles p
SET position_id = pos.id
FROM public.positions pos
WHERE LOWER(TRIM(p.position_title)) = LOWER(TRIM(pos.title))
  AND p.position_id IS NULL;

-- 4c. profiles.office_id ← offices (match by name)
UPDATE public.profiles p
SET office_id = o.id
FROM public.offices o
WHERE LOWER(TRIM(p.office_department)) = LOWER(TRIM(o.name))
  AND p.office_id IS NULL;

-- 4d. profiles.salary_grade_id ← salary_grades
UPDATE public.profiles p
SET salary_grade_id = sg.id
FROM public.salary_grades sg
WHERE p.salary_grade = sg.grade
  AND p.salary_grade_id IS NULL;

-- 4e. cos_workers.position_id ← positions
UPDATE public.cos_workers cw
SET position_id = pos.id
FROM public.positions pos
WHERE LOWER(TRIM(cw.position_title)) = LOWER(TRIM(pos.title))
  AND cw.position_id IS NULL;

-- 4f. cos_workers.office_id ← offices
UPDATE public.cos_workers cw
SET office_id = o.id
FROM public.offices o
WHERE LOWER(TRIM(cw.office_department)) = LOWER(TRIM(o.name))
  AND cw.office_id IS NULL;

-- 4g. cos_workers.actual_office_id ← offices
UPDATE public.cos_workers cw
SET actual_office_id = o.id
FROM public.offices o
WHERE LOWER(TRIM(cw.actual_office_assignment)) = LOWER(TRIM(o.name))
  AND cw.actual_office_id IS NULL
  AND cw.actual_office_assignment IS NOT NULL;

-- 4h. cos_workers.employment_type_id ← employment_types
UPDATE public.cos_workers cw
SET employment_type_id = et.id
FROM public.employment_types et
WHERE cw.employment_type = et.code
  AND cw.employment_type_id IS NULL;

-- 4i. cos_workers.nature_of_hiring_id ← hiring_natures
UPDATE public.cos_workers cw
SET nature_of_hiring_id = hn.id
FROM public.hiring_natures hn
WHERE cw.nature_of_hiring = hn.code
  AND cw.nature_of_hiring_id IS NULL;

-- 4j. cos_workers.fund_source_id ← fund_sources
UPDATE public.cos_workers cw
SET fund_source_id = fs.id
FROM public.fund_sources fs
WHERE cw.fund_source = fs.code
  AND cw.fund_source_id IS NULL;

-- 4k. cos_rates.position_id ← positions
UPDATE public.cos_rates cr
SET position_id = pos.id
FROM public.positions pos
WHERE LOWER(TRIM(cr.position_title)) = LOWER(TRIM(pos.title))
  AND cr.position_id IS NULL;

-- 4l. cos_rates.employment_type_id ← employment_types
UPDATE public.cos_rates cr
SET employment_type_id = et.id
FROM public.employment_types et
WHERE cr.employment_type = et.code
  AND cr.employment_type_id IS NULL;

-- 4m. salary_rates.salary_grade_id ← salary_grades
UPDATE public.salary_rates sr
SET salary_grade_id = sg.id
FROM public.salary_grades sg
WHERE sr.salary_grade = sg.grade
  AND sr.salary_grade_id IS NULL;

-- 4n. Migrate existing contracts to cos_contracts history table
INSERT INTO public.cos_contracts (worker_id, contract_start, contract_end, monthly_rate, fund_source_id, status, remarks)
SELECT
  cw.id,
  cw.contract_start,
  cw.contract_end,
  cw.monthly_rate,
  cw.fund_source_id,
  cw.status,
  cw.remarks
FROM public.cos_workers cw;


-- ============================================================
-- PART 5: Indexes on New FK Columns
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_profiles_role_id ON public.profiles(role_id);
CREATE INDEX IF NOT EXISTS idx_profiles_position_id ON public.profiles(position_id);
CREATE INDEX IF NOT EXISTS idx_profiles_office_id ON public.profiles(office_id);
CREATE INDEX IF NOT EXISTS idx_profiles_salary_grade_id ON public.profiles(salary_grade_id);

CREATE INDEX IF NOT EXISTS idx_cos_workers_position_id ON public.cos_workers(position_id);
CREATE INDEX IF NOT EXISTS idx_cos_workers_office_id ON public.cos_workers(office_id);
CREATE INDEX IF NOT EXISTS idx_cos_workers_actual_office_id ON public.cos_workers(actual_office_id);
CREATE INDEX IF NOT EXISTS idx_cos_workers_employment_type_id ON public.cos_workers(employment_type_id);
CREATE INDEX IF NOT EXISTS idx_cos_workers_nature_of_hiring_id ON public.cos_workers(nature_of_hiring_id);
CREATE INDEX IF NOT EXISTS idx_cos_workers_fund_source_id ON public.cos_workers(fund_source_id);

CREATE INDEX IF NOT EXISTS idx_cos_rates_position_id ON public.cos_rates(position_id);
CREATE INDEX IF NOT EXISTS idx_cos_rates_employment_type_id ON public.cos_rates(employment_type_id);

CREATE INDEX IF NOT EXISTS idx_salary_rates_salary_grade_id ON public.salary_rates(salary_grade_id);

CREATE INDEX IF NOT EXISTS idx_cos_contracts_worker_id ON public.cos_contracts(worker_id);
CREATE INDEX IF NOT EXISTS idx_cos_contracts_status ON public.cos_contracts(status);
CREATE INDEX IF NOT EXISTS idx_cos_contracts_contract_end ON public.cos_contracts(contract_end);


-- ============================================================
-- PART 6: RLS Policies for New Tables
-- ============================================================

-- All reference/enum tables: everyone can read, only hr_admin can modify
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['roles', 'employment_types', 'hiring_natures', 'fund_sources', 'salary_grades', 'cos_contracts']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

    EXECUTE format(
      'CREATE POLICY "Anyone can read %1$s" ON public.%1$I FOR SELECT USING (true)',
      tbl
    );

    EXECUTE format(
      'CREATE POLICY "HR admin can insert %1$s" ON public.%1$I FOR INSERT
        WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = ''hr_admin''))',
      tbl
    );

    EXECUTE format(
      'CREATE POLICY "HR admin can update %1$s" ON public.%1$I FOR UPDATE
        USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = ''hr_admin''))',
      tbl
    );

    EXECUTE format(
      'CREATE POLICY "HR admin can delete %1$s" ON public.%1$I FOR DELETE
        USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = ''hr_admin''))',
      tbl
    );
  END LOOP;
END $$;


-- ============================================================
-- PART 7: Update handle_new_user() to Use FK for Role
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  vl_type_id INTEGER;
  sl_type_id INTEGER;
  current_month INTEGER;
  remaining_months INTEGER;
  initial_credits NUMERIC(8,3);
  resolved_role_id UUID;
  user_role TEXT;
BEGIN
  -- Resolve role to role_id
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'employee');

  SELECT id INTO resolved_role_id
  FROM public.roles
  WHERE code = user_role;

  -- Create the profile with service start date
  INSERT INTO public.profiles (id, email, first_name, last_name, role, role_id, office_department, position_title, service_start_date)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    user_role,
    resolved_role_id,
    COALESCE(NEW.raw_user_meta_data->>'office_department', ''),
    COALESCE(NEW.raw_user_meta_data->>'position_title', ''),
    CURRENT_DATE
  );

  -- Calculate pro-rated credits based on remaining months in year (including current month)
  -- Per CSC Omnibus Rules: 1.25 days VL + 1.25 days SL per month of service
  current_month := EXTRACT(MONTH FROM NOW())::INTEGER;
  remaining_months := 13 - current_month;
  initial_credits := remaining_months * 1.25;

  -- Get leave type IDs for VL and SL
  SELECT id INTO vl_type_id FROM public.leave_types WHERE code = 'VL';
  SELECT id INTO sl_type_id FROM public.leave_types WHERE code = 'SL';

  -- Create pro-rated leave credits
  IF vl_type_id IS NOT NULL THEN
    INSERT INTO public.leave_credits (employee_id, leave_type_id, total_earned, total_used, year)
    VALUES (NEW.id, vl_type_id, initial_credits, 0, EXTRACT(YEAR FROM NOW()));
  END IF;

  IF sl_type_id IS NOT NULL THEN
    INSERT INTO public.leave_credits (employee_id, leave_type_id, total_earned, total_used, year)
    VALUES (NEW.id, sl_type_id, initial_credits, 0, EXTRACT(YEAR FROM NOW()));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- PART 8: Helpful Views (Denormalized for Easy Querying)
-- ============================================================

-- View: profiles with resolved names instead of IDs
CREATE OR REPLACE VIEW public.profiles_view AS
SELECT
  p.id,
  p.email,
  p.first_name,
  p.middle_name,
  p.last_name,
  COALESCE(o.name, p.office_department) AS office_department,
  COALESCE(pos.title, p.position_title) AS position_title,
  COALESCE(sg.grade, p.salary_grade) AS salary_grade,
  p.monthly_salary,
  p.service_start_date,
  COALESCE(r.code, p.role) AS role,
  p.is_active,
  p.created_at,
  p.updated_at,
  -- FK IDs for joins
  p.role_id,
  p.position_id,
  p.office_id,
  p.salary_grade_id
FROM public.profiles p
LEFT JOIN public.roles r ON p.role_id = r.id
LEFT JOIN public.positions pos ON p.position_id = pos.id
LEFT JOIN public.offices o ON p.office_id = o.id
LEFT JOIN public.salary_grades sg ON p.salary_grade_id = sg.id;

-- View: cos_workers with resolved names instead of IDs
CREATE OR REPLACE VIEW public.cos_workers_view AS
SELECT
  cw.id,
  cw.first_name,
  cw.middle_name,
  cw.last_name,
  cw.sex,
  cw.date_of_birth,
  cw.address,
  cw.cs_eligibility,
  cw.highest_education,
  COALESCE(pos.title, cw.position_title) AS position_title,
  cw.equivalent_position,
  COALESCE(o.name, cw.office_department) AS office_department,
  COALESCE(ao.name, cw.actual_office_assignment) AS actual_office_assignment,
  COALESCE(et.code, cw.employment_type) AS employment_type,
  COALESCE(hn.code, cw.nature_of_hiring) AS nature_of_hiring,
  cw.monthly_rate,
  COALESCE(fs.code, cw.fund_source) AS fund_source,
  cw.contract_start,
  cw.contract_end,
  cw.status,
  cw.remarks,
  cw.created_at,
  cw.updated_at,
  -- FK IDs for joins
  cw.position_id,
  cw.office_id,
  cw.actual_office_id,
  cw.employment_type_id,
  cw.nature_of_hiring_id,
  cw.fund_source_id
FROM public.cos_workers cw
LEFT JOIN public.positions pos ON cw.position_id = pos.id
LEFT JOIN public.offices o ON cw.office_id = o.id
LEFT JOIN public.offices ao ON cw.actual_office_id = ao.id
LEFT JOIN public.employment_types et ON cw.employment_type_id = et.id
LEFT JOIN public.hiring_natures hn ON cw.nature_of_hiring_id = hn.id
LEFT JOIN public.fund_sources fs ON cw.fund_source_id = fs.id;


-- ============================================================
-- NOTES
-- ============================================================
--
-- This migration uses an ADDITIVE approach:
--   - Old TEXT columns (role, position_title, office_department, etc.)
--     are KEPT for backward compatibility during the transition.
--   - New FK columns (_id) are added alongside them.
--   - Data is migrated from TEXT → FK where matches exist.
--   - Views (profiles_view, cos_workers_view) resolve FKs with
--     COALESCE fallback to old TEXT columns for unmatched rows.
--
-- FUTURE CLEANUP (separate migration after app code is updated):
--   - Drop old TEXT columns: profiles.role, profiles.position_title,
--     profiles.office_department, profiles.salary_grade
--   - Drop old TEXT columns: cos_workers.position_title,
--     cos_workers.office_department, cos_workers.actual_office_assignment,
--     cos_workers.employment_type, cos_workers.nature_of_hiring,
--     cos_workers.fund_source
--   - Drop old TEXT columns: cos_rates.position_title,
--     cos_rates.employment_type
--   - Drop old TEXT column: salary_rates.salary_grade
--   - Make new FK columns NOT NULL after all data is migrated
--   - Drop CHECK constraints on old TEXT columns
--

COMMIT;
