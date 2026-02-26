-- ============================================
-- COS Rates Reference Table
-- ============================================

CREATE TABLE IF NOT EXISTS cos_rates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  position_title TEXT NOT NULL,
  daily_rate NUMERIC(12, 2) NOT NULL,
  monthly_rate NUMERIC(12, 2),
  employment_type TEXT DEFAULT 'cos' CHECK (employment_type IN ('cos', 'jo')),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER update_cos_rates_updated_at BEFORE UPDATE ON cos_rates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE cos_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read cos_rates" ON cos_rates FOR SELECT USING (true);

CREATE POLICY "HR admin can insert cos_rates" ON cos_rates FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'hr_admin'));
CREATE POLICY "HR admin can update cos_rates" ON cos_rates FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'hr_admin'));
CREATE POLICY "HR admin can delete cos_rates" ON cos_rates FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'hr_admin'));
