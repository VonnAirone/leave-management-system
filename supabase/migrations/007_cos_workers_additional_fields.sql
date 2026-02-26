-- ============================================================
-- COS/JO Workers — Additional Fields
-- Per CSC-COA-DBM Joint Circular No. 1, s. 2017
-- ============================================================

-- Personal Information
ALTER TABLE public.cos_workers ADD COLUMN IF NOT EXISTS sex TEXT CHECK (sex IN ('male', 'female'));
ALTER TABLE public.cos_workers ADD COLUMN IF NOT EXISTS date_of_birth DATE;
ALTER TABLE public.cos_workers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.cos_workers ADD COLUMN IF NOT EXISTS cs_eligibility TEXT;
ALTER TABLE public.cos_workers ADD COLUMN IF NOT EXISTS highest_education TEXT;

-- Position & Assignment
ALTER TABLE public.cos_workers ADD COLUMN IF NOT EXISTS equivalent_position TEXT;
ALTER TABLE public.cos_workers ADD COLUMN IF NOT EXISTS actual_office_assignment TEXT;

-- Employment Classification
ALTER TABLE public.cos_workers ADD COLUMN IF NOT EXISTS nature_of_hiring TEXT NOT NULL DEFAULT 'contractual' CHECK (nature_of_hiring IN ('casual', 'contractual', 'job_order'));
