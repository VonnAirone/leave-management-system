-- ============================================================
-- Leave Management System — Database Schema
-- Based on CS Form No. 6 (Revised 2020)
-- ============================================================

-- 1. Profiles table (extends Supabase Auth users)
-- Maps to Sections 1-5 of CS Form No. 6
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL DEFAULT '',
  middle_name TEXT,
  last_name TEXT NOT NULL DEFAULT '',
  office_department TEXT NOT NULL DEFAULT '',
  position_title TEXT NOT NULL DEFAULT '',
  salary_grade TEXT,
  monthly_salary NUMERIC(12,2),
  service_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('employee', 'hr_admin')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Leave Types reference table (Section 6.A options)
CREATE TABLE public.leave_types (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  max_days INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 3. Leave Credits per employee per leave type per year
CREATE TABLE public.leave_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  leave_type_id INTEGER NOT NULL REFERENCES public.leave_types(id),
  total_earned NUMERIC(8,3) NOT NULL DEFAULT 0,
  total_used NUMERIC(8,3) NOT NULL DEFAULT 0,
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employee_id, leave_type_id, year)
);

-- 4. Leave Applications — all fields from CS Form No. 6
CREATE TABLE public.leave_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_number TEXT UNIQUE NOT NULL DEFAULT 'LA-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || SUBSTR(gen_random_uuid()::TEXT, 1, 6),
  employee_id UUID NOT NULL REFERENCES public.profiles(id),

  -- Sections 1-5: Employee info snapshot at filing time
  office_department TEXT NOT NULL,
  employee_name TEXT NOT NULL,
  position_title TEXT NOT NULL,
  salary TEXT,
  date_of_filing DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Section 6.A: Type of Leave
  leave_type_id INTEGER NOT NULL REFERENCES public.leave_types(id),
  leave_type_others TEXT,

  -- Section 6.B: Details of Leave
  -- Vacation / Special Privilege Leave
  vacation_location_type TEXT CHECK (vacation_location_type IN ('within_ph', 'abroad')),
  vacation_location_detail TEXT,
  -- Sick Leave
  sick_leave_type TEXT CHECK (sick_leave_type IN ('in_hospital', 'out_patient')),
  sick_leave_illness TEXT,
  -- Study Leave
  study_leave_completion_masters BOOLEAN NOT NULL DEFAULT FALSE,
  study_leave_bar_review BOOLEAN NOT NULL DEFAULT FALSE,
  -- Other purpose
  other_purpose_monetization BOOLEAN NOT NULL DEFAULT FALSE,
  other_purpose_terminal_leave BOOLEAN NOT NULL DEFAULT FALSE,
  -- Special Leave Benefits for Women
  special_leave_illness TEXT,

  -- Section 6.C: Number of Working Days & Inclusive Dates
  num_working_days NUMERIC(5,1) NOT NULL,
  inclusive_date_start DATE NOT NULL,
  inclusive_date_end DATE NOT NULL,

  -- Section 6.D: Commutation
  commutation_requested BOOLEAN NOT NULL DEFAULT FALSE,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),

  -- Section 7.A: Certification of Leave Credits (filled by HR)
  cert_vl_total_earned NUMERIC(8,3),
  cert_vl_less_this NUMERIC(8,3),
  cert_vl_balance NUMERIC(8,3),
  cert_sl_total_earned NUMERIC(8,3),
  cert_sl_less_this NUMERIC(8,3),
  cert_sl_balance NUMERIC(8,3),
  cert_as_of_date DATE,

  -- Section 7.B: Recommendation
  recommendation TEXT CHECK (recommendation IN ('for_approval', 'for_disapproval')),
  recommendation_disapproval_reason TEXT,
  recommended_by UUID REFERENCES public.profiles(id),

  -- Section 7.C/D: Final Action
  approved_days_with_pay NUMERIC(5,1),
  approved_days_without_pay NUMERIC(5,1),
  approved_others TEXT,
  disapproval_reason TEXT,
  actioned_by UUID REFERENCES public.profiles(id),
  actioned_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-generate application number
CREATE OR REPLACE FUNCTION generate_application_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.application_number := 'LA-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTR(NEW.id::TEXT, 1, 6));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_application_number
  BEFORE INSERT ON public.leave_applications
  FOR EACH ROW
  EXECUTE FUNCTION generate_application_number();

-- Auto-create profile on user signup with pro-rated leave credits
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  vl_type_id INTEGER;
  sl_type_id INTEGER;
  current_month INTEGER;
  remaining_months INTEGER;
  initial_credits NUMERIC(8,3);
BEGIN
  -- Create the profile with service start date
  INSERT INTO public.profiles (id, email, first_name, last_name, role, office_department, position_title, service_start_date)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'employee'),
    COALESCE(NEW.raw_user_meta_data->>'office_department', ''),
    COALESCE(NEW.raw_user_meta_data->>'position_title', ''),
    CURRENT_DATE
  );

  -- Calculate pro-rated credits based on remaining months in year (including current month)
  -- Per CSC Omnibus Rules: 1.25 days VL + 1.25 days SL per month of service
  current_month := EXTRACT(MONTH FROM NOW())::INTEGER;
  remaining_months := 13 - current_month; -- e.g., January = 12 months, December = 1 month
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_leave_credits_updated_at
  BEFORE UPDATE ON public.leave_credits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_leave_applications_updated_at
  BEFORE UPDATE ON public.leave_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Indexes
CREATE INDEX idx_leave_applications_employee ON public.leave_applications(employee_id);
CREATE INDEX idx_leave_applications_status ON public.leave_applications(status);
CREATE INDEX idx_leave_credits_employee_year ON public.leave_credits(employee_id, year);
