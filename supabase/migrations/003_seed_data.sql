-- ============================================================
-- Seed Data — Leave Types from CS Form No. 6
-- ============================================================

INSERT INTO public.leave_types (code, name, description, max_days) VALUES
  ('VL', 'Vacation Leave', 'Sec. 51, Rule XVI, Omnibus Rules Implementing E.O. No. 292', NULL),
  ('FL', 'Mandatory/Forced Leave', 'Sec. 25, Rule XVI, Omnibus Rules Implementing E.O. No. 292', 5),
  ('SL', 'Sick Leave', 'Sec. 43, Rule XVI, Omnibus Rules Implementing E.O. No. 292', NULL),
  ('ML', 'Maternity Leave', 'R.A. No. 11210 / IRR issued by CSC, DOLE and SSS', 105),
  ('PL', 'Paternity Leave', 'R.A. No. 8187 / CSC MC No. 71, s. 1998, as amended', 7),
  ('SPL', 'Special Privilege Leave', 'Sec. 21, Rule XVI, Omnibus Rules Implementing E.O. No. 292', 3),
  ('SOP', 'Solo Parent Leave', 'RA No. 8972 / CSC MC No. 8, s. 2004', 7),
  ('STL', 'Study Leave', 'Sec. 68, Rule XVI, Omnibus Rules Implementing E.O. No. 292', 180),
  ('VAWC', '10-Day VAWC Leave', 'RA No. 9262 / CSC MC No. 15, s. 2005', 10),
  ('RP', 'Rehabilitation Privilege', 'Sec. 55, Rule XVI, Omnibus Rules Implementing E.O. No. 292', 180),
  ('SLB', 'Special Leave Benefits for Women', 'RA No. 9710 / CSC MC No. 25, s. 2010', 60),
  ('SEC', 'Special Emergency (Calamity) Leave', 'CSC MC No. 2, s. 2012, as amended', 5),
  ('AL', 'Adoption Leave', 'R.A. No. 8552', 60),
  ('OTH', 'Others', 'Other types of leave', NULL)
ON CONFLICT (code) DO NOTHING;
