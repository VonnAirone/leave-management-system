-- ============================================
-- Admin Reference Tables: Positions, Offices, Rates
-- ============================================

-- Positions table
CREATE TABLE IF NOT EXISTS positions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Offices table
CREATE TABLE IF NOT EXISTS offices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  code TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Rates table
CREATE TABLE IF NOT EXISTS salary_rates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  salary_grade TEXT NOT NULL,
  step_increment INTEGER DEFAULT 1,
  monthly_rate NUMERIC(12, 2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(salary_grade, step_increment)
);

-- Updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_positions_updated_at BEFORE UPDATE ON positions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_offices_updated_at BEFORE UPDATE ON offices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_salary_rates_updated_at BEFORE UPDATE ON salary_rates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS policies
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE offices ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_rates ENABLE ROW LEVEL SECURITY;

-- Everyone can read
CREATE POLICY "Anyone can read positions" ON positions FOR SELECT USING (true);
CREATE POLICY "Anyone can read offices" ON offices FOR SELECT USING (true);
CREATE POLICY "Anyone can read salary_rates" ON salary_rates FOR SELECT USING (true);

-- Only hr_admin can insert/update/delete
CREATE POLICY "HR admin can insert positions" ON positions FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'hr_admin'));
CREATE POLICY "HR admin can update positions" ON positions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'hr_admin'));
CREATE POLICY "HR admin can delete positions" ON positions FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'hr_admin'));

CREATE POLICY "HR admin can insert offices" ON offices FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'hr_admin'));
CREATE POLICY "HR admin can update offices" ON offices FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'hr_admin'));
CREATE POLICY "HR admin can delete offices" ON offices FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'hr_admin'));

CREATE POLICY "HR admin can insert salary_rates" ON salary_rates FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'hr_admin'));
CREATE POLICY "HR admin can update salary_rates" ON salary_rates FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'hr_admin'));
CREATE POLICY "HR admin can delete salary_rates" ON salary_rates FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'hr_admin'));
