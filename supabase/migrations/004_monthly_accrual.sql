-- ============================================================
-- Monthly Leave Credit Accrual System
-- Per CSC Omnibus Rules: 1.25 VL + 1.25 SL per month of service
-- ============================================================

-- Add service_start_date column to existing profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS service_start_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- Function to accrue monthly leave credits for all active employees
-- Should be called on the 1st of each month
CREATE OR REPLACE FUNCTION public.accrue_monthly_leave_credits()
RETURNS void AS $$
DECLARE
  vl_type_id INTEGER;
  sl_type_id INTEGER;
  current_year INTEGER;
  accrual_rate NUMERIC(8,3) := 1.25; -- CSC standard: 1.25 days per month
BEGIN
  current_year := EXTRACT(YEAR FROM NOW())::INTEGER;
  
  -- Get leave type IDs
  SELECT id INTO vl_type_id FROM public.leave_types WHERE code = 'VL';
  SELECT id INTO sl_type_id FROM public.leave_types WHERE code = 'SL';

  -- Accrue VL credits for active employees
  IF vl_type_id IS NOT NULL THEN
    INSERT INTO public.leave_credits (employee_id, leave_type_id, total_earned, total_used, year)
    SELECT p.id, vl_type_id, accrual_rate, 0, current_year
    FROM public.profiles p
    WHERE p.is_active = TRUE 
      AND p.role = 'employee'
      AND p.service_start_date <= CURRENT_DATE
    ON CONFLICT (employee_id, leave_type_id, year) 
    DO UPDATE SET 
      total_earned = leave_credits.total_earned + accrual_rate,
      updated_at = NOW();
  END IF;

  -- Accrue SL credits for active employees
  IF sl_type_id IS NOT NULL THEN
    INSERT INTO public.leave_credits (employee_id, leave_type_id, total_earned, total_used, year)
    SELECT p.id, sl_type_id, accrual_rate, 0, current_year
    FROM public.profiles p
    WHERE p.is_active = TRUE 
      AND p.role = 'employee'
      AND p.service_start_date <= CURRENT_DATE
    ON CONFLICT (employee_id, leave_type_id, year) 
    DO UPDATE SET 
      total_earned = leave_credits.total_earned + accrual_rate,
      updated_at = NOW();
  END IF;

  RAISE NOTICE 'Monthly leave credits accrued for year %', current_year;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to initialize credits for a new year (carry over unused credits)
-- Should be called on January 1st
CREATE OR REPLACE FUNCTION public.initialize_yearly_leave_credits()
RETURNS void AS $$
DECLARE
  vl_type_id INTEGER;
  sl_type_id INTEGER;
  current_year INTEGER;
  previous_year INTEGER;
BEGIN
  current_year := EXTRACT(YEAR FROM NOW())::INTEGER;
  previous_year := current_year - 1;
  
  -- Get leave type IDs
  SELECT id INTO vl_type_id FROM public.leave_types WHERE code = 'VL';
  SELECT id INTO sl_type_id FROM public.leave_types WHERE code = 'SL';

  -- Carry over VL balance from previous year + add first month accrual
  IF vl_type_id IS NOT NULL THEN
    INSERT INTO public.leave_credits (employee_id, leave_type_id, total_earned, total_used, year)
    SELECT 
      p.id, 
      vl_type_id, 
      COALESCE(prev.total_earned - prev.total_used, 0) + 1.25, -- carried balance + Jan accrual
      0, 
      current_year
    FROM public.profiles p
    LEFT JOIN public.leave_credits prev 
      ON prev.employee_id = p.id 
      AND prev.leave_type_id = vl_type_id 
      AND prev.year = previous_year
    WHERE p.is_active = TRUE AND p.role = 'employee'
    ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;
  END IF;

  -- Carry over SL balance from previous year + add first month accrual
  IF sl_type_id IS NOT NULL THEN
    INSERT INTO public.leave_credits (employee_id, leave_type_id, total_earned, total_used, year)
    SELECT 
      p.id, 
      sl_type_id, 
      COALESCE(prev.total_earned - prev.total_used, 0) + 1.25, -- carried balance + Jan accrual
      0, 
      current_year
    FROM public.profiles p
    LEFT JOIN public.leave_credits prev 
      ON prev.employee_id = p.id 
      AND prev.leave_type_id = sl_type_id 
      AND prev.year = previous_year
    WHERE p.is_active = TRUE AND p.role = 'employee'
    ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;
  END IF;

  RAISE NOTICE 'Yearly leave credits initialized for year % with carryover from %', current_year, previous_year;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- pg_cron Setup (run in Supabase SQL Editor after enabling pg_cron)
-- ============================================================
-- Enable the pg_cron extension (requires Supabase Pro plan or self-hosted)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule monthly accrual on the 1st of each month at 00:05 AM UTC
-- SELECT cron.schedule(
--   'monthly-leave-accrual',
--   '5 0 1 * *',
--   $$SELECT public.accrue_monthly_leave_credits()$$
-- );

-- Schedule yearly initialization on January 1st at 00:01 AM UTC
-- SELECT cron.schedule(
--   'yearly-leave-init',
--   '1 0 1 1 *',
--   $$SELECT public.initialize_yearly_leave_credits()$$
-- );

-- To view scheduled jobs: SELECT * FROM cron.job;
-- To remove a job: SELECT cron.unschedule('job-name');
