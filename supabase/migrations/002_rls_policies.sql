-- ============================================================
-- Row Level Security Policies
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_applications ENABLE ROW LEVEL SECURITY;

-- ========================
-- PROFILES
-- ========================

-- Everyone can read their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- HR Admin can view all profiles
CREATE POLICY "HR Admin can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'hr_admin'
    )
  );

-- HR Admin can update any profile
CREATE POLICY "HR Admin can update profiles"
  ON public.profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'hr_admin'
    )
  );

-- HR Admin can insert profiles (for creating employees)
CREATE POLICY "HR Admin can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'hr_admin'
    )
  );

-- Allow the trigger to insert profiles on signup
CREATE POLICY "Service role can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (TRUE);

-- ========================
-- LEAVE TYPES (read-only for all authenticated users)
-- ========================

CREATE POLICY "Anyone can read leave types"
  ON public.leave_types FOR SELECT
  USING (TRUE);

-- HR Admin can manage leave types
CREATE POLICY "HR Admin can insert leave types"
  ON public.leave_types FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'hr_admin'
    )
  );

CREATE POLICY "HR Admin can update leave types"
  ON public.leave_types FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'hr_admin'
    )
  );

-- ========================
-- LEAVE CREDITS
-- ========================

-- Employees can view their own credits
CREATE POLICY "Employees can view own credits"
  ON public.leave_credits FOR SELECT
  USING (employee_id = auth.uid());

-- HR Admin can view all credits
CREATE POLICY "HR Admin can view all credits"
  ON public.leave_credits FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'hr_admin'
    )
  );

-- HR Admin can insert/update credits
CREATE POLICY "HR Admin can insert credits"
  ON public.leave_credits FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'hr_admin'
    )
  );

CREATE POLICY "HR Admin can update credits"
  ON public.leave_credits FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'hr_admin'
    )
  );

-- ========================
-- LEAVE APPLICATIONS
-- ========================

-- Employees can view their own applications
CREATE POLICY "Employees can view own applications"
  ON public.leave_applications FOR SELECT
  USING (employee_id = auth.uid());

-- Employees can insert their own applications
CREATE POLICY "Employees can insert own applications"
  ON public.leave_applications FOR INSERT
  WITH CHECK (employee_id = auth.uid());

-- Employees can update own draft applications
CREATE POLICY "Employees can update own draft applications"
  ON public.leave_applications FOR UPDATE
  USING (employee_id = auth.uid() AND status = 'draft');

-- HR Admin can view all applications
CREATE POLICY "HR Admin can view all applications"
  ON public.leave_applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'hr_admin'
    )
  );

-- HR Admin can update applications (approve/reject)
CREATE POLICY "HR Admin can update applications"
  ON public.leave_applications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'hr_admin'
    )
  );
