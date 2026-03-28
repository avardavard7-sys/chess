-- КОИНЫ — копируй в Supabase SQL Editor

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS coins INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS coin_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  mode TEXT UNIQUE NOT NULL,
  win_coins INTEGER DEFAULT 10,
  loss_coins INTEGER DEFAULT -3,
  draw_coins INTEGER DEFAULT 2,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE coin_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone read coin_settings" ON coin_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage coin_settings" ON coin_settings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
GRANT ALL ON coin_settings TO authenticated;

INSERT INTO coin_settings (mode, win_coins, loss_coins, draw_coins) VALUES
  ('kids', 5, 0, 2),
  ('beginner', 10, -2, 3),
  ('medium', 15, -5, 5),
  ('hard', 25, -8, 8),
  ('expert', 40, -15, 12),
  ('online', 20, -10, 7)
ON CONFLICT (mode) DO NOTHING;
